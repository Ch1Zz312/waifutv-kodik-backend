import { Client, VideoLinks, getPublicToken } from 'kodikwrapper';

// Публичный токен (можно оставить как fallback)
const FALLBACK_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...'; // ваш токен

const CDNLIB_HEADERS = {
  'Authorization': 'Bearer ' + FALLBACK_TOKEN,
  'Accept': '*/*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
  'Origin': 'https://animelib.org',
  'Referer': 'https://animelib.org/',
  'Site-Id': '5',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
};

let kodikClient = null;
async function getKodikClient() {
  if (kodikClient) return kodikClient;
  const token = await getPublicToken();
  kodikClient = Client.fromToken(token);
  return kodikClient;
}

/**
 * Парсит ссылку Kodik-плеера и возвращает m3u8-ссылки по качествам.
 */
async function parseKodikLink(kodikUrl) {
  const client = await getKodikClient();

  const parsedLink = await VideoLinks.parseLink({
    link: kodikUrl,
    extended: true,
  });

  if (!parsedLink.ex?.playerSingleUrl) {
    throw new Error('Не могу получить ссылку на чанк с плеером');
  }

  const endpoint = await VideoLinks.getActualVideoInfoEndpoint(
    parsedLink.ex.playerSingleUrl
  );

  const links = await VideoLinks.getLinks({
    link: kodikUrl,
    videoInfoEndpoint: endpoint,
  });

  const qualities = {};
  for (const [q, linkArray] of Object.entries(links)) {
    if (Array.isArray(linkArray) && linkArray.length > 0) {
      qualities[q] = linkArray[0].src;
    }
  }

  return {
    qualities,
    default: qualities['720'] || Object.values(qualities)[0],
  };
}

/**
 * Ищет аниме в Kodik по shikimori_id и возвращает ссылку на плеер.
 * Это нужно, потому что /video принимает shikimori_id, а не готовую ссылку Kodik.
 */
async function findKodikLinkByShikimoriId(shikimoriId, episode = 1) {
  const client = await getKodikClient();

  // Ищем по shikimori_id
  const searchResult = await client.search({
    shikimori_id: shikimoriId,
    // можно добавить limit, types и т.д.
  });

  if (!searchResult?.results?.length) {
    throw new Error('Аниме не найдено в Kodik');
  }

  const anime = searchResult.results[0];
  // Ищем нужный эпизод
  const episodeData = anime.episodes?.[episode] || anime.episodes?.['1'];
  if (!episodeData) {
    throw new Error('Эпизод не найден');
  }

  // episodeData.link — это ссылка на плеер Kodik
  return episodeData.link;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { path, kodik_url, shikimori_id, episode, ...query } = req.query;

  // === 1. Парсинг готовой Kodik-ссылки ===
  if (kodik_url) {
    try {
      console.log('Parsing Kodik URL via kodikwrapper:', kodik_url);
      const result = await parseKodikLink(kodik_url);
      return res.status(200).json(result);
    } catch (e) {
      console.error('Kodik parse error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 2. Получение видео по shikimori_id + episode ===
  if (shikimori_id) {
    try {
      console.log(`Searching Kodik for shikimori_id=${shikimori_id}, episode=${episode}`);
      const kodikPlayerUrl = await findKodikLinkByShikimoriId(
        shikimori_id,
        episode || 1
      );
      console.log('Found Kodik player URL:', kodikPlayerUrl);

      const result = await parseKodikLink(kodikPlayerUrl);
      return res.status(200).json({
        url: result.default,
        qualities: result.qualities,
        source: 'kodik',
      });
    } catch (e) {
      console.error('Kodik video error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 3. Прокси к api.cdnlibs.org (для метаданных) ===
  const pathStr = Array.isArray(path) ? path.join('/') : (path || '');
  const queryStr = new URLSearchParams(query).toString();
  const url = `https://api.cdnlibs.org/api/${pathStr}${queryStr ? '?' + queryStr : ''}`;

  console.log('Proxying to:', url);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: CDNLIB_HEADERS,
    });

    const text = await response.text();

    try {
      const json = JSON.parse(text);
      res.status(response.status).json(json);
    } catch (e) {
      res.status(response.status).send(text);
    }
  } catch (e) {
    console.error('Proxy error:', e.message);
    res.status(500).json({ error: e.message });
  }
}