const { AniParsec } = require('aniparsec-ru');

const KODIK_TOKEN = process.env.KODIK_TOKEN;

const parser = new AniParsec({
  kodikToken: KODIK_TOKEN,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { shikimori_id, episode = 1, quality = 720, translation_id } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // 1. Получаем инфо о тайтле — там есть список переводов
    const info = await parser.getTitleInfo(String(shikimori_id));

    if (!info || !info.translations || info.translations.length === 0) {
      return res.status(404).json({
        error: `Переводы для Shikimori ID ${shikimori_id} не найдены`,
      });
    }

    // 2. Выбираем перевод:
    //    - если передан translation_id — используем его
    //    - иначе берём первый голосовой (voice)
    let translationId;
    if (translation_id) {
      translationId = Number(translation_id);
    } else {
      const voiceTranslations = info.translations.filter(
        (t) => t.type === 'voice'
      );
      const chosen = voiceTranslations[0] || info.translations[0];
      translationId = chosen.id;
    }

    console.log('Using translationId:', translationId);

    // 3. Получаем видео с явным translationId
    const video = await parser.getVideo({
      shikimoriId: String(shikimori_id),
      episode: Number(episode),
      quality: Number(quality),
      translationId: translationId,
    });

    if (!video || !video.url) {
      return res.status(404).json({
        error: `Видео для Shikimori ID ${shikimori_id} не найдено (перевод ${translationId})`,
        translationsCount: info.translations.length,
      });
    }

    res.status(200).json({
      url: video.url,
      quality: video.quality || Number(quality),
      source: video.source || 'kodik',
      animeTitle: video.title || info.title,
      translationId: translationId,
      totalEpisodes: info.episodes,
    });
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
};