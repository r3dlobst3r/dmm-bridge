import express from 'express';
import * as puppeteer from 'puppeteer';

const app = express();
app.use(express.json());

const DMM_URL = process.env.DMM_URL;
const DMM_TOKEN = process.env.DMM_TOKEN;
const OVERSEERR_URL = process.env.OVERSEERR_URL;
const OVERSEERR_API_KEY = process.env.OVERSEERR_API_KEY;

if (!DMM_URL || !DMM_TOKEN || !OVERSEERR_URL || !OVERSEERR_API_KEY) {
  throw new Error('Missing required environment variables');
}

console.log('Starting DMM-Overseerr bridge with configuration:');
console.log(`DMM URL: ${DMM_URL}`);
console.log(`Overseerr URL: ${OVERSEERR_URL}`);

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

async function searchDMM(tmdbId: string, title: string) {
  console.log('Starting DMM search process...');
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  try {
    console.log(`Navigating to DMM: ${DMM_URL}`);
    const response = await page.goto(DMM_URL!, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    if (!response) {
      throw new Error('Failed to get response from DMM');
    }
    
    console.log('Looking for login button...');
    const submitButton = await page.waitForSelector('button[type="submit"]', {
      timeout: 5000
    }).catch(() => null);

    if (!submitButton) {
      console.log('Login button not found, attempting to proceed without login...');
    } else {
      console.log('Clicking login button...');
      await submitButton.click();
    }
    
    console.log('Setting authentication token...');
    const token = DMM_TOKEN!;
    await page.evaluate(`localStorage.setItem('token', '${token}')`);
    
    const searchUrl = `${DMM_URL}/search?tmdbId=${tmdbId}&title=${encodeURIComponent(title)}`;
    console.log(`Navigating to search: ${searchUrl}`);
    await page.goto(searchUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    console.log('Waiting for search results...');
    const searchResults = await page.waitForSelector('.search-results', {
      timeout: 5000
    }).catch(() => null);

    if (!searchResults) {
      console.log('Search results not found. Current URL:', page.url());
      console.log('Page content:', await page.content());
      throw new Error('Search results not found');
    }
    
    console.log('Clicking first search result...');
    const firstResult = await page.waitForSelector('.search-result-item', {
      timeout: 5000
    }).catch(() => null);

    if (!firstResult) {
      throw new Error('No search results found');
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