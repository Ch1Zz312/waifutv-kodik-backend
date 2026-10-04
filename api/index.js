import { Client, VideoLinks } from 'kodikwrapper';

const KODIK_TOKEN = process.env.KODIK_TOKEN;

// Настраиваем домен плеера и endpoint один раз
VideoLinks.config({
  playerDomain: 'kodikplayer.com',
  videoInfoEndpoint: '/ftor',
});

let client = null;

function getClient() {
  if (client) return client;
  if (!KODIK_TOKEN) {
    throw new Error('KODIK_TOKEN не настроен в Environment Variables Vercel');
  }
  client = Client.fromToken(KODIK_TOKEN);
  return client;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shikimori_id, episode = 1, quality = 720 } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    const kodikClient = getClient();

    const searchResult = await kodikClient.search({
      shikimori_id: String(shikimori_id),
    });

    if (!searchResult?.results?.length) {
      return res.status(404).json({
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено в Kodik`,
      });
    }

    const anime = searchResult.results[0];
    
    // Ссылка уже должна работать, так как config задан
    const links = await VideoLinks.getLinks({ link: anime.link });

    const qualityKey = String(quality);
    if (!links?.[qualityKey]) {
      const available = links ? Object.keys(links).join(', ') : 'none';
      return res.status(404).json({
        error: `Качество ${quality}p не найдено. Доступно: ${available}`,
      });
    }

    res.status(200).json({
      url: links[qualityKey][0].src,
      quality: Number(quality),
      allQualities: Object.keys(links),
      animeTitle: anime.title,
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}