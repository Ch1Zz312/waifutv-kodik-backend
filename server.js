import express from 'express';
import cors from 'cors';
import { Client, VideoLinks, getPublicToken } from 'kodikwrapper';

const app = express();
app.use(cors());

// Переменная для хранения токена
let KODIK_TOKEN = null;

// Функция для получения токена
async function ensureToken() {
  if (KODIK_TOKEN) return KODIK_TOKEN;
  
  try {
    console.log('Trying auto token from player script...');
    // Пытаемся получить токен автоматически
    KODIK_TOKEN = await getPublicToken();
    console.log('Token received automatically:', KODIK_TOKEN ? 'OK' : 'FAIL');
    return KODIK_TOKEN;
  } catch (e) {
    console.error('Auto token failed:', e.message);
    throw new Error('Could not get Kodik token automatically');
  }
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WaifuTV Kodik Backend v3' });
});

app.get('/video', async (req, res) => {
  const { shikimori_id, episode = 1, quality = 720 } = req.query;
  
  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    // 1. Получаем токен
    const token = await ensureToken();
    
    // 2. Создаём клиент с токеном
    const client = Client.fromToken(token);
    
    // 3. Ищем аниме по Shikimori ID
    const searchResult = await client.search({
      shikimori_id: String(shikimori_id),
    });
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return res.status(404).json({ 
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено в Kodik` 
      });
    }
    
    const anime = searchResult.results[0];
    console.log('Found anime:', anime.title, 'Link:', anime.link);
    
    // 4. Получаем ссылки на видео из страницы плеера
    const links = await VideoLinks.getLinks({
      link: anime.link,
    });
    
    // 5. Выбираем нужное качество
    const qualityKey = String(quality);
    if (!links || !links[qualityKey]) {
      const available = links ? Object.keys(links).join(', ') : 'none';
      return res.status(404).json({ 
        error: `Качество ${quality}p не найдено. Доступно: ${available}` 
      });
    }
    
    // 6. Возвращаем ссылку
    res.json({
      url: links[qualityKey][0].src,
      quality: Number(quality),
      allQualities: Object.keys(links),
      animeTitle: anime.title,
    });
    
  } catch (e) {
    console.error('Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));