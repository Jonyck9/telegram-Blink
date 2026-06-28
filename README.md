# Blink — Социальная карта друзей

Приложение для общения с друзьями и близкими, которое позволяет в реальном времени видеть местоположение друг друга на интерактивной карте.

Telegram Mini App на React + Vite.

---

## 🚀 Быстрый старт

```bash
npm install
npm run dev
```

Приложение откроется на `http://localhost:5173/`.

## 🤖 Настройка Telegram бота

### 1. Создай бота

1. Открой [@BotFather](https://t.me/botfather) в Telegram
2. Отправь `/newbot` и следуй инструкциям
3. Получи **токен** вида `123456789:ABCdefGHIjklmNOpqrsTUVwxyz`

### 2. Настрой Mini App в BotFather

Отправь BotFather команду `/mybot`, выбери своего бота, затем:

1. **Bot Settings** → **Menu Button** → установи URL своего Mini App
2. Или используй команду `/setmenubutton` — укажи бота → отправь URL → отправь название "Blink Map"

> **Важно:** Telegram требует HTTPS. Для разработки используй [ngrok](https://ngrok.com/).

### 3. Запусти туннель (для разработки)

Установи ngrok и запусти:

```bash
ngrok http http://localhost:5173
```

Скопируй HTTPS-ссылку (например `https://abc123.ngrok-free.app`).

### 4. Запусти бота

```bash
# Установи переменные окружения
export BOT_TOKEN=your_bot_token_here
export WEBAPP_URL=https://abc123.ngrok-free.app

# Запусти бота
node bot/index.js
```

Теперь открой бота в Telegram и нажми **Start** → кнопка **📍 Open Blink Map**.

### 5. Продакшн

Для продакшна задеплой приложение на Vercel:

```bash
npm run build
npx vercel --prod
```

Обнови `WEBAPP_URL` на продакшен-URL и перезапусти бота.

## 🏗️ Архитектура

```
src/
├── main.jsx                  # Точка входа
├── App.jsx                   # Корневой компонент с TelegramProvider
├── index.css                 # Глобальные стили
├── providers/
│   └── TelegramProvider.jsx  # Инициализация Telegram SDK
├── pages/
│   └── MapPage.jsx           # Страница с картой
└── components/
    ├── MapView.jsx/css       # Интерактивная карта (Leaflet)
    └── TopBar.jsx/css        # Верхняя панель
bot/
├── index.js                  # Telegram бот (без зависимостей)
└── .env.example              # Пример переменных
```

## 🛠️ Стек

- **React 19** + **Vite 8**
- **Leaflet** + **react-leaflet** — карты OpenStreetMap
- **@telegram-apps/sdk** — интеграция с Telegram Mini Apps
- Telegram Bot API (через fetch, без внешних зависимостей)

## 📱 Возможности (в разработке)

- [x] Интерактивная карта с геолокацией
- [x] Telegram Mini App интеграция
- [ ] Друзья на карте
- [ ] Чат (личный и групповой)
- [ ] Аудио/видеозвонки
- [ ] Check-ins
- [ ] Freeze режим
- [ ] Bump — найти друзей рядом
- [ ] Индикатор батареи и скорости
