const api = require("anilibriajs-api");
const anilibriajs = new api.anilibria({});

async function testAnilibria() {
  try {
    console.log("Проверяю AniLibria...");
    const randomAnime = await anilibriajs.title.random({});
    
    console.log("Библиотека работает!");
    console.log("--- Структура ответа ---");
    console.log(JSON.stringify(randomAnime, null, 2).slice(0, 2000));
    
  } catch (error) {
    console.error("Ошибка при запросе:", error.message);
  }
}

testAnilibria();