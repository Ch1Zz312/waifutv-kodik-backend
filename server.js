import express from 'express';
import cors from 'cors';
import { Client, VideoLinks } from 'kodikwrapper';

const app = express();
app.use(cors());

// Токен можно получить автоматически при старте
let client = null;

async function getClient() {
  if (client) return client;
  
  // Получаем публичный токен
  const token = await Client.getPublicToken();
  console.log('Kodik token received:', token ? 'OK' : 'FAIL');
  
  client = Client.fromToken(token);
  return client;
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
    
    if (!searchResult?.results?.length) {
      return res.status(404).json({ 
        error: `Аниме с Shikimori ID ${shikimori_id} не найдено` 
      });
    }
    
    const anime = searchResult.results[0];
    console.log('Found:', anime.title, 'Link:', anime.link);
    
    // 2. Получаем ссылки с автоматическим определением endpoint
    const parsedLink = await VideoLinks.parseLink({
      link: anime.link,
      extended: true,
    });
    
    if (!parsedLink.ex?.playerSingleUrl) {
      return res.status(500).json({ error: 'Не удалось получить ссылку на плеер' });
    }
    
    const endpoint = await VideoLinks.getActualVideoInfoEndpoint(
      parsedLink.ex.playerSingleUrl
    );
    
    const links = await VideoLinks.getLinks({
      link: anime.link,
      videoInfoEndpoint: endpoint,
    });
    
    // 3. Выбираем нужное качество
    const qualityKey = String(quality);
    if (!links?.[qualityKey]) {
      const available = links ? Object.keys(links).join(', ') : 'none';
      return res.status(404).json({ 
        error: `Качество ${quality}p не найдено. Доступно: ${available}` 
      });
    }
    
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