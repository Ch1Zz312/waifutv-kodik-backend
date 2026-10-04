const Anime365Wrapper = require('anime365wrapper');
const api = new Anime365Wrapper.default ? new Anime365Wrapper.default() : new Anime365Wrapper();

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shikimori_id, episode = 1 } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // 1. Ищем сериал по Shikimori ID
    const seriesList = await api.getSeries({ query: String(shikimori_id) });

    if (!seriesList || seriesList.length === 0) {
      return res.status(404).json({
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено`,
      });
    }

    const series = seriesList[0];

    // 2. Получаем список серий
    const episodes = await api.getEpisodes({ series_id: series.id });

    if (!episodes || episodes.length === 0) {
      return res.status(404).json({ error: 'У сериала нет доступных серий' });
    }

    // 3. Берём нужную серию
    const epIndex = Math.max(0, Number(episode) - 1);
    const targetEpisode = episodes[epIndex] || episodes[0];

    // 4. Получаем переводы
    const translations = await api.getTranslations({
      episode_id: targetEpisode.id,
    });

    if (!translations || translations.length === 0) {
      return res.status(404).json({ error: 'Для этой серии нет переводов' });
    }

    // 5. Первый голосовой перевод
    const voiceTranslation =
      translations.find((t) => t.type === 'voiceRu') || translations[0];

    // 6. Получаем видео по ID перевода
    const video = await api.getVideoById(voiceTranslation.id);

    if (!video || !video.url) {
      return res.status(404).json({ error: 'Ссылка на видео не найдена' });
    }

    res.status(200).json({
      url: video.url,
      quality: video.quality || 720,
      animeTitle: series.title,
      translationName: voiceTranslation.author,
      totalEpisodes: episodes.length,
      currentEpisode: Number(episode),
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};