import express from 'express';
import cors from 'cors';
import { Client, getPublicToken } from 'kodikwrapper';

const app = express();
app.use(cors());
app.use(express.json());

// Кэшируем токен и клиент
let client = null;
let token = null;

async function getClient() {
  if (client) return client;
  console.log('Getting public token from Kodik...');
  token = await getPublicToken();
  console.log('Token received:', token ? 'OK' : 'FAIL');
  client = Client.fromToken(token);
  return client;
}

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'WaifuTV Kodik Backend v2' });
});

app.get('/video', async (req, res) => {
  const { shikimori_id, episode = 1, quality = 720 } = req.query;
  if (!shikimori_id) {
    return res.status(400).json({ error: 'shikimori_id is required' });
  }

  try {
    const c = await getClient();
    
    // Поиск аниме по Shikimori ID
    const searchResult = await c.search({
      shikimori_id: String(shikimori_id),
    });
    
    if (!searchResult || !searchResult.results || searchResult.results.length === 0) {
      return res.status(404).json({ 
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено в Kodik` 
      });
    }

    const anime = searchResult.results[0];
    
    // Получаем ссылки на видео
    const links = await c.getLinks({
      id: anime.id,
      episode: Number(episode),
      quality: Number(quality),
    });

    if (!links || !links[quality]) {
      return res.status(404).json({ 
        error: `Качество ${quality}p не найдено. Доступные: ${Object.keys(links).join(', ')}` 
      });
    }

    res.json({
      url: links[quality],
      quality: Number(quality),
      allQualities: links,
      animeTitle: anime.title,
    });
  } catch (e) {
    console.error('Error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));