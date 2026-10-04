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

  const { shikimori_id } = req.query;

  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // Получаем полную информацию о тайтле
    const info = await parser.getTitleInfo(String(shikimori_id));

    res.status(200).json({
      title: info.title,
      episodes: info.episodes,
      translationsCount: info.translations?.length || 0,
      translations: info.translations,
      availableSources: info.availableSources,
      kodikLinks: info.links?.kodik,
      aniboomLinks: info.links?.aniboom,
    });
  } catch (e) {
    res.status(500).json({ 
      error: e.message,
      stack: e.stack 
    });
  }
};