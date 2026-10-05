import { Client, VideoLinks, getPublicToken } from 'kodikwrapper';

// Полный токен из твоего первого сообщения (AnimeLib-Mobile)
const FALLBACK_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIxIiwianRpIjoiOTZkYjliMDI4NGM0OWQ1Yzc2NTIxMzkxZTRlNDJkNjAwNTFmMDUzMDU2NjBjZGQzYTRjYmEzN2FjMmRmYTZhNjEyM2VmNDgxZDBjMGU0Y2MiLCJpYXQiOjE3NTc0MzEyNDcuOTg2MjE5LCJuYmYiOjE3NTc0MzEyNDcuOTg2MjIxLCJleHAiOjE3NjAwMjMyNDcuOTgyNTM3LCJzdWIiOiI5NDM5MzIxIiwic2NvcGVzIjpbXX0.FG2bBdeF0328Prrsr9Q_SL-VkQyeJMqE9b9uQ1E74JsCnJPveeMMLYNuJt_cTp5XpkvFK3XHltfCM7wi4Gg-x3rlpG-sTELMaoMNWv-4TmNcQbrKwSnTSVJfUFlnguVA7kpGHBgfAaL3NVKSwu_Pu1xqq6UwqpV9hBSJ6iTHG7T3vz7e_HxhGWQ7AZ47xmoo76aOnWQ2vIceF-zq6gF0peKBsHXuG8Prl-88xyltkT2SSnAJrTl4xmPQsM0F0OntkkFZGU6XPdFwXw-orxvtpCfsv556ra5fdbACMjqfZ3euwqXEHGRtkjMJpmku1-sV_xubQvCgbwuO8WRc-ukuWv3x2WTffkXypFKviEdNTXLBFki5ex4sblvaYhDUd4IrZwIjL-GRPQ9_X6WZITz7Lic5faKs1kr3mxXDSuK7u7tC2WSCom_I_CYR9_aIytJ_XkxixG-aa3LP9-jaOn0n7iZS8XNjaIlLHyqr2Of9wPvJ-A1NVv41EeaptXWs7VcSWg42-fUkofNyS2Qn1Qdo9DzVKmqzO9jMpe-8suwBVGl3gpr4nCwn4J8tIKOTzWX--xHkotH5w1TYaQAtzKs6ocyptylNdAD8WRm_FU3E3pdY5Ecarem7SK8ij5rh724GMiBXN9y9s6jBSwPoIAD9W-R4UoXo1mhsRNGiJ4EkC0U';

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
 */
async function findKodikLinkByShikimoriId(shikimoriId, episode = 1) {
  const client = await getKodikClient();

  const searchResult = await client.search({
    shikimori_id: shikimoriId,
  });

  console.log('Kodik search raw result:', JSON.stringify(searchResult).slice(0, 500));

  if (!searchResult?.results?.length) {
    throw new Error('Аниме не найдено в Kodik');
  }

  const anime = searchResult.results[0];
  console.log('Kodik anime keys:', Object.keys(anime));
  console.log('Kodik anime episodes type:', typeof anime.episodes, Array.isArray(anime.episodes));

  let episodeData = null;
  if (Array.isArray(anime.episodes)) {
    episodeData = anime.episodes[Number(episode) - 1] || anime.episodes[0];
  } else if (anime.episodes && typeof anime.episodes === 'object') {
    episodeData = anime.episodes[String(episode)] || anime.episodes['1'];
  }

  if (!episodeData) {
    throw new Error('Эпизод не найден');
  }

  // В зависимости от версии kodikwrapper поле может называться link или src
  const link = episodeData.link || episodeData.src;
  if (!link) {
    throw new Error('Не могу найти ссылку на плеер в эпизоде');
  }

  return link;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel кладёт путь в req.url, разбираем его вручную
  const url = new URL(req.url, `https://${req.headers.host}`);
  const pathStr = url.pathname.replace(/^\/api\/?/, ''); // убираем /api/
  const query = Object.fromEntries(url.searchParams.entries());

  const { kodik_url, shikimori_id, episode } = query;

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