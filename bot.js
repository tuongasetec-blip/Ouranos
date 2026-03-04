const http = require('http');
const mineflayer = require('mineflayer');

http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 8080, () => {
  console.log(`HTTP server đang chạy ở port ${process.env.PORT || 8080}`);
});

const CONFIG = {
  host: 'pe.notmc.net',
  port: 25565,
  username: 'DreamMask_',
  version: '1.21.8',
  auth: 'offline',
  serverCommand: '/server earth'
};

const ALLOWED_USERS = ['Hypnos'];
const BOT_NAME = 'DreamMask';

function createBot() {
  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: CONFIG.auth,
    checkTimeoutInterval: 60000,
  });

  let delayLong = false;
  let hypnosCalled = false; // Gọi Hypnos chưa?

  // CHECK INVENTORY MỖI 10 GIÂY
  const inventoryCheckInterval = setInterval(() => {
    try {
      if (bot.inventory && !hypnosCalled) {
        if (bot.inventory.emptySlotCount() === 0) {
          bot.chat('@Hypnos');
          console.log(`[LOG] Inventory FULL - Called Hypnos (1 lần)`);
          hypnosCalled = true; // Đánh dấu đã gọi, không gọi lại nữa
        }
      }
    } catch (err) {
      // silent
    }
  }, 10000);

  // 1. XỬ LÝ TIN NHẮN CHAT
  bot.on('message', (jsonMsg) => {
    const message = jsonMsg.toString();
    console.log(`[CHAT] ${message}`);

    const cleanMessage = message.replace(/§[0-9a-fklmnor]/g, '').toLowerCase();
    const isFromAllowedUser = ALLOWED_USERS.some(user => message.includes(user));

    if (isFromAllowedUser && message.includes('[Discord | Member]') && 
        cleanMessage.includes(BOT_NAME.toLowerCase()) && cleanMessage.includes('offline')) {
      console.log(`[COMMAND] Offline command`);
      delayLong = true;
      clearInterval(inventoryCheckInterval);
      bot.quit('Shutdown');
      return;
    }

    if (message.includes('[Discord | Member]') && isFromAllowedUser) {
      const msgLower = message.toLowerCase();

      if (msgLower.includes(BOT_NAME.toLowerCase()) && msgLower.includes('inv')) {
        bot.chat('[inv]');
      } 
      else if (msgLower.includes(BOT_NAME.toLowerCase()) && msgLower.includes('ping')) {
        bot.chat('[ping]');
      } 
      else if (msgLower.includes(BOT_NAME.toLowerCase()) && msgLower.includes('item')) {
        bot.chat('[i]');
      }
      else if (msgLower.includes(BOT_NAME.toLowerCase()) && msgLower.includes('money')) {
        bot.chat('[m]');
      }
    }

    if (message.toLowerCase().includes('[thông báo]')) {
      setTimeout(() => {
        bot.chat(CONFIG.serverCommand);
      }, 5000);
    }

    if (cleanMessage.includes('overhaul era')) {
      setTimeout(() => {
        bot.chat('/warp afk');
      }, 3000);
    }
  });

  // 2. LOGIN
  bot.once('spawn', () => {
    console.log(`[LOG] Spawned`);
    hypnosCalled = false; // Reset khi spawn
    setTimeout(() => {
      bot.chat('/login hung2312');
      setTimeout(() => {
        bot.chat(CONFIG.serverCommand);
      }, 10000);
    }, 2000);
  });

  // 3. DISCONNECT
  bot.on('end', () => {
    bot.removeAllListeners();
    clearInterval(inventoryCheckInterval);
    
    let reconnectDelay = delayLong ? 60000 : 3000;
    if (delayLong) {
      delayLong = false;
    }
    setTimeout(createBot, reconnectDelay);
  });

  bot.on('error', (err) => console.log(`[ERROR] ${err.message}`));
}

createBot();
