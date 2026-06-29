/**
 * Supabase клиент для Mini App.
 *
 * Использует анонимный ключ (публичный) — безопасность на уровне RLS.
 * Если ключи не указаны — работает без ошибок, запросы возвращают null.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase = null

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  })
  console.log('[Blink] ✅ Supabase client initialized')
} else {
  console.warn('[Blink] ⚠️ Supabase not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
}

/**
 * Зарегистрировать / обновить пользователя в БД
 */
export async function registerUser(user) {
  if (!supabase || !user) return null

  const { data, error } = await supabase
    .from('users')
    .upsert({
      telegram_id: user.id,
      first_name: user.firstName || '',
      last_name: user.lastName || '',
      username: user.username || null,
      photo_url: user.photoUrl || '',
    }, { onConflict: 'telegram_id' })
    .select()
    .single()

  if (error) {
    console.warn('[Blink] ⚠️ registerUser error:', error.message)
    return null
  }
  return data
}

/**
 * Обновить локацию пользователя
 */
export async function updateLocation(telegramId, lat, lng) {
  if (!supabase || !telegramId) return

  const { error } = await supabase
    .from('users')
    .update({ lat, lng, updated_at: new Date().toISOString() })
    .eq('telegram_id', telegramId)

  if (error) {
    console.warn('[Blink] ⚠️ updateLocation error:', error.message)
  }
}

/**
 * Получить список друзей с их локациями
 */
export async function getFriendsWithLocations(telegramId) {
  if (!supabase || !telegramId) return []

  // Получаем accepted дружбы
  const { data: friendships, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id')
    .or(`user_id.eq.${telegramId},friend_id.eq.${telegramId}`)
    .eq('status', 'accepted')

  if (error) {
    console.warn('[Blink] ⚠️ getFriends error:', error.message)
    return []
  }

  if (!friendships?.length) return []

  // Собираем ID друзей
  const friendIds = friendships.map(f =>
    f.user_id === telegramId ? f.friend_id : f.user_id
  )

  if (!friendIds.length) return []

  // Получаем их данные
  const { data: friends, error: friendsError } = await supabase
    .from('users')
    .select('telegram_id, first_name, username, photo_url, lat, lng, updated_at')
    .in('telegram_id', friendIds)

  if (friendsError) {
    console.warn('[Blink] ⚠️ getFriendsData error:', friendsError.message)
    return []
  }

  return (friends || []).map(f => ({
    ...f,
    online: f.lat && f.lng && (Date.now() - new Date(f.updated_at || 0).getTime()) < 5 * 60 * 1000,
  }))
}

/**
 * Подписаться на обновления локаций друзей через Realtime.
 * Возвращает unsubscribe функцию.
 */
export function subscribeToFriendLocations(telegramId, onUpdate) {
  if (!supabase || !telegramId) return () => {}

  const channel = supabase
    .channel('friend-locations')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'users',
        // Note: filter on columns — нельзя отфильтровать по telegram_id через Realtime,
        // поэтому фильтруем в колбэке
      },
      (payload) => {
        if (payload.new && payload.new.telegram_id !== telegramId) {
          onUpdate({
            telegram_id: payload.new.telegram_id,
            lat: payload.new.lat,
            lng: payload.new.lng,
            updated_at: payload.new.updated_at,
          })
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export default supabase
