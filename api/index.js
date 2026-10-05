import pkg from 'aniparsec-ru';
const { AniParsec } = pkg;

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

// Инициализируем парсер один раз
let parser = null;
function getParser() {
  if (parser) return parser;
  parser = new AniParsec();
  return parser;
}

/**
 * Получает видео по shikimori_id и episode с автоматическим fallback Kodik -> Aniboom.
 */
async function fetchVideo(shikimoriId, episode = 1) {
  const p = getParser();

  console.log(`Fetching video: shikimori_id=${shikimoriId}, episode=${episode}`);

  // aniparsec-ru сам пробует Kodik -> Aniboom и делает retry
  const video = await p.getVideo({
    shikimoriId: String(shikimoriId),
    episode: Number(episode) || 1,
  });

  if (!video || !video.url) {
    throw new Error('Не удалось получить ссылку на видео ни с одного источника');
  }

  console.log(`Video source: ${video.source}, quality: ${video.quality}`);
  console.log(`URL: ${video.url}`);

  return {
    url: video.url,
    quality: video.quality,
    source: video.source,
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

  // === 1. Получение видео по shikimori_id + episode (с fallback) ===
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

  // === 2. Прокси к api.cdnlibs.org (для метаданных) ===
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
