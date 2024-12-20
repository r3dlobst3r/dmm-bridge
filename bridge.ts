import express from 'express';
import axios from 'axios';

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

app.post('/webhook', async (req, res) => {
  console.log('Received webhook:', JSON.stringify(req.body, null, 2));
  const { notification_type, media, subject } = req.body;
  
  if (notification_type === 'MEDIA_AUTO_APPROVED' || notification_type === 'MEDIA_APPROVED') {
    console.log(`Processing ${notification_type} for media:`, media);
    try {
      // Since there's no official API, we'll need to simulate a browser request
      const searchParams = new URLSearchParams({
        tmdbId: media.tmdbId,
        title: subject
      });

      console.log(`Attempting to access DMM at: ${DMM_URL}/search?${searchParams}`);
      
      // Note: This might not work since DMM likely requires authentication
      const response = await axios.get(`${DMM_URL}/search?${searchParams}`, {
        headers: {
          'Authorization': `Bearer ${DMM_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('DMM Response:', response.data);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error accessing DMM:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Failed to process request',
        details: error.response?.data || error.message 
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