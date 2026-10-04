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

/**
 * Парсит ссылку Kodik-плеера и возвращает m3u8-ссылку.
 * Использует логику из KodikLinksExtractor.java.
 */
async function parseKodikLink(kodikUrl) {
  // Убираем протокол и приводим к https
  let url = kodikUrl.startsWith('//') ? 'https:' + kodikUrl : kodikUrl;
  if (!url.startsWith('http')) url = 'https://' + url;

  // Извлекаем ID плеера из ссылки: /seria/1482403/hash/720p или /serial/6647/hash/720p
  const match = url.match(/\/(?:seria|serial|video)\/(\d+)\/([a-f0-9]+)\/(\d+)p/);
  if (!match) throw new Error('Не могу распарсить Kodik-ссылку: ' + url);

  const [, id, hash, quality] = match;

  // Загружаем страницу плеера, чтобы получить urlParams и videoInfoEndpoint
  const playerResp = await fetch(url, {
    headers: {
      'User-Agent': CDNLIB_HEADERS['User-Agent'],
      'Referer': 'https://animelib.org/',
    },
  });
  const html = await playerResp.text();

  // Ищем urlParams (обычно в JSON внутри скрипта)
  const urlParamsMatch = html.match(/urlParams\s*[:=]\s*(\{[^}]+\})/);
  if (!urlParamsMatch) throw new Error('urlParams не найдены в плеере');

  const urlParams = JSON.parse(urlParamsMatch[1]);

  // Ищем videoInfoEndpoint (путь типа /ftor или /gvi)
  const endpointMatch = html.match(/videoInfoEndpoint\s*[:=]\s*['"]([^'"]+)['"]/);
  const videoInfoEndpoint = endpointMatch ? endpointMatch[1] : '/ftor';

  // Формируем запрос к API Kodik для получения ссылок
  const apiUrl = `https://kodik-api.com${videoInfoEndpoint}`;
  const body = new URLSearchParams({
    ...urlParams,
    'd': 'kodikplayer.com',
    'is_video': 'false',
  });

  const apiResp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'User-Agent': CDNLIB_HEADERS['User-Agent'],
      'Referer': url,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  const apiData = await apiResp.json();

  if (!apiData || !apiData.links) {
    throw new Error('Kodik API не вернул ссылки');
  }

  // Возвращаем все качества
  const qualities = {};
  for (const [q, links] of Object.entries(apiData.links)) {
    if (Array.isArray(links) && links.length > 0) {
      qualities[q] = links[0].src.startsWith('//') ? 'https:' + links[0].src : links[0].src;
    }
  }

  return {
    qualities,
    default: qualities[quality] || Object.values(qualities)[0],
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
      console.log('Parsing Kodik URL:', kodik_url);
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