import { AniParsec } from 'aniparsec-ru';

const parser = new AniParsec({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shikimori_id, episode = 1 } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // getVideo автоматически пробует Kodik, потом Aniboom [citation:1][citation:6]
    const video = await parser.getVideo({
      shikimoriId: String(shikimori_id),
      episode: Number(episode),
      quality: 720,
    });

    if (!video || !video.url) {
      return res.status(404).json({ error: 'Видео не найдено' });
    }

    res.status(200).json({
      url: video.url,
      quality: video.quality || 720,
      source: video.source || 'kodik',
      animeTitle: video.title || '',
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}