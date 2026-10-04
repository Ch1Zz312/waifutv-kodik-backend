import express from 'express';
import cors from 'cors';
import { AniParsec } from 'aniparsec-ru';

const app = express();
app.use(cors());
app.use(express.json());

const parser = new AniParsec();

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WaifuTV Kodik Backend' });
});

app.get('/video', async (req, res) => {
  const { shikimori_id, episode = 1, quality = 720 } = req.query;
  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    const video = await parser.getVideo({
      shikimoriId: String(shikimori_id),
      episode: Number(episode),
      quality: Number(quality),
    });
    if (!video || !video.url) {
      return res.status(404).json({ error: 'Video not found' });
    }
    res.json({
      url: video.url,
      quality: video.quality,
      translation: video.translation?.title || 'unknown',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));