const mineflayer = require('mineflayer')
const http = require('http')
const { Vec3 } = require('vec3')

const CONFIG = {
  host: 'pe.notmc.net',
  port: 25565,
  username: 'Ouranos',
  version: '1.21.1',
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
  
  let currentBerries = 0
  let lastBerryCount = 0

  // Vung tay phải
  function swingArm() {
    try {
      bot._client.write('arm_animation', { hand: 0 })
    } catch (e) {}
  }

  function updateBerryCount() {
    let total = 0
    for (const item of bot.inventory.items()) {
      if (item.name === CONFIG.BERRY_ITEM) total += item.count
    }
    currentBerries = total
    
    if (currentBerries !== lastBerryCount) {
      const stacks = Math.floor(currentBerries / CONFIG.STACK_SIZE)
      log(`🍓 Mọng: ${currentBerries} cái (${stacks}/${CONFIG.TARGET_STACKS} stacks)`)
      lastBerryCount = currentBerries
    }
    return currentBerries
  }

  bot.on('inventoryWindow', () => updateBerryCount())
  bot.on('itemUpdate', () => updateBerryCount())
  bot.on('playerCollect', (collector) => {
    if (collector === bot.entity) setTimeout(() => updateBerryCount(), 50)
  })

  function countBerries() {
    return updateBerryCount()
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

  function getSafePosition() {
    const player = bot.players[bot.username]
    if (player && player.entity && player.entity.position) {
      const pos = player.entity.position
      if (!isNaN(pos.x) && !isNaN(pos.y) && !isNaN(pos.z)) {
        return pos.floored()
      }
    }
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
    updateBerryCount()
    
    let clickCount = 0
    let lastValidPos = null
    let lastUpdateLog = Date.now()

    while (farmLoopRunning) {
      try {
        if (isExchanging) {
          await sleep(500)
          continue
        }

        if (Date.now() - lastUpdateLog > 5000) {
          updateBerryCount()
          lastUpdateLog = Date.now()
        }

        const total = currentBerries
        const stacks = Math.floor(total / CONFIG.STACK_SIZE)
        
        if (stacks >= CONFIG.TARGET_STACKS) {
          log(`✅ Đủ ${stacks}/${CONFIG.TARGET_STACKS} stacks → đổi điểm`)
          await doExchange()
          await equipBerries()
          updateBerryCount()
          continue
        }

        let pos = getSafePosition()
        
        if (!pos) {
          if (lastValidPos) {
            pos = lastValidPos
          } else {
            await sleep(200)
            continue
          }
        } else {
          lastValidPos = pos
        }
        
        // Cúi xuống nhìn dưới chân
        await bot.lookAt(pos.offset(0.5, 0.1, 0.5), true)
        await sleep(20 + Math.random() * 30)
        
        // VUNG TAY TRƯỚC KHI CLICK
        swingArm()
        await sleep(10 + Math.random() * 20)
        
        // CLICK CHUỘT PHẢI
        const block = bot.blockAt(pos)
        if (block) {
          try {
            await bot.activateBlock(block)
            clickCount++
          } catch (e) {}
        } else {
          const blockBelow = bot.blockAt(pos.offset(0, -1, 0))
          if (blockBelow) {
            try {
              await bot.activateBlock(blockBelow)
              clickCount++
            } catch (e) {}
          }
        }
        
        const delay = CONFIG.CLICK_DELAY_MIN + Math.random() * (CONFIG.CLICK_DELAY_MAX - CONFIG.CLICK_DELAY_MIN)
        await sleep(delay)
        
        // Rung nhẹ camera
        if (Math.random() < 0.12) {
          await microShake()
        }
        
        if (clickCount % 100 === 0 && clickCount > 0) {
          const stacksNow = Math.floor(currentBerries / CONFIG.STACK_SIZE)
          log(`📊 Click ${clickCount} lần | Mọng: ${currentBerries} (${stacksNow}/${CONFIG.TARGET_STACKS})`)
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
    
    const beforeExchange = currentBerries
    log(`💰 Đổi điểm... (Có ${beforeExchange} mọng)`)
    
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
        log('❌ Không mở được GUI')
        isExchanging = false
        return
      }

      await sleep(500)
      
      try {
        await bot.simpleClick.leftMouse(CONFIG.TARGET_SLOT)
        log('✅ Click đổi điểm thành công')
      } catch (e) {
        log(`❌ Click thất bại: ${e.message}`)
      }

      await sleep(300)
      bot.closeWindow(window)
      
      await sleep(500)
      updateBerryCount()
      
      const afterExchange = currentBerries
      const exchanged = beforeExchange - afterExchange
      log(`💰 Đã đổi ${exchanged} mọng | Còn: ${afterExchange} (${Math.floor(afterExchange / CONFIG.STACK_SIZE)} stacks)`)
      
    } catch (err) {
      log(`❌ Lỗi: ${err.message}`)
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
        const total = currentBerries
        bot.chat(`🍓 ${Math.floor(total / CONFIG.STACK_SIZE)}/${CONFIG.TARGET_STACKS} stacks (${total} mọng)`)
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
    log('✅ Đã spawn!')
    bot.physics.enabled = true
    
    setTimeout(() => updateBerryCount(), 1000)
    setTimeout(() => bot.chat(`/login ${CONFIG.password}`), 1500)

    setTimeout(async () => {
      await joinMainServer()
      await sleep(4000)
      updateBerryCount()
      log(`🍓 Khởi tạo: ${currentBerries} mọng (${Math.floor(currentBerries / CONFIG.STACK_SIZE)}/${CONFIG.TARGET_STACKS} stacks)`)
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
