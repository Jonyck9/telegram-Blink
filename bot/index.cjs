/**
 * Blink Telegram Bot
 *
 * Telegram Mini App entry point + управление друзьями через Supabase.
 *
 * Команды:
 *   /start           — Открыть карту
 *   /add <username>  — Отправить запрос в друзья
 *   /accept <username> — Принять запрос
 *   /reject <username>  — Отклонить запрос
 *   /friends         — Список друзей
 *   /pending         — Входящие запросы
 *   /remove <username> — Удалить из друзей
 *
 * Usage:
 *   node bot/index.cjs
 */

const { readFileSync, existsSync } = require('fs')
const { resolve } = require('path')
const { createClient } = require('@supabase/supabase-js')

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
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!BOT_TOKEN) { console.error('❌ BOT_TOKEN missing'); process.exit(1) }
if (!WEBAPP_URL) { console.error('❌ WEBAPP_URL missing'); process.exit(1) }
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL or SUPABASE_SERVICE_KEY missing'); process.exit(1)
}

const API = `https://api.telegram.org/bot${BOT_TOKEN}`
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

let lastOffset = 0

// ─── Telegram API helper ──────────────────────────────────────────
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

// ─── Supabase helpers ─────────────────────────────────────────────
async function findUserByUsername(username) {
  const clean = username.replace(/^@/, '').toLowerCase()
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, first_name, username')
    .ilike('username', clean)
    .maybeSingle()
  if (error) { console.error('❌ DB error (findUser):', error.message); return null }
  return data
}

async function getUser(telegramId) {
  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, lat, lng, updated_at')
    .eq('telegram_id', telegramId)
    .maybeSingle()
  if (error) { console.error('❌ DB error (getUser):', error.message); return null }
  return data
}

async function upsertUser(telegramId, firstName, lastName, username) {
  const { error } = await supabase
    .from('users')
    .upsert({
      telegram_id: telegramId,
      first_name: firstName || '',
      last_name: lastName || '',
      username: username || null,
    }, { onConflict: 'telegram_id' })
  if (error) console.error('❌ DB error (upsertUser):', error.message)
  return !error
}

async function sendFriendRequest(userId, friendId) {
  // Проверяем, нет ли уже дружбы
  const { data: existing } = await supabase
    .from('friendships')
    .select('status')
    .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'accepted') return 'already_friends'
    if (existing.status === 'pending') {
      // Если запрос уже есть, но от friend_id → это входящий, авто-принимаем
      const { data: rev } = await supabase
        .from('friendships')
        .select('id')
        .eq('user_id', friendId)
        .eq('friend_id', userId)
        .eq('status', 'pending')
        .maybeSingle()
      if (rev) return 'already_requested_reverse'
      return 'already_requested'
    }
    if (existing.status === 'rejected') {
      // Обновляем старую
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'pending', created_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('friend_id', friendId)
      if (!error) return 'sent'
    }
  }

  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: userId, friend_id: friendId, status: 'pending' })
  if (error) {
    console.error('❌ DB error (sendFriendRequest):', error.message)
    return 'error'
  }
  return 'sent'
}

async function acceptRequest(myId, requesterId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('user_id', requesterId)
    .eq('friend_id', myId)
    .eq('status', 'pending')
  if (error) { console.error('❌ DB error (acceptRequest):', error.message); return false }
  return true
}

async function rejectRequest(myId, requesterId) {
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'rejected' })
    .eq('user_id', requesterId)
    .eq('friend_id', myId)
    .eq('status', 'pending')
  if (error) { console.error('❌ DB error (rejectRequest):', error.message); return false }
  return true
}

async function removeFriendship(myId, friendId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .or(`and(user_id.eq.${myId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${myId})`)
    .eq('status', 'accepted')
  if (error) { console.error('❌ DB error (removeFriend):', error.message); return false }
  return true
}

