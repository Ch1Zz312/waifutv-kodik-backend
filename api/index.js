import { VideoLinks } from 'kodikwrapper';

// API-ключ Kodik (получен через get_token.py)
const KODIK_API_KEY = '56a768d08f43091901c44b54fe970049';

// Токен для cdnlibs (для прокси метаданных)
const CDNLIB_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOTZkYjliMDI4NGM0OWQ1Yzc2NTIxMzkxZTRlNDJkNjAwNTFmMDUzMDU2NjBjZGQzYTRjYmEzN2FjMmRmYTZhNjEyM2VmNDgxZDBjMGU0Y2MiLCJpYXQiOjE3NTc0MzEyNDcuOTg2MjE5LCJuYmYiOjE3NTc0MzEyNDcuOTg2MjIxLCJleHAiOjE3NjAwMjMyNDcuOTgyNTM3LCJzdWIiOiI5NDM5MzIxIiwic2NvcGVzIjpbXX0.FG2bBdeF0328Prrsr9Q_SL-VkQyeJMqE9b9uQ1E74JsCnJPveeMMLYNuJt_cTp5XpkvFK3XHltfCM7wi4Gg-x3rlpG-sTELMaoMNWv-4TmNcQbrKwSnTSVJfUFlnguVA7kpGHBgfAaL3NVKSwu_Pu1xqq6UwqpV9hBSJ6iTHG7T3vz7e_HxhGWQ7AZ47xmoo76aOnWQ2vIceF-zq6gF0peKBsHXuG8Prl-88xyltkT2SSnAJrTl4xmPQsM0F0OntkkFZGU6XPdFwXw-orxvtpCfsv556ra5fdbACMjqfZ3euwqXEHGRtkjMJpmku1-sV_xubQvCgbwuO8WRc-ukuWv3x2WTffkXypFKviEdNTXLBFki5ex4sblvaYhDUd4IrZwIjL-GRPQ9_X6WZITz7Lic5faKs1kr3mxXDSuK7u7tC2WSCom_I_CYR9_aIytJ_XkxixG-aa3LP9-jaOn0n7iZS8XNjaIlLHyqr2Of9wPvJ-A1NVv41EeaptXWs7VcSWg42-fUkofNyS2Qn1Qdo9DzVKmqzO9jMpe-8suwBVGl3gpr4nCwn4J8tIKOTzWX--xHkotH5w1TYaQAtzKs6ocyptylNdAD8WRm_FU3E3pdY5Ecarem7SK8ij5rh724GMiBXN9y9s6jBSwPoIAD9W-R4UoXo1mhsRNGiJ4EkC0U';

const CDNLIB_HEADERS = {
  'Authorization': 'Bearer ' + CDNLIB_TOKEN,
  'Accept': '*/*',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Content-Type': 'application/json',
  'Origin': 'https://animelib.org',
  'Referer': 'https://animelib.org/',
  'Site-Id': '5',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; SM-G998B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
};

/**
 * Ищет аниме в Kodik по shikimori_id через публичный API по ключу.
 * Возвращает массив результатов с переводами и ссылками на серии.
 */
async function searchKodik(shikimoriId) {
  const url = `https://kodik-api.com/search?token=${KODIK_API_KEY}&shikimori_id=${shikimoriId}&with_episodes=true&limit=50`;
  console.log('Kodik search URL:', url);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Kodik API вернул ${response.status}`);
  }

  const data = await response.json();
  console.log('Kodik search total:', data.total);
  return data.results || [];
}

/**
 * Достаёт ссылку на плеер для нужной серии из результата поиска.
 * Приоритет: 720p, затем любое доступное качество.
 */
function extractEpisodeLink(anime, episode) {
  const episodes = anime.seasons?.['1']?.episodes;
  if (!episodes) {
    throw new Error('У аниме нет списка серий');
  }

  const epNum = String(episode || 1);
  const link = episodes[epNum];
  if (!link) {
    throw new Error(`Серия ${epNum} не найдена (доступно: ${Object.keys(episodes).length})`);
  }

  return link;
}

/**
 * Парсит ссылку Kodik-плеера в прямую m3u8 через VideoLinks.
 */
async function parseKodikLink(kodikUrl) {
  // Kodik возвращает ссылку с // в начале — добавляем https:
  const fullUrl = kodikUrl.startsWith('//') ? `https:${kodikUrl}` : kodikUrl;

  const parsedLink = await VideoLinks.parseLink({
    link: fullUrl,
    extended: true,
  });

  if (!parsedLink.ex?.playerSingleUrl) {
    throw new Error('Не могу получить ссылку на чанк с плеером');
  }

  const endpoint = await VideoLinks.getActualVideoInfoEndpoint(
    parsedLink.ex.playerSingleUrl
  );

  const links = await VideoLinks.getLinks({
    link: fullUrl,
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathStr = url.pathname.replace(/^\/api\/?/, '');
  const query = Object.fromEntries(url.searchParams.entries());

  const { kodik_url, shikimori_id, episode } = query;

  // === 1. Парсинг готовой Kodik-ссылки ===
  if (kodik_url) {
    try {
      console.log('Parsing Kodik URL:', kodik_url);
      const result = await parseKodikLink(kodik_url);
      return res.status(200).json(result);
    } catch (e) {
      console.error('Kodik parse error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 2. Видео по shikimori_id + episode ===
  if (shikimori_id) {
    try {
      console.log(`Searching Kodik for shikimori_id=${shikimori_id}, episode=${episode}`);
      const results = await searchKodik(shikimori_id);

      if (!results.length) {
        return res.status(404).json({ error: 'Аниме не найдено в Kodik' });
      }

      // Берём первый результат (обычно 2x2 или AniDUB — самые полные)
      const anime = results[0];
      console.log('Chosen anime:', anime.title, '| translation:', anime.translation?.title, '| episodes:', anime.episodes_count);

      const episodeLink = extractEpisodeLink(anime, episode || 1);
      console.log('Episode link:', episodeLink);

      const parsed = await parseKodikLink(episodeLink);
      return res.status(200).json({
        url: parsed.default,
        qualities: parsed.qualities,
        source: 'kodik',
        translation: anime.translation?.title,
      });
    } catch (e) {
      console.error('Kodik video error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 3. Прокси к api.cdnlibs.org ===
  const queryStr = url.searchParams.toString();
  const cdnUrl = `https://api.cdnlibs.org/api/${pathStr}${queryStr ? '?' + queryStr : ''}`;

  console.log('Proxying to:', cdnUrl);

  try {
    const response = await fetch(cdnUrl, {
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