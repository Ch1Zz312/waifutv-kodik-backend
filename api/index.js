// Vercel Serverless Function для WaifuTV
// Источник видео: AniLibria (anilibria.top)
// Работает без токена и без прокси

export const config = {
  runtime: 'nodejs',
};

const ANILIBRIA_API = 'https://anilibria.top/api/v1';

// === Кэш релизов в памяти функции (живёт между вызовами на тёплом инстансе) ===
const releaseCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 минут

/**
 * Поиск релиза на AniLibria по названию.
 * С кэшем: повторные запросы того же тайтла возвращаются мгновенно.
 */
async function findReleaseByTitle(title) {
  const key = title.toLowerCase().trim();
  const cached = releaseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    console.log('Cache hit for title:', title);
    return cached.release;
  }

  const url = `${ANILIBRIA_API}/anime/catalog/releases?search=${encodeURIComponent(title)}`;
  console.log('Searching AniLibria by title:', url);

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`AniLibria search returned ${res.status}`);
  }

  const json = await res.json();
  const list = json?.data;

  if (Array.isArray(list) && list.length > 0) {
    console.log(`Found ${list.length} releases, taking first:`, list[0]?.name?.main);
    releaseCache.set(key, { release: list[0], ts: Date.now() });
    return list[0];
  }

  return null;
}

/**
 * Получает полные данные релиза по его ID на AniLibria.
 * Возвращает объект с массивом episodes и HLS-ссылками.
 */
async function getReleaseDetails(releaseId) {
  const url = `${ANILIBRIA_API}/anime/releases/${releaseId}`;
  console.log('Getting release details:', url);

  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`AniLibria release details returned ${res.status}`);
  }

  return await res.json();
}

/**
 * Ищет нужный эпизод в списке и возвращает HLS-ссылку.
 * Приоритет: 1080p -> 720p -> 480p.
 */
function extractEpisodeUrl(release, episodeNumber) {
  const episodes = release?.episodes;
  if (!Array.isArray(episodes) || episodes.length === 0) {
    throw new Error('У релиза нет списка серий');
  }

  // Ищем эпизод по ordinal
  const ep = episodes.find(
    (e) => Number(e?.ordinal) === Number(episodeNumber)
  );

  if (!ep) {
    throw new Error(
      `Серия ${episodeNumber} не найдена (доступно: ${episodes.length})`
    );
  }

  const url1080 = ep.hls_1080;
  const url720 = ep.hls_720;
  const url480 = ep.hls_480;

  let url = null;
  let quality = null;

  if (url1080) {
    url = url1080;
    quality = 1080;
  } else if (url720) {
    url = url720;
    quality = 720;
  } else if (url480) {
    url = url480;
    quality = 480;
  }

  if (!url) {
    throw new Error('У серии нет доступных HLS-ссылок');
  }

  return {
    url,
    quality,
    qualities: {
      ...(url480 ? { '480': url480 } : {}),
      ...(url720 ? { '720': url720 } : {}),
      ...(url1080 ? { '1080': url1080 } : {}),
    },
    episodeName: ep.name || null,
    duration: ep.duration || null,
    preview: ep?.preview?.optimized?.src || ep?.preview?.src || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const query = Object.fromEntries(url.searchParams.entries());

  const { title, episode, release_id } = query;

  // === 1. Получение видео по названию + episode ===
  if (title) {
    try {
      console.log(`Searching AniLibria by title="${title}", episode=${episode || 1}`);

      const release = await findReleaseByTitle(title);

      if (!release) {
        return res.status(404).json({
          error: `Аниме "${title}" не найдено на AniLibria`,
        });
      }

      console.log(`Release found: ${release.name?.main} (id=${release.id})`);

      // Получаем полные данные релиза — там массив episodes с HLS-ссылками
      const details = await getReleaseDetails(release.id);

      const video = extractEpisodeUrl(details, episode || 1);

      console.log(`Video URL: ${video.url} (${video.quality}p)`);

      return res.status(200).json({
        url: video.url,
        quality: video.quality,
        qualities: video.qualities,
        source: 'anilibria',
        animeTitle: details.name?.main || release.name?.main || null,
        animeTitleEnglish:
          details.name?.english || release.name?.english || null,
        episodeNumber: Number(episode || 1),
        episodeName: video.episodeName,
        duration: video.duration,
        preview: video.preview,
        releaseId: release.id,
        releaseAlias: details.alias || release.alias || null,
      });
    } catch (e) {
      console.error('AniLibria video error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 2. Получение видео по release_id + episode (прямой путь) ===
  if (release_id) {
    try {
      const details = await getReleaseDetails(release_id);
      const video = extractEpisodeUrl(details, episode || 1);

      return res.status(200).json({
        url: video.url,
        quality: video.quality,
        qualities: video.qualities,
        source: 'anilibria',
        animeTitle: details.name?.main || null,
        animeTitleEnglish: details.name?.english || null,
        episodeNumber: Number(episode || 1),
        episodeName: video.episodeName,
        duration: video.duration,
        preview: video.preview,
        releaseId: details.id,
        releaseAlias: details.alias || null,
      });
    } catch (e) {
      console.error('AniLibria release error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // === 3. Health check / help ===
  return res.status(200).json({
    status: 'ok',
    service: 'WaifuTV backend (AniLibria)',
    endpoints: {
      video: '/api?title=Блич&episode=1',
      videoByRelease: '/api?release_id=8452&episode=1',
    },
  });
}