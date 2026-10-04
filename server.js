import express from 'express';
import cors from 'cors';
import { AniParsec } from 'aniparsec-ru';

const app = express();
app.use(cors());

// Создаём парсер с явным User-Agent
const parser = new AniParsec({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WaifuTV Kodik Backend v6' });
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
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    res.json({
      url: video.url,
      quality: Number(quality),
      allQualities: video.allQualities || {},
      animeTitle: video.title || '',
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));