import { Client, VideoLinks } from 'kodikwrapper';

const KODIK_TOKEN = process.env.KODIK_TOKEN;

let client = null;

function getClient() {
  if (client) return client;
  client = Client.fromToken(KODIK_TOKEN);
  return client;
}

// Функция, которая сначала находит актуальный endpoint, потом получает ссылки
async function getLinksWithActualEndpoint(link) {
  // 1. Парсим ссылку, чтобы получить URL чанка с плеером
  const parsedLink = await VideoLinks.parseLink({
    link,
    extended: true,
  });

  if (!parsedLink.ex?.playerSingleUrl) {
    throw new Error('Не могу получить ссылку на чанк с плеером');
  }

  // 2. Получаем АКТУАЛЬНЫЙ endpoint
  const endpoint = await VideoLinks.getActualVideoInfoEndpoint(
    parsedLink.ex.playerSingleUrl
  );

  // 3. Получаем ссылки с правильным endpoint
  return await VideoLinks.getLinks({
    link,
    videoInfoEndpoint: endpoint,
  });
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
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено`,
      });
    }

    const anime = searchResult.results[0];

    // Используем функцию с актуальным endpoint
    const links = await getLinksWithActualEndpoint(anime.link);

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