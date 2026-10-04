const ANILIBRIA_API = 'https://aniliberty.top/api/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shikimori_id, episode = 1 } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // 1. Ищем релиз по Shikimori ID
    const searchResp = await fetch(
      `${ANILIBRIA_API}/app/search/releases?search=${shikimori_id}`
    );
    const searchData = await searchResp.json();

    if (!searchData || !Array.isArray(searchData) || searchData.length === 0) {
      return res.status(404).json({
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено в AniLibria`,
      });
    }

    const release = searchData[0];
    const releaseId = release.id;

    // 2. Получаем список серий
    const infoResp = await fetch(`${ANILIBRIA_API}/anime/releases/${releaseId}`);
    const infoData = await infoResp.json();

    if (!infoData || !infoData.episodes || infoData.episodes.length === 0) {
      return res.status(404).json({ error: 'У релиза нет доступных серий' });
    }

    // 3. Берём нужную серию
    const epIndex = Math.max(0, Number(episode) - 1);
    const ep = infoData.episodes[epIndex] || infoData.episodes[0];

    const url = ep.hls_720 || ep.hls_1080 || ep.hls_480 || ep.hls_360;

    if (!url) {
      return res.status(404).json({ error: 'Нет доступных HLS-ссылок' });
    }

    res.status(200).json({
      url: url,
      quality: ep.hls_720 ? 720 : (ep.hls_1080 ? 1080 : 480),
      animeTitle: release.name?.main || release.name?.english || '',
      totalEpisodes: infoData.episodes.length,
      currentEpisode: Number(episode),
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
}