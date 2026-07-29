// NOMAD дүкенінің Telegram боты
// Клиенттің сұрағына Gemini AI арқылы жауап береді және тапсырысты қабылдайды

const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');

// Токен мен кілтті Railway-дегі "Variables" бөлімінен аламыз (кодтың ішіне жазбаймыз!)
const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error('Қате: BOT_TOKEN немесе GEMINI_API_KEY табылмады. Railway Variables бөлімін тексер.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Дүкен туралы негізгі ақпарат — Gemini осы ақпаратқа сүйеніп жауап береді
const STORE_INFO = `
Сен NOMAD дүкенінің сату-көмекшісісің. NOMAD — қалтаға сыятын блендер-бөтелке.
Баға: 12 990₸ (акциямен, әдеттегі бағасы 19 990₸).
Сыйымдылығы: 530 мл. Заряды: USB-C, 45 минутта толады, 15+ ұнтақтау циклі.
Жеткізу: Қазақстан бойынша 1-3 күн, тегін.
Кепілдік: 1 жыл. Кері қайтару: 14 күн ішінде.
Жауабың қысқа, дос сияқты, қазақ тілінде болсын. Клиент тапсырыс бергісі келсе,
атын, телефон нөмірін және жеткізу мекенжайын сұра.
`;

// Клиенттің хабарын Gemini API-ге жіберіп, жауап алу
async function askGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: `${STORE_INFO}\n\nКлиент жазды: "${userMessage}"\n\nЖауабың:` }]
        }
      ]
    })
  });

  const data = await response.json();

  if (data.candidates && data.candidates[0]) {
    return data.candidates[0].content.parts[0].text;
  }
  return 'Кешіріңіз, қазір жауап бере алмай тұрмын. Сәлден кейін қайта жазыңыз.';
}

// /start командасы — бот алғаш іске қосылғанда
bot.start((ctx) => {
  ctx.reply(
    'Сәлем! 👋 Мен NOMAD дүкенінің боты.\n\n' +
    'Қалтаға сыятын блендер-бөтелке туралы сұрағыңды жаз, немесе тікелей "тапсырыс бергім келеді" деп жаз.'
  );
});

// Кез келген мәтіндік хабарды Gemini арқылы өңдеу
bot.on('text', async (ctx) => {
  const userMessage = ctx.message.text;
  await ctx.sendChatAction('typing');

  try {
    const reply = await askGemini(userMessage);
    await ctx.reply(reply);
  } catch (err) {
    console.error(err);
    await ctx.reply('Қате шықты, сәлден кейін қайта көріңізші.');
  }
});

bot.launch();
console.log('NOMAD боты іске қосылды...');

// Railway/сервер дұрыс тоқтатылуы үшін
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
