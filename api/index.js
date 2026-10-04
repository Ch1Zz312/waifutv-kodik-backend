const ANILIBRIA_API = 'https://aniliberty.top/api/v1';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { title, shikimori_id, episode = 1 } = req.query;

  if (!title && !shikimori_id) {
    return res.status(400).json({ error: 'title or shikimori_id is required' });
  }

  try {
    const searchQuery = title || String(shikimori_id);
    const searchResp = await fetch(
      `${ANILIBRIA_API}/app/search/releases?search=${encodeURIComponent(searchQuery)}`
    );
    const searchData = await searchResp.json();

    if (!searchData || !Array.isArray(searchData) || searchData.length === 0) {
      return res.status(404).json({
        error: `Аниме "${searchQuery}" не найдено в AniLibria`,
      });
    }

    const release = searchData[0];
    const releaseId = release.id;

    const infoResp = await fetch(`${ANILIBRIA_API}/anime/releases/${releaseId}`);
    const infoData = await infoResp.json();

    if (!infoData || !infoData.episodes || infoData.episodes.length === 0) {
      return res.status(404).json({ error: 'У релиза нет доступных серий' });
    }

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