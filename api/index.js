import { Client, VideoLinks, getPublicToken } from 'kodikwrapper';

// Публичный токен из open-source проекта AnimeLib-Mobile
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

// Инициализируем клиент Kodik один раз
let kodikClient = null;
async function getKodikClient() {
  if (kodikClient) return kodikClient;
  const token = await getPublicToken();
  kodikClient = Client.fromToken(token);
  return kodikClient;
}

/**
 * Парсит ссылку Kodik-плеера и возвращает m3u8-ссылку через kodikwrapper.
 */
async function parseKodikLink(kodikUrl) {
  const client = await getKodikClient();

  // 1. Парсим ссылку, чтобы получить playerSingleUrl
  const parsedLink = await VideoLinks.parseLink({
    link: kodikUrl,
    extended: true,
  });

  if (!parsedLink.ex?.playerSingleUrl) {
    throw new Error('Не могу получить ссылку на чанк с плеером');
  }

  // 2. Получаем актуальный endpoint
  const endpoint = await VideoLinks.getActualVideoInfoEndpoint(
    parsedLink.ex.playerSingleUrl
  );

  // 3. Получаем ссылки
  const links = await VideoLinks.getLinks({
    link: kodikUrl,
    videoInfoEndpoint: endpoint,
  });

  // 4. Формируем результат
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

  const { path, kodik_url, ...query } = req.query;

  // Эндпоинт для парсинга Kodik-ссылки
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

  // Прокси к api.cdnlibs.org
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