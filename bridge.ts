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
  console.log('Received webhook:', req.body);
  const { notification, media } = req.body;
  
  if (notification.type === 'MEDIA_APPROVED') {
    console.log(`Processing approved ${media.mediaType}: ${media.imdbId}`);
    try {
      // Handle movie requests
      if (media.mediaType === 'movie') {
        console.log(`Sending movie request to DMM for IMDB ID: ${media.imdbId}`);
        await axios.get(`${DMM_URL}/movie/${media.imdbId}`, {
          headers: {
            Authorization: `Bearer ${DMM_TOKEN}`
          }
        });
      }
      // Handle TV show requests
      else if (media.mediaType === 'tv') {
        console.log(`Sending TV show request to DMM for IMDB ID: ${media.imdbId}`);
        await axios.get(`${DMM_URL}/show/${media.imdbId}`, {
          headers: {
            Authorization: `Bearer ${DMM_TOKEN}`
          }
        });
      }
      
      console.log('Successfully processed request');
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  } else {
    console.log(`Ignoring notification of type: ${notification.type}`);
    res.status(200).json({ success: true });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DMM-Overseerr bridge listening on port ${PORT}`);
  console.log('Waiting for webhooks from Overseerr...');
});