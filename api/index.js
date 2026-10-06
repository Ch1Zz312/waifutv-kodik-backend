import { createParser, KodikParser } from '@aerosstube/anime-parser-kodik-ts';

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

let parser = null;

// Попробуем создать парсер двумя способами
async function getParser() {
  if (parser) return parser;

  // Способ 1: автоматическое получение токена
  try {
    parser = await createParser();
    console.log('Parser created via createParser() (auto token)');
    return parser;
  } catch (e) {
    console.log('createParser() failed:', e.message);
  }

  // Способ 2: явная передача токена
  try {
    parser = new KodikParser(CDNLIB_TOKEN);
    console.log('Parser created via new KodikParser(token)');
    return parser;
  } catch (e) {
    console.log('new KodikParser(token) failed:', e.message);
  }

  throw new Error('Не удалось создать парсер Kodik ни одним способом');
}

async function fetchVideo(shikimoriId, episode = 1) {
  const p = await getParser();

  console.log(`Searching Kodik for shikimori_id=${shikimoriId}, episode=${episode}`);

  // 1. Ищем аниме по shikimori_id
  const results = await p.searchById(String(shikimoriId), 'shikimori');

  if (!results || results.length === 0) {
    throw new Error('Аниме не найдено в Kodik');
  }

  const anime = results[0];
  const kodikId = anime.id || anime.kodikId;
  const translationId = anime.translation?.id || anime.translationId;

  console.log(`Found Kodik ID: ${kodikId}, translation: ${translationId}`);

  if (!kodikId) {
    throw new Error('Не удалось получить внутренний ID Kodik');
  }

  // 2. Получаем ссылку на видео
  const [link, quality] = await p.getLink(
    String(kodikId),
    'kodik',
    Number(episode),
    translationId ? String(translationId) : undefined
  );

  if (!link) {
    throw new Error('Не удалось получить ссылку на видео');
  }

  console.log(`Video quality: ${quality}`);
  console.log(`URL: ${link}`);

  return {
    url: link,
    quality: quality,
    source: 'kodik',
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

  const { shikimori_id, episode } = query;

  if (shikimori_id) {
    try {
      const result = await fetchVideo(shikimori_id, episode || 1);
      return res.status(200).json({
        url: result.url,
        quality: result.quality,
        source: result.source,
      });
    } catch (e) {
      console.error('Video fetch error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

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