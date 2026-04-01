const mineflayer = require('mineflayer')
const http = require('http')
const { Vec3 } = require('vec3')

const CONFIG = {
  host: 'pe.notmc.net',
  port: 25565,
  username: 'Ouranos',
  version: '1.21.4',
  password: 'hung2312',

  BERRY_ITEM: 'sweet_berries',
  STACK_SIZE: 64,
  TARGET_STACKS: 11,
  DTNS_CMD: '/dtns',
  TARGET_SLOT: 21,

  MAIN_SERVER: 'earth',

  ALLOWED_USERS: ['Hypnos', 'GHypnos', 'Spelas', 'DreamMask_', 'Gzues', 'Empty'],
  PM_PASSWORD: 'spawn',

  GUI_WAIT_MS: 3000,
  RECONNECT_DELAY_MS: 5000,
  
  CLICK_DELAY_MIN: 50,
  CLICK_DELAY_MAX: 100,
}

const PORT = process.env.PORT || 8080
http.createServer((_, res) => res.end('OK')).listen(PORT, () => {
  console.log(`[HTTP] Listening on port ${PORT}`)
})

const log = (msg) => console.log(`[${CONFIG.username}] ${msg}`)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function createBot() {
  const bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version,
    skipValidation: true,
    auth: 'offline',
  })

  let isExchanging = false
  let offlineRequested = false
  let msgBuffer = []
  let bufferTimer = null
  let farmLoopRunning = false

  function countBerries() {
    let total = 0
    for (const item of bot.inventory.items()) {
      if (item.name === CONFIG.BERRY_ITEM) total += item.count
    }
    return total
  }

  async function equipBerries() {
    const berryItem = bot.inventory.items().find(i => i.name === CONFIG.BERRY_ITEM)
    if (!berryItem) return false
    try {
      await bot.equip(berryItem, 'hand')
      return true
    } catch (e) {
      return false
    }
  }

  // Lấy tọa độ an toàn (không bị NaN)
  function getSafePosition() {
    // Ưu tiên từ player object
    const player = bot.players[bot.username]
    if (player && player.entity && player.entity.position) {
      const pos = player.entity.position
      if (!isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z)) {
        return pos.floored()
      }
    }
    
    // Dùng từ entity
    if (bot.entity && bot.entity.position) {
      const pos = bot.entity.position
      if (!isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z)) {
        return pos.floored()
      }
    }
    
    return null
  }

  async function microShake() {
    const originalYaw = bot.entity.yaw
    const originalPitch = bot.entity.pitch
    
    const shakeYaw = originalYaw + (Math.random() - 0.5) * 0.02
    const shakePitch = originalPitch + (Math.random() - 0.5) * 0.015
    
    await bot.look(shakeYaw, shakePitch, true)
    await sleep(10 + Math.random() * 20)
    await bot.look(originalYaw, originalPitch, true)
  }

  async function farmLoop() {
    if (farmLoopRunning) return
    farmLoopRunning = true
    log('[FARM] Bắt đầu click...')

    await equipBerries()
    
    let clickCount = 0
    let lastValidPos = null

    while (farmLoopRunning) {
      try {
        if (isExchanging) {
          await sleep(500)
          continue
        }

        const total = countBerries()
        const stacks = Math.floor(total / CONFIG.STACK_SIZE)
        
        if (stacks >= CONFIG.TARGET_STACKS) {
          log(`[FARM] Đủ ${stacks}/${CONFIG.TARGET_STACKS} stacks → đổi điểm`)
          await doExchange()
          await equipBerries()
          continue
        }

        // Lấy tọa độ
        let pos = getSafePosition()
        
        if (!pos) {
          // Nếu chưa có, dùng tọa độ cũ
          if (lastValidPos) {
            pos = lastValidPos
          } else {
            await sleep(200)
            continue
          }
        } else {
          lastValidPos = pos
        }
        
        // CÚI XUỐNG: nhìn xuống dưới chân
        await bot.lookAt(pos.offset(0.5, 0.1, 0.5), true)
        await sleep(20 + Math.random() * 30)
        
        // CLICK CHUỘT PHẢI vào block dưới chân
        const block = bot.blockAt(pos)
        if (block) {
          try {
            await bot.activateBlock(block)
            clickCount++
          } catch (e) {
            // Lỗi thì thôi, click tiếp
          }
        } else {
          // Thử click vào block dưới chân -1
          const blockBelow = bot.blockAt(pos.offset(0, -1, 0))
          if (blockBelow) {
            try {
              await bot.activateBlock(blockBelow)
              clickCount++
            } catch (e) {}
          }
        }
        
        // Delay 50-100ms
        const delay = CONFIG.CLICK_DELAY_MIN + Math.random() * (CONFIG.CLICK_DELAY_MAX - CONFIG.CLICK_DELAY_MIN)
        await sleep(delay)
        
        // Thỉnh thoảng rung nhẹ
        if (Math.random() < 0.12) {
          await microShake()
        }
        
        if (clickCount > 1000) clickCount = 0
        
      } catch (err) {
        await sleep(200)
      }
    }
  }

  async function doExchange() {
    if (isExchanging) return
    isExchanging = true
    try {
      bot.chat(CONFIG.DTNS_CMD)
      
      let window = null
      for (let i = 0; i < 10; i++) {
        if (bot.currentWindow) {
          window = bot.currentWindow
          break
        }
        await sleep(300)
      }
      
      if (!window) {
        log('[ĐỔI ĐIỂM] Không mở được GUI')
        isExchanging = false
        return
      }

      await sleep(500)
      
      try {
        await bot.simpleClick.leftMouse(CONFIG.TARGET_SLOT)
        log('[ĐỔI ĐIỂM] Click thành công')
      } catch (e) {
        log(`[ĐỔI ĐIỂM] Click thất bại: ${e.message}`)
      }

      await sleep(300)
      bot.closeWindow(window)
    } catch (err) {
      if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
    }
    isExchanging = false
  }

  async function joinMainServer() {
    log(`Chuyển đến server ${CONFIG.MAIN_SERVER}...`)
    bot.chat(`/server ${CONFIG.MAIN_SERVER}`)
  }

  function handlePrivateMessage(msg) {
    msgBuffer.push(msg)
    if (bufferTimer) clearTimeout(bufferTimer)
    bufferTimer = setTimeout(async () => {
      const combined = msgBuffer.join('\n')
      msgBuffer = []
      if (!combined.includes('✉') || !combined.includes('ᴛɪɴ ɴʜắɴ ʀɪêɴɢ')) return

      const lines = combined.split('\n')
      const senderLine = lines.find(l => l.includes('→'))
      const contentLine = lines.find(l => l.includes('›'))
      if (!senderLine || !contentLine) return

      const sender = senderLine.split('→')[0].trim().replace(/§[0-9a-fklmnor]/g, '').trim()
      const content = contentLine.replace('›', '').trim().replace(/§[0-9a-fklmnor]/g, '').trim()
      if (!CONFIG.ALLOWED_USERS.includes(sender)) return

      const parts = content.split(' ')
      const password = parts[parts.length - 1]
      const command = parts.slice(0, -1).join(' ').toLowerCase().trim()
      if (password !== CONFIG.PM_PASSWORD) return

      log(`[PM] Lệnh từ ${sender}: "${command}"`)
      if (command === 'status') {
        const total = countBerries()
        bot.chat(`Có ${Math.floor(total / CONFIG.STACK_SIZE)}/${CONFIG.TARGET_STACKS} stacks`)
      } else if (command === 'offline') {
        offlineRequested = true
        farmLoopRunning = false
        bot.quit()
      } else if (command === 'stop') {
        farmLoopRunning = false
        log('[FARM] Dừng')
      } else if (command === 'start') {
        farmLoop()
      } else {
        bot.chat(command)
      }
    }, 300)
  }

  bot.once('spawn', async () => {
    log('Đã spawn!')
    bot.physics.enabled = true

    setTimeout(() => bot.chat(`/login ${CONFIG.password}`), 1500)

    setTimeout(async () => {
      await joinMainServer()
      await sleep(4000)
      farmLoop()
    }, 3000)
  })

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString()
    const cleanMsg = msg.replace(/§[0-9a-fklmnor]/g, '')

    if (cleanMsg.includes('[THÔNG BÁO]') || cleanMsg.includes('disconnect') ||
        cleanMsg.includes('kicked') || cleanMsg.includes('đã kết nối')) {
      log(cleanMsg)
    }

    handlePrivateMessage(msg)

    if (cleanMsg.includes('[THÔNG BÁO]')) {
      setTimeout(() => bot.chat(`/server ${CONFIG.MAIN_SERVER}`), 5000)
    }
    if (cleanMsg.includes('disconnect') || cleanMsg.includes('kicked')) {
      farmLoopRunning = false
      setTimeout(() => bot.quit(), 1000)
    }
  })

  bot.on('end', (reason) => {
    log(`Ngắt kết nối: ${reason}`)
    isExchanging = false
    farmLoopRunning = false
    const delay = offlineRequested ? 60000 : CONFIG.RECONNECT_DELAY_MS
    setTimeout(createBot, delay)
    offlineRequested = false
  })

  bot.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') log('Không thể kết nối, thử lại...')
    else log(`Lỗi: ${err.message}`)
  })

  return bot
}

createBot()
