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

app.post('/webhook', async (req, res) => {
  const { notification, media } = req.body;
  
  if (notification.type === 'MEDIA_APPROVED') {
    try {
      // Handle movie requests
      if (media.mediaType === 'movie') {
        await axios.get(`${DMM_URL}/movie/${media.imdbId}`, {
          headers: {
            Authorization: `Bearer ${DMM_TOKEN}`
          }
        });
      }
      // Handle TV show requests
      else if (media.mediaType === 'tv') {
        await axios.get(`${DMM_URL}/show/${media.imdbId}`, {
          headers: {
            Authorization: `Bearer ${DMM_TOKEN}`
          }
        });
      }
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error processing webhook:', error);
      res.status(500).json({ error: 'Failed to process request' });
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`DMM-Overseerr bridge listening on port ${PORT}`);
});