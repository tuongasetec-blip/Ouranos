const http = require('http');
const mineflayer = require('mineflayer');

http.createServer((req, res) => {
  res.write("Bot is alive!");
  res.end();
}).listen(process.env.PORT || 8080, () => {
  console.log(`HTTP server đang chạy ở port ${process.env.PORT || 8080}`);
});

const CONFIG = {
  host: 'play.notmc.net',
  port: 25565,
  username: 'DreamMask_',
  version: '1.21.1',
  auth: 'offline',
  serverCommand: '/server earth',
  pmPassword: 'spawn',
  maxAttempts: 30,
  checkInEveryN: 6, // Nhận đủ N thông báo mới điểm danh
};

const ALLOWED_USERS = ['Hypnos','GHypnos','Spelas','DreamMask_','Gzues','Empty'];
const BOT_NAME = 'DreamMask';

const colors = {
  reset: "\x1b[0m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
  white: "\x1b[37m"
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function createBot() {
  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    auth: CONFIG.auth,
    checkTimeoutInterval: 60000,
  });

  bot.setMaxListeners(100);

  let delayLong = false;
  let isCheckingIn = false;
  let msgBuffer = [];
  let bufferTimer = null;
  let checkInCount = 0; // đếm số lần nhận thông báo điểm danh

  // 1. LOG CHAT
  bot.on('message', (jsonMsg) => {
    const time = new Date().toLocaleTimeString();
    const message = jsonMsg.toString();
    const cleanMessage = message.replace(/§[0-9a-fklmnor]/g, '').toLowerCase();

    console.log(`${colors.white}[CHAT][${time}] ${message}${colors.reset}`);

    // PM buffer
    msgBuffer.push(message);
    if (bufferTimer) clearTimeout(bufferTimer);
    bufferTimer = setTimeout(() => {
      const combined = msgBuffer.join('\n');
      msgBuffer = [];

      if (combined.includes('✉') && combined.includes('ᴛɪɴ ɴʜắɴ ʀɪêɴɢ')) {
        const lines = combined.split('\n');
        const senderLine = lines.find(l => l.includes('→'));
        const contentLine = lines.find(l => l.includes('›'));
        if (!senderLine || !contentLine) return;

        const sender = senderLine.split('→')[0].trim().replace(/§[0-9a-fklmnor]/g, '').trim();
        const content = contentLine.replace('›', '').trim().replace(/§[0-9a-fklmnor]/g, '').trim();

        console.log(`${colors.magenta}[PM] Từ ${sender}: ${content}${colors.reset}`);

        if (!ALLOWED_USERS.includes(sender)) {
          console.log(`${colors.red}[PM] User không được phép: ${sender}${colors.reset}`);
          return;
        }

        const parts = content.split(' ');
        const password = parts[parts.length - 1];
        const command = parts.slice(0, -1).join(' ');

        if (password !== CONFIG.pmPassword) {
          console.log(`${colors.red}[PM] Sai mật khẩu từ ${sender}${colors.reset}`);
          return;
        }

        // Lệnh dropkey qua PM
        if (command.trim() === 'dropkey') {
          console.log(`${colors.green}[PM] Dropkey từ ${sender}${colors.reset}`);
          dropKey();
          return;
        }

        console.log(`${colors.green}[PM] Thực thi: ${command}${colors.reset}`);
        bot.chat(command);
      }
    }, 300);

    // Discord commands
    const isFromAllowedUser = ALLOWED_USERS.some(user => message.includes(user));
    if (isFromAllowedUser && message.includes('[Discord | Member]') && cleanMessage.includes(BOT_NAME.toLowerCase())) {
      if (cleanMessage.includes('offline')) {
        delayLong = true;
        bot.quit();
        return;
      }
      if (cleanMessage.includes('inv')) bot.chat('[inv]');
      if (cleanMessage.includes('ping')) bot.chat('[ping]');
      if (cleanMessage.includes('item')) bot.chat('[i]');
      if (cleanMessage.includes('money')) bot.chat('[m]');
    }

    // Rejoin Earth
    if (message.includes('[THÔNG BÁO]')) {
      console.log(`${colors.yellow}[SYSTEM] Bị kick về Lobby. Rejoin...${colors.reset}`);
      setTimeout(() => bot.chat(CONFIG.serverCommand), 5000);
    }

    // Vào Earth → warp afk
    if (cleanMessage.includes('overhaul era')) {
      setTimeout(() => bot.chat('/warp afk'), 3000);
    }

    // Điểm danh
    if (cleanMessage.includes('chưa nhận hết phần thưởng')) {
      checkInCount++;
      console.log(`${colors.cyan}[ĐIỂM DANH] Thông báo ${checkInCount}/${CONFIG.checkInEveryN}...${colors.reset}`);

      if (checkInCount >= CONFIG.checkInEveryN) {
        checkInCount = 0;
        console.log(`${colors.cyan}[ĐIỂM DANH] Đủ ${CONFIG.checkInEveryN} lần, bắt đầu điểm danh!${colors.reset}`);
        doCheckIn();
      }
    }
  });

  // DROPKEY
  async function dropKey() {
    try {
      const items = bot.inventory.items().filter(item => item.name.includes('tripwire_hook'));
      if (items.length === 0) {
        console.log(`${colors.yellow}[DROPKEY] Không có tripwire_hook trong túi.${colors.reset}`);
        return;
      }
      for (const item of items) {
        await bot.tossStack(item);
        await sleep(300);
      }
      console.log(`${colors.green}[DROPKEY] Đã drop ${items.length} tripwire_hook.${colors.reset}`);
    } catch (err) {
      console.log(`${colors.red}[DROPKEY] Lỗi: ${err.message}${colors.reset}`);
    }
  }

  // ĐIỂM DANH
  async function doCheckIn() {
    if (isCheckingIn) return;
    isCheckingIn = true;

    if (bot.currentWindow) {
      bot.closeWindow(bot.currentWindow);
      await sleep(500);
    }

    let attempt = 0;
    while (attempt < CONFIG.maxAttempts) {
      attempt++;
      try {
        bot.chat('/diemdanh');
        await sleep(3000);

        if (!bot.currentWindow) {
          console.log(`${colors.red}[ĐIỂM DANH] Lần ${attempt}/${CONFIG.maxAttempts}: GUI không mở, thử lại sau 5s...${colors.reset}`);
          await sleep(5000);
          continue;
        }

        const win = bot.currentWindow;
        const beaconSlot = win.slots.findIndex(item =>
          item && item.name.includes('beacon')
        );

        if (beaconSlot === -1) {
          console.log(`${colors.red}[ĐIỂM DANH] Lần ${attempt}/${CONFIG.maxAttempts}: Không thấy beacon, thử lại sau 5s...${colors.reset}`);
          bot.closeWindow(win);
          await sleep(5000);
          continue;
        }

        await sleep(500);
        await bot.clickWindow(beaconSlot, 0, 0);
        bot.closeWindow(win);
        console.log(`${colors.green}[ĐIỂM DANH] Hoàn thành sau ${attempt} lần!${colors.reset}`);
        isCheckingIn = false;
        return;

      } catch (err) {
        console.log(`${colors.red}[ĐIỂM DANH] Lần ${attempt}/${CONFIG.maxAttempts}: ${err.message}. Thử lại sau 5s...${colors.reset}`);
        if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
        await sleep(5000);
      }
    }
    console.log(`${colors.yellow}[ĐIỂM DANH] Bỏ qua sau ${CONFIG.maxAttempts} lần. Chờ tín hiệu mới...${colors.reset}`);
    isCheckingIn = false;
  }

  // 2. SPAWN
  bot.once('spawn', () => {
    console.log(`${colors.green}[LOG] Bot ${CONFIG.username} online.${colors.reset}`);
    setTimeout(() => {
      bot.chat('/login hung2312');
      setTimeout(() => bot.chat(CONFIG.serverCommand), 10000);
    }, 2000);
  });

  // 3. DISCONNECT
  bot.on('end', () => {
    bot.removeAllListeners();
    let reconnectDelay = delayLong ? 60000 : 3000;
    if (delayLong) {
      console.log(`${colors.red}[DISCONNECT] Lệnh offline. Reconnect sau 60s...${colors.reset}`);
      delayLong = false;
    } else {
      console.log(`${colors.red}[DISCONNECT] Reconnect sau 3s...${colors.reset}`);
    }
    setTimeout(createBot, reconnectDelay);
  });

  bot.on('error', (err) => console.log(`${colors.red}[ERR] ${err.message}${colors.reset}`));
}

createBot();
