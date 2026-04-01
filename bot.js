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
  BERRY_BLOCK: 'sweet_berry_bush',
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
    auth: 'offline', // Thêm auth offline
  })

  let isExchanging = false
  let offlineRequested = false
  let msgBuffer = []
  let bufferTimer = null
  let farmLoopRunning = false
  let clickCount = 0
  let successCount = 0
  let failCount = 0

  function countBerries() {
    let total = 0
    for (const item of bot.inventory.items()) {
      if (item.name === CONFIG.BERRY_ITEM) total += item.count
    }
    return total
  }

  async function equipBerries() {
    const berryItem = bot.inventory.items().find(i => i.name === CONFIG.BERRY_ITEM)
    if (!berryItem) {
      log('[DEBUG] ❌ KHÔNG CÓ sweet_berries trong inventory!')
      return false
    }
    log(`[DEBUG] Có ${berryItem.count} sweet_berries trong inventory`)
    
    try {
      await bot.equip(berryItem, 'hand')
      log('[DEBUG] ✅ Đã cầm sweet_berries trên tay')
      return true
    } catch (e) {
      log(`[DEBUG] ❌ Equip thất bại: ${e.message}`)
      return false
    }
  }

  // Rung nhẹ camera
  async function microShake() {
    const originalYaw = bot.entity.yaw
    const originalPitch = bot.entity.pitch
    
    const shakeYaw = originalYaw + (Math.random() - 0.5) * 0.02
    const shakePitch = originalPitch + (Math.random() - 0.5) * 0.015
    
    await bot.look(shakeYaw, shakePitch, true)
    await sleep(10 + Math.random() * 20)
    await bot.look(originalYaw, originalPitch, true)
  }

  // Right click liên tục
  async function farmLoop() {
    if (farmLoopRunning) return
    farmLoopRunning = true
    log('[FARM] ========== BẮT ĐẦU FARM ==========')
    log('[FARM] Click delay: 50-100ms')

    // Đảm bảo cầm mọng
    const hasBerries = await equipBerries()
    if (!hasBerries) {
      log('[FARM] ❌ Không có mọng để farm, thoát farm loop')
      farmLoopRunning = false
      return
    }
    
    let lastLogTime = Date.now()

    while (farmLoopRunning) {
      try {
        if (isExchanging) {
          await sleep(500)
          continue
        }

        const total = countBerries()
        const stacks = Math.floor(total / CONFIG.STACK_SIZE)
        
        if (stacks >= CONFIG.TARGET_STACKS) {
          log(`[FARM] ✅ Đủ ${stacks}/${CONFIG.TARGET_STACKS} stacks → đổi điểm`)
          await doExchange()
          await equipBerries()
          continue
        }

        // LẤY THÔNG TIN BLOCK DƯỚI CHÂN
        const pos = bot.entity.position.floored()
        const block = bot.blockAt(pos)
        
        log(`[DEBUG] Vị trí đang đứng: (${pos.x}, ${pos.y}, ${pos.z})`)
        
        if (!block) {
          log('[DEBUG] ❌ KHÔNG CÓ BLOCK tại vị trí đang đứng!')
          await sleep(1000)
          continue
        }
        
        log(`[DEBUG] Block dưới chân: "${block.name}" tại (${block.position.x}, ${block.position.y}, ${block.position.z})`)
        
        // KIỂM TRA CÓ ĐANG CẦM ĐÚNG ITEM KHÔNG
        const heldItem = bot.heldItem
        if (!heldItem) {
          log('[DEBUG] ❌ Tay đang trống, không có item!')
          await equipBerries()
          await sleep(200)
          continue
        }
        log(`[DEBUG] Đang cầm: "${heldItem.name}" (số lượng: ${heldItem.count})`)
        
        if (heldItem.name !== CONFIG.BERRY_ITEM) {
          log(`[DEBUG] ⚠️ Đang cầm sai item (${heldItem.name}), cần cầm ${CONFIG.BERRY_ITEM}`)
          await equipBerries()
          await sleep(200)
          continue
        }
        
        // THỰC HIỆN CLICK
        clickCount++
        log(`[DEBUG] ===== LẦN CLICK #${clickCount} =====`)
        log(`[DEBUG] Đang thực hiện activateBlock vào block "${block.name}"...`)
        
        try {
          const startTime = Date.now()
          await bot.activateBlock(block)
          const elapsed = Date.now() - startTime
          successCount++
          log(`[DEBUG] ✅ CLICK THÀNH CÔNG! (${elapsed}ms) - Tổng thành công: ${successCount}`)
        } catch (err) {
          failCount++
          log(`[DEBUG] ❌ CLICK THẤT BẠI! Lỗi: ${err.message}`)
          log(`[DEBUG] Tổng thất bại: ${failCount} / Thành công: ${successCount}`)
          
          // Thử equip lại nếu lỗi
          if (err.message.includes('hand') || err.message.includes('item')) {
            log('[DEBUG] Có vẻ vấn đề về item, thử equip lại...')
            await equipBerries()
          }
        }
        
        // Thống kê mỗi 10 giây
        if (Date.now() - lastLogTime > 10000) {
          log(`[STATS] Click: ${clickCount} lần | Thành công: ${successCount} | Thất bại: ${failCount} | Mọng: ${total}`)
          lastLogTime = Date.now()
        }
        
        // Delay 50-100ms giữa các click
        const delay = CONFIG.CLICK_DELAY_MIN + Math.random() * (CONFIG.CLICK_DELAY_MAX - CONFIG.CLICK_DELAY_MIN)
        await sleep(delay)
        
        // Thỉnh thoảng rung nhẹ camera
        if (Math.random() < 0.12) {
          await microShake()
        }
        
      } catch (err) {
        log(`[FARM] Lỗi vòng lặp: ${err.message}`)
        await sleep(500)
      }
    }
  }

  // Đổi điểm
  async function doExchange() {
    if (isExchanging) return
    isExchanging = true
    log('[EXCHANGE] Bắt đầu đổi điểm...')
    try {
      bot.chat(CONFIG.DTNS_CMD)
      log('[EXCHANGE] Đã gửi lệnh /dtns')
      
      let window = null
      for (let i = 0; i < 10; i++) {
        if (bot.currentWindow) {
          window = bot.currentWindow
          break
        }
        await sleep(300)
      }
      
      if (!window) {
        log('[EXCHANGE] ❌ Không mở được GUI sau 3 giây')
        isExchanging = false
        return
      }

      log(`[EXCHANGE] ✅ GUI đã mở: "${window.title}"`)
      await sleep(500)
      
      try {
        await bot.simpleClick.leftMouse(CONFIG.TARGET_SLOT)
        log(`[EXCHANGE] ✅ Click thành công vào slot ${CONFIG.TARGET_SLOT}`)
      } catch (e) {
        log(`[EXCHANGE] ❌ Click thất bại: ${e.message}`)
      }

      await sleep(300)
      bot.closeWindow(window)
      log('[EXCHANGE] Đã đóng GUI')
    } catch (err) {
      log(`[EXCHANGE] ❌ Lỗi: ${err.message}`)
      if (bot.currentWindow) bot.closeWindow(bot.currentWindow)
    }
    isExchanging = false
    
    const newTotal = countBerries()
    log(`[EXCHANGE] Hoàn tất! Còn ${Math.floor(newTotal / CONFIG.STACK_SIZE)} stacks (${newTotal} mọng)`)
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
        bot.chat(`Có ${Math.floor(total / CONFIG.STACK_SIZE)}/${CONFIG.TARGET_STACKS} stacks (${total} mọng)`)
      } else if (command === 'offline') {
        offlineRequested = true
        farmLoopRunning = false
        bot.quit()
      } else if (command === 'stop') {
        farmLoopRunning = false
        log('[FARM] Đã dừng theo yêu cầu')
      } else if (command === 'start') {
        farmLoop()
      } else {
        bot.chat(command)
      }
    }, 300)
  }

  bot.once('spawn', async () => {
    log('========================================')
    log('✅ BOT ĐÃ SPAWN THÀNH CÔNG!')
    log('========================================')
    bot.physics.enabled = true

    setTimeout(() => {
      log('[LOGIN] Đang đăng nhập...')
      bot.chat(`/login ${CONFIG.password}`)
    }, 1500)

    setTimeout(async () => {
      await joinMainServer()
      await sleep(4000)
      
      // Kiểm tra inventory trước khi farm
      const berries = countBerries()
      log(`[INIT] Có ${berries} sweet_berries trong inventory (${Math.floor(berries / CONFIG.STACK_SIZE)} stacks)`)
      
      // Kiểm tra block dưới chân
      const pos = bot.entity.position.floored()
      const block = bot.blockAt(pos)
      log(`[INIT] Block dưới chân: ${block ? block.name : 'KHÔNG CÓ BLOCK'}`)
      
      if (block && block.name === CONFIG.BERRY_BLOCK) {
        log('[INIT] ✅ Đã có bụi mọng dưới chân, bắt đầu farm!')
      } else {
        log(`[INIT] ⚠️ Block dưới chân là "${block?.name}", không phải bụi mọng. Cần đặt bụi mọng trước!`)
      }
      
      farmLoop()
    }, 3000)
  })

  bot.on('message', (jsonMsg) => {
    const msg = jsonMsg.toString()
    const cleanMsg = msg.replace(/§[0-9a-fklmnor]/g, '')

    if (cleanMsg.includes('[THÔNG BÁO]') || cleanMsg.includes('disconnect') ||
        cleanMsg.includes('kicked') || cleanMsg.includes('đã kết nối')) {
      log(`[SERVER] ${cleanMsg}`)
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
    log(`[END] Ngắt kết nối: ${reason}`)
    isExchanging = false
    farmLoopRunning = false
    const delay = offlineRequested ? 60000 : CONFIG.RECONNECT_DELAY_MS
    log(`[END] Sẽ reconnect sau ${delay/1000} giây...`)
    setTimeout(createBot, delay)
    offlineRequested = false
  })

  bot.on('error', (err) => {
    if (err.code === 'ECONNREFUSED') log('[ERROR] Không thể kết nối tới server!')
    else log(`[ERROR] ${err.message}`)
  })

  return bot
}

createBot()
