import aniparsec from 'aniparsec-ru';
const { AniParsec } = aniparsec;

const parser = new AniParsec({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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

    res.status(200).json({
      url: video.url,
      quality: Number(quality),
      allQualities: video.allQualities || {},
      animeTitle: video.title || '',
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}