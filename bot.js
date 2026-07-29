// NOMAD дүкенінің Telegram боты (v2)
// Батырмалар арқылы тапсырыс қабылдайды, еркін сұрақтарға Gemini AI арқылы жауап береді

const { Telegraf, Markup } = require('telegraf');
const fetch = require('node-fetch');

const BOT_TOKEN = process.env.BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!BOT_TOKEN || !GEMINI_API_KEY) {
  console.error('Қате: BOT_TOKEN немесе GEMINI_API_KEY табылмады. Railway Variables бөлімін тексер.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Әр қолданушының тапсырыс беру барысын жадта сақтау (қарапайым нұсқа)
// Кілт — телеграм user id, мән — {step, name, phone, address}
const orderSessions = new Map();

const STORE_INFO = `
Сен NOMAD дүкенінің сату-көмекшісісің. NOMAD — қалтаға сыятын блендер-бөтелке.
Баға: 12 990₸ (акциямен, әдеттегі бағасы 19 990₸).
Сыйымдылығы: 530 мл. Заряды: USB-C, 45 минутта толады, 15+ ұнтақтау циклі.
Жеткізу: Қазақстан бойынша 1-3 күн, тегін.
Кепілдік: 1 жыл. Кері қайтару: 14 күн ішінде.
Жауабың қысқа, дос сияқты, қазақ тілінде болсын.
`;

async function askGemini(userMessage) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `${STORE_INFO}\n\nКлиент жазды: "${userMessage}"\n\nЖауабың:` }] }]
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API қатесі:', response.status, errText);
    return 'Кешіріңіз, қазір жауап бере алмай тұрмын. Сәлден кейін қайта жазыңыз.';
  }

  const data = await response.json();
  if (data.candidates && data.candidates[0]) {
    return data.candidates[0].content.parts[0].text;
  }
  console.error('Gemini жауабы бос:', JSON.stringify(data));
  return 'Кешіріңіз, қазір жауап бере алмай тұрмын. Сәлден кейін қайта жазыңыз.';
}

// Негізгі мәзір батырмалары
const mainMenu = Markup.inlineKeyboard([
  [Markup.button.callback('🛒 Тапсырыс беру', 'order_start')],
  [Markup.button.callback('❓ Сұрақ қою', 'ask_question')]
]);

bot.start((ctx) => {
  orderSessions.delete(ctx.from.id);
  ctx.reply(
    'Сәлем! 👋 Мен NOMAD дүкенінің боты.\n\n' +
    'Қалтаға сыятын блендер-бөтелке — 12 990₸.\n' +
    'Не істегің келеді?',
    mainMenu
  );
});

// "Тапсырыс беру" батырмасы басылғанда
bot.action('order_start', (ctx) => {
  orderSessions.set(ctx.from.id, { step: 'name' });
  ctx.answerCbQuery();
  ctx.reply('Тамаша! Алдымен атыңызды жазыңызшы:');
});

// "Сұрақ қою" батырмасы басылғанда
bot.action('ask_question', (ctx) => {
  orderSessions.delete(ctx.from.id);
  ctx.answerCbQuery();
  ctx.reply('Сұрағыңызды жаза беріңіз, мен жауап беремін 🙂');
});

// Кез келген мәтіндік хабар
bot.on('text', async (ctx) => {
  const userId = ctx.from.id;
  const session = orderSessions.get(userId);
  const text = ctx.message.text;

  // Егер қолданушы тапсырыс беру процесінде болса — сол қадамды жалғастырамыз
  if (session) {
    if (session.step === 'name') {
      session.name = text;
      session.step = 'phone';
      return ctx.reply('Рахмет! Енді телефон нөміріңізді жазыңыз (мыс. +7 707 123 45 67):');
    }
    if (session.step === 'phone') {
      session.phone = text;
      session.step = 'address';
      return ctx.reply('Жеткізу мекенжайын жазыңыз (қала, көше, үй нөмірі):');
    }
    if (session.step === 'address') {
      session.address = text;
      orderSessions.delete(userId);
      // Мұнда кейін тапсырысты Google Sheets-ке немесе өз чатыңа жіберуге болады
      return ctx.reply(
        `Тапсырысыңыз қабылданды! ✅\n\n` +
        `Аты: ${session.name}\n` +
        `Телефон: ${session.phone}\n` +
        `Мекенжай: ${session.address}\n` +
        `Тауар: NOMAD блендер-бөтелке — 12 990₸\n\n` +
        `Жақын арада сізбен байланысамыз. Рахмет! 🙏`
      );
    }
  }

  // Тапсырыс процесінде болмаса — Gemini арқылы жалпы сұраққа жауап
  await ctx.sendChatAction('typing');
  try {
    const reply = await askGemini(text);
    await ctx.reply(reply, mainMenu);
  } catch (err) {
    console.error('Жалпы қате:', err);
    await ctx.reply('Қате шықты, сәлден кейін қайта көріңізші.');
  }
});

bot.launch();
console.log('NOMAD боты (v2, батырмалармен) іске қосылды...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
