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
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });
  }
  return browser;
}

async function searchDMM(tmdbId: string, title: string) {
  const browser = await initBrowser();
  const page = await browser.newPage();
  
  try {
    // Navigate to DMM
    await page.goto(DMM_URL);
    
    // Wait for and click the login button (you'll need to adjust these selectors)
    await page.waitForSelector('button[type="submit"]');
    await page.click('button[type="submit"]');
    
    // Set the auth token (you might need to adjust this based on DMM's authentication method)
    await page.evaluate((authToken: string) => {
      localStorage.setItem('token', authToken);
    }, DMM_TOKEN);
    
    // Navigate to search with the TMDB ID
    await page.goto(`${DMM_URL}/search?tmdbId=${tmdbId}&title=${encodeURIComponent(title)}`);
    
    // Wait for search results and click the first result (adjust selectors as needed)
    await page.waitForSelector('.search-results');
    await page.click('.search-result-item');
    
    console.log(`Successfully triggered search for ${title} (TMDB ID: ${tmdbId})`);
  } catch (error: unknown) {
    console.error('Error during browser automation:', error);
    throw error;
  } finally {
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