async function getFriendsList(telegramId) {
  // Ищем дружбы, где status = accepted
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      user_id, friend_id,
      friend:users!friendships_friend_id_fkey(telegram_id, first_name, username, lat, lng, updated_at),
      me:users!friendships_user_id_fkey(telegram_id, first_name, username, lat, lng, updated_at)
    `)
    .or(`user_id.eq.${telegramId},friend_id.eq.${telegramId}`)
    .eq('status', 'accepted')

  if (error) { console.error('❌ DB error (getFriends):', error.message); return [] }

  // Превращаем в плоский список друзей
  const friends = []
  for (const row of data || []) {
    if (row.user_id === telegramId && row.friend) {
      friends.push(row.friend)
    } else if (row.friend_id === telegramId && row.me) {
      friends.push(row.me)
    }
  }
  return friends
}

async function getPendingRequests(telegramId) {
  const { data, error } = await supabase
    .from('friendships')
    .select(`
      user_id, friend_id,
      requester:users!friendships_user_id_fkey(telegram_id, first_name, username)
    `)
    .eq('friend_id', telegramId)
    .eq('status', 'pending')

  if (error) { console.error('❌ DB error (getPending):', error.message); return [] }
  return (data || []).map(r => r.requester).filter(Boolean)
}

// ─── Bot commands ─────────────────────────────────────────────────
const HELP_TEXT = `📋 *Команды Blink:*

/start — Открыть карту
/add <username> — Отправить запрос в друзья
/accept <username> — Принять запрос
/reject <username> — Отклонить запрос
/friends — Список друзей
/pending — Входящие запросы
/remove <username> — Удалить из друзей
/help — Это сообщение`

async function handleMessage(msg) {
  const chatId = msg.chat.id
  const text = (msg.text || '').trim()
  const from = msg.from
  const name = from?.first_name || 'Friend'
  console.log(`📩 ${name} (@${from?.username || '?'}): ${text}`)

  // Разбираем команду и аргумент
  const parts = text.split(/\s+/)
  const cmd = parts[0]?.toLowerCase() || ''
  const arg = parts.slice(1).join(' ').trim()

  // ── /start ──────────────────────────────────────────────────────
  if (text === '/start' || text.startsWith('/start ')) {
    // Регистрируем пользователя при первом /start
    if (from) {
      await upsertUser(from.id, from.first_name, from.last_name, from.username)
    }
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

  // ── Регистрируем пользователя на лету (для всех команд) ─────────
  if (from) {
    await upsertUser(from.id, from.first_name, from.last_name, from.username)
  }

  // ── /help ───────────────────────────────────────────────────────
  if (cmd === '/help') {
    await api('sendMessage', { chat_id: chatId, text: HELP_TEXT, parse_mode: 'Markdown' })
    return
  }

  // ── /add <username> ─────────────────────────────────────────────
  if (cmd === '/add') {
    if (!arg) {
      await api('sendMessage', { chat_id: chatId, text: '❓ Кого добавить? Используй: `/add username`', parse_mode: 'Markdown' })
      return
    }

    const friend = await findUserByUsername(arg)
    if (!friend) {
      await api('sendMessage', { chat_id: chatId, text: `😕 Пользователь @${arg} не найден. Убедись, что он уже открывал карту Blink.` })
      return
    }
    if (friend.telegram_id === from.id) {
      await api('sendMessage', { chat_id: chatId, text: '😂 Нельзя добавить самого себя' })
      return
    }

    const result = await sendFriendRequest(from.id, friend.telegram_id)
    switch (result) {
      case 'already_friends':
        await api('sendMessage', { chat_id: chatId, text: `🤝 Вы уже друзья с @${friend.username || friend.first_name}` })
        break
      case 'already_requested':
        await api('sendMessage', { chat_id: chatId, text: `⏳ Запрос @${friend.username || friend.first_name} уже отправлен, жди ответа` })
        break
      case 'already_requested_reverse':
        // Автоматически принимаем, если запрос был от них к нам
        await acceptRequest(from.id, friend.telegram_id)
        await api('sendMessage', { chat_id: chatId, text: `✅ @${friend.username || friend.first_name} уже отправлял тебе запрос — вы теперь друзья! 🎉` })
        await notifyUser(friend.telegram_id, `✅ @${from.username || from.first_name} принял твой запрос — вы теперь друзья! 🎉`)
        break
      case 'sent':
        await api('sendMessage', { chat_id: chatId, text: `✅ Запрос отправлен @${friend.username || friend.first_name}! Жди подтверждения ⏳` })
        await notifyUser(friend.telegram_id, `📩 @${from.username || from.first_name} хочет добавить тебя в друзья!\n\nПрими запрос: /accept ${from.username || from.first_name}`)
        break
      default:
        await api('sendMessage', { chat_id: chatId, text: '❌ Что-то пошло не так. Попробуй позже.' })
    }
    return
  }

  // ── /accept <username> ──────────────────────────────────────────
  if (cmd === '/accept') {
    if (!arg) {
      await api('sendMessage', { chat_id: chatId, text: '❓ Используй: `/accept username`', parse_mode: 'Markdown' })
      return
    }

    const requester = await findUserByUsername(arg)
    if (!requester) {
      await api('sendMessage', { chat_id: chatId, text: `😕 Пользователь @${arg} не найден` })
      return
    }

    const ok = await acceptRequest(from.id, requester.telegram_id)
    if (ok) {
      await api('sendMessage', { chat_id: chatId, text: `✅ Ты принял запрос от @${requester.username || requester.first_name}! 🎉` })
      await notifyUser(requester.telegram_id, `✅ @${from.username || from.first_name} принял твой запрос в друзья! 🎉`)
    } else {
      await api('sendMessage', { chat_id: chatId, text: `😕 Нет входящего запроса от @${arg}` })
    }
    return
  }

  // ── /reject <username> ──────────────────────────────────────────
  if (cmd === '/reject') {
    if (!arg) {
      await api('sendMessage', { chat_id: chatId, text: '❓ Используй: `/reject username`', parse_mode: 'Markdown' })
      return
    }

    const requester = await findUserByUsername(arg)
    if (!requester) {
      await api('sendMessage', { chat_id: chatId, text: `😕 Пользователь @${arg} не найден` })
      return
    }

    const ok = await rejectRequest(from.id, requester.telegram_id)
    if (ok) {
      await api('sendMessage', { chat_id: chatId, text: `❌ Запрос от @${requester.username || requester.first_name} отклонён` })
    } else {
      await api('sendMessage', { chat_id: chatId, text: `😕 Нет входящего запроса от @${arg}` })
    }
    return
  }

  // ── /friends ────────────────────────────────────────────────────
  if (cmd === '/friends') {
    const friends = await getFriendsList(from.id)
    if (!friends.length) {
      await api('sendMessage', { chat_id: chatId, text: '😕 У тебя пока нет друзей. Добавь кого-нибудь: `/add username`', parse_mode: 'Markdown' })
      return
    }

    const lines = friends.map((f, i) => {
      const status = f.lat && f.lng
        ? `🟢 Online`
        : `⚪ Offline`
      return `${i + 1}. ${f.first_name} @${f.username || '—'} — ${status}`
    })

    await api('sendMessage', {
      chat_id: chatId,
      text: `👥 *Твои друзья (${friends.length}):*\n\n${lines.join('\n')}`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📍 Открыть карту', web_app: { url: WEBAPP_URL } },
        ]],
      },
    })
    return
  }

  // ── /pending ───────────────────────────────────────────────────
  if (cmd === '/pending') {
    const requests = await getPendingRequests(from.id)
    if (!requests.length) {
      await api('sendMessage', { chat_id: chatId, text: '📭 Нет входящих запросов в друзья' })
      return
    }

    const lines = requests.map((r, i) =>
      `${i + 1}. ${r.first_name} @${r.username || '—'}`
    )

    await api('sendMessage', {
      chat_id: chatId,
      text: `📩 *Входящие запросы (${requests.length}):*\n\n${lines.join('\n')}\n\nЧтобы принять: /accept username\nЧтобы отклонить: /reject username`,
      parse_mode: 'Markdown',
    })
    return
  }

  // ── /remove <username> ──────────────────────────────────────────
  if (cmd === '/remove') {
    if (!arg) {
      await api('sendMessage', { chat_id: chatId, text: '❓ Используй: `/remove username`', parse_mode: 'Markdown' })
      return
    }

    const friend = await findUserByUsername(arg)
    if (!friend) {
      await api('sendMessage', { chat_id: chatId, text: `😕 Пользователь @${arg} не найден` })
      return
    }

    const ok = await removeFriendship(from.id, friend.telegram_id)
    if (ok) {
      await api('sendMessage', { chat_id: chatId, text: `🗑️ @${friend.username || friend.first_name} удалён из друзей` })
    } else {
      await api('sendMessage', { chat_id: chatId, text: `😕 @${arg} нет в твоём списке друзей` })
    }
    return
  }

  // ── Fallback ────────────────────────────────────────────────────
  await api('sendMessage', { chat_id: chatId, text: '❓ Неизвестная команда. Напиши /help' })
}

// ─── Notify another user by Telegram ID ──────────────────────────
async function notifyUser(telegramId, text) {
  try {
    await api('sendMessage', { chat_id: telegramId, text, parse_mode: 'Markdown' })
  } catch (_) {
    // Пользователь мог не начинать диалог с ботом — игнорируем
  }
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

  // Step 3: Verify Supabase
  const { error: sbErr } = await supabase.from('users').select('count', { count: 'exact', head: true })
  if (sbErr) {
    console.error(`  ❌  Supabase connection failed: ${sbErr.message}`)
    process.exit(1)
  }
  console.log(`  ✅  Supabase подключен`)

  console.log('')
  console.log('  ──────────────────────────────────────────')
  console.log('  Бот запущен! Открой в Telegram и нажми /start')
  console.log('  ──────────────────────────────────────────')
  console.log('')

  // Step 4: Start polling
  setInterval(poll, 1000)
  poll()
}

start()
