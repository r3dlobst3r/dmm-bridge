import express from 'express';
import * as puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

const DMM_URL = process.env.DMM_URL;
const RD_ACCESS_TOKEN = process.env.RD_ACCESS_TOKEN;
const RD_REFRESH_TOKEN = process.env.RD_REFRESH_TOKEN;
const RD_CLIENT_ID = process.env.RD_CLIENT_ID;
const RD_CLIENT_SECRET = process.env.RD_CLIENT_SECRET;
const RD_CAST_TOKEN = process.env.RD_CAST_TOKEN;

if (!DMM_URL || !RD_ACCESS_TOKEN || !RD_REFRESH_TOKEN || !RD_CLIENT_ID || !RD_CLIENT_SECRET) {
  throw new Error('Missing required environment variables');
}

console.log('Starting DMM-Overseerr bridge with configuration:');
console.log(`DMM URL: ${DMM_URL}`);

let browser: puppeteer.Browser | null = null;

async function initBrowser() {
  if (!browser) {
    console.log('Initializing browser...');
    browser = await puppeteer.launch({
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ],
      headless: true
    });
    console.log('Browser initialized successfully');
  }
  return browser;
}

interface AuthData {
  'rd:accessToken': string;
  'rd:refreshToken': string;
  'rd:clientId': string;
  'rd:clientSecret': string;
  'rd:castToken'?: string;
}

async function setupAuth(page: puppeteer.Page) {
  console.log('Setting up authentication...');
  
  // Calculate token expiry (30 days from now)
  const expiryDate = Date.now() + (30 * 24 * 60 * 60 * 1000);
  
  const authData: AuthData = {
    'rd:accessToken': JSON.stringify({
      value: RD_ACCESS_TOKEN,
      expiry: expiryDate
    }),
    'rd:refreshToken': RD_REFRESH_TOKEN!,
    'rd:clientId': RD_CLIENT_ID!,
    'rd:clientSecret': RD_CLIENT_SECRET!
  };

  if (RD_CAST_TOKEN) {
    authData['rd:castToken'] = RD_CAST_TOKEN;
  }

  // Set all auth data in localStorage
  await page.evaluate((data: AuthData) => {
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }
  }, authData);
  
  console.log('Authentication data set successfully');
}

async function searchDMM(tmdbId: string, title: string) {
  console.log('Starting DMM search process...');
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  try {
    // First navigate to the main page
    await page.goto(DMM_URL!, { waitUntil: 'networkidle0' });
    
    // Click the "Login with Real Debrid" button
    console.log('Looking for Real Debrid login button...');
    const loginButton = await page.waitForSelector('button:has-text("Login with Real Debrid")', {
      visible: true,
      timeout: 10000
    });
    
    if (!loginButton) {
      throw new Error('Login button not found');
    }
    
    await loginButton.click();
    console.log('Clicked login button');

    // Wait for authentication to complete
    await setupAuth(page);
    
    // Wait for the page to be fully loaded after auth
    console.log('Waiting for page to load after auth...');
    await page.waitForNavigation({ waitUntil: 'networkidle0' });
    
    // Now look for the search input
    console.log('Waiting for search input...');
    const searchInput = await page.waitForSelector('input[placeholder="Search movies & shows..."]', {
      visible: true,
      timeout: 10000
    });
    
    if (!searchInput) {
      throw new Error('Search input not found');
    }

    // Type the search query
    await searchInput.type(title);
    
    // Click the search button
    console.log('Submitting search...');
    const searchButton = await page.waitForSelector('button[type="submit"]', {
      visible: true,
      timeout: 5000
    });
    
    if (!searchButton) {
      throw new Error('Search button not found');
    }
    await searchButton.click();

    // Wait for search results
    console.log('Waiting for search results...');
    await page.waitForSelector('.search-results', {
      visible: true,
      timeout: 10000
    });

    // Click the first result that matches our TMDB ID
    console.log('Looking for matching result...');
    const firstResult = await page.waitForSelector(`[data-tmdb-id="${tmdbId}"]`, {
      visible: true,
      timeout: 5000
    });

    if (!firstResult) {
      throw new Error('No matching search result found');
    }

    await firstResult.click();
    console.log(`Successfully triggered search for ${title} (TMDB ID: ${tmdbId})`);
  } catch (error: unknown) {
    console.error('Error during browser automation:', error);
    if (error instanceof Error) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  } finally {
    console.log('Closing browser page...');
    await page.close();
  }
}

app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const { notification_type, media, subject } = req.body;
  
  if (notification_type === 'MEDIA_AUTO_APPROVED' || notification_type === 'MEDIA_APPROVED') {
    console.log(`Processing ${notification_type} for media:`, media);
    try {
      await searchDMM(media.tmdbId, subject);
      res.status(200).json({ success: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error processing request:', errorMessage);
      res.status(500).json({ 
        error: 'Failed to process request',
        details: errorMessage 
      });
    }
  } else {
    console.log(`Ignoring notification of type: ${notification_type}`);
    res.status(200).json({ success: true });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DMM-Overseerr bridge listening on port ${PORT}`);
  console.log('Waiting for webhooks from Overseerr...');
});

// Cleanup on exit
process.on('SIGINT', async () => {
  if (browser) {
    await browser.close();
  }
  process.exit();
});