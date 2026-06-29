-- ============================================================
-- Blink App — Supabase Schema
-- Запусти в Supabase SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. Пользователи
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT DEFAULT '',
  username TEXT UNIQUE,
  photo_url TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Дружба
CREATE TABLE friendships (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  friend_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, friend_id)
);

-- Индексы для быстрых запросов
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_friendships_status ON friendships(status);
CREATE INDEX idx_users_username ON users(username);

-- 3. Включаем Realtime для таблицы users (обновление локаций в реальном времени)
ALTER PUBLICATION supabase_realtime ADD TABLE users;
