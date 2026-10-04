import express from 'express';
import cors from 'cors';
// Импортируем нужные классы из kodikwrapper
import { Client, getPublicToken, VideoLinks } from 'kodikwrapper';

const app = express();
app.use(cors());
app.use(express.json());

// Токен и клиент будут храниться здесь
let client = null;

// Функция для получения клиента с токеном
async function getClient() {
  if (client) return client;

  try {
    console.log('Attempting to get public token from Kodik...');
    // Эта функция сама находит актуальный токен
    const token = await getPublicToken();
    console.log('Token received successfully!');

    // Создаем клиент с этим токеном
    client = Client.fromToken(token);
    return client;
  } catch (error) {
    console.error('Failed to get token:', error);
    throw new Error('Could not obtain Kodik token');
  }
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WaifuTV Kodik Backend' });
});

app.get('/video', async (req, res) => {
  const { shikimori_id, episode = 1, quality = 720 } = req.query;
  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    const kodikClient = await getClient();

    // 1. Ищем аниме по Shikimori ID
    const searchResult = await kodikClient.search({
      shikimori_id: String(shikimori_id),
    });

    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return res.status(404).json({
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено в Kodik`
      });
    }

    // Берем первый результат
    const anime = searchResult.results[0];

    // 2. Получаем ссылки на видео для конкретной серии
    const links = await VideoLinks.getLinks({
      link: anime.link, // Ссылка на страницу плеера из результата поиска
    });

    // Проверяем, есть ли нужное качество
    if (!links || !links[quality]) {
      return res.status(404).json({
        error: `Качество ${quality}p не найдено. Доступные: ${Object.keys(links || {}).join(', ')}`
      });
    }

    // 3. Возвращаем результат
    res.json({
      url: links[quality][0].src, // Берем первую ссылку из массива
      quality: Number(quality),
      allQualities: Object.keys(links),
      animeTitle: anime.title,
    });

  } catch (e) {
    console.error('Error in /video:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));