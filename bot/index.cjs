/**
 * Blink Telegram Bot
 *
 * Telegram Mini App entry point.
 * /start → WebApp button that opens the Blink map.
 *
 * Usage:
 *   node bot/index.cjs
 *
 * Reads bot/.env automatically.
 */

const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')

// ─── Load .env ─────────────────────────────────────────────────────
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = v
  }
}

// ─── Config ────────────────────────────────────────────────────────
const BOT_TOKEN = process.env.BOT_TOKEN
const WEBAPP_URL = process.env.WEBAPP_URL

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN missing. Add it to bot/.env'); process.exit(1) }
if (!WEBAPP_URL) { console.error('❌ WEBAPP_URL missing. Add it to bot/.env'); process.exit(1) }

const API = `https://api.telegram.org/bot${BOT_TOKEN}`
let lastOffset = 0

async function api(method, payload = {}) {
  const r = await fetch(`${API}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const d = await r.json()
  if (!d.ok && !d.description?.includes('Conflict')) {
    console.warn(`⚠️  API error [${method}]:`, d.description)
  }
  return d
}

// ─── Handle messages ──────────────────────────────────────────────
async function handleMessage(msg) {
  const chatId = msg.chat.id
  const text = msg.text || ''
  const name = msg.from?.first_name || 'Friend'
  console.log(`📩 ${name} (@${msg.from?.username || '?'}): ${text}`)

  if (text === '/start') {
    await api('sendMessage', {
      chat_id: chatId,
      text: `👋 Привет, ${name}!\n\nДобро пожаловать в **Blink** — карту друзей в реальном времени.\n\n📍 Смотри, где друзья\n💬 Общайся в чатах\n📸 Делись моментами`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📍 Открыть карту', web_app: { url: WEBAPP_URL } },
        ]],
      },
    })
    return
  }
  await api('sendMessage', { chat_id: chatId, text: 'Нажми /start чтобы открыть карту 🗺️' })
}

// ─── Polling ───────────────────────────────────────────────────────
async function poll() {
  try {
    const data = await api('getUpdates', { offset: lastOffset, timeout: 0, allowed_updates: ['message'] })
    if (data.ok && data.result?.length) {
      for (const upd of data.result) {
        lastOffset = upd.update_id + 1
        if (upd.message) await handleMessage(upd.message)
      }
    }
  } catch (err) {
    console.error('❌ Poll error:', err.message)
  }
}

// ─── Safe start (kill stale polls first) ──────────────────────────
async function start() {
  console.log('')
  console.log('  🤖  Blink Telegram Bot')
  console.log(`  📍  WebApp URL: ${WEBAPP_URL}`)
  console.log('')

  // Step 1: Clear any webhook (also kills conflicting polls)
  console.log('  🧹  Cleaning up...')
  await api('deleteWebhook', { drop_pending_updates: true })
  // Wait a bit for the server to process
  await new Promise(r => setTimeout(r, 1500))

  // Step 2: Verify token
  const me = await api('getMe')
  if (!me.ok) {
    console.error(`  ❌  Auth failed: ${me.description}`)
    if (me.description?.includes('Not Found')) console.error('  👉  Wrong token. Check bot/.env')
    if (me.description?.includes('Unauthorized')) console.error('  👉  Token revoked. Create new one at @BotFather')
    process.exit(1)
  }
  console.log(`  ✅  Бот @${me.result.username} авторизован`)
  console.log('')
  console.log('  ──────────────────────────────────────────')
  console.log('  Открой бота в Telegram и нажми /start')
  console.log('  ──────────────────────────────────────────')
  console.log('')

  // Step 3: Start polling (short timeout so we recover fast if conflict)
  setInterval(poll, 1000)
  poll()
}

start()
