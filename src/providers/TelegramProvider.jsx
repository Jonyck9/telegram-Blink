import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import {
  init,
  initData,
  initDataUser,
  themeParams,
  themeParamsState,
  viewport,
  viewportState,
  isTMA,
  mockTelegramEnv,
} from '@telegram-apps/sdk'

const TelegramContext = createContext(null)

function maybeMockTelegram() {
  if (isTMA()) return
  console.info('[Blink] Not in Telegram — applying mock environment')
  mockTelegramEnv({
    themeParams: {
      accentTextColor: '#c084fc', bgColor: '#16171d', buttonColor: '#c084fc',
      buttonTextColor: '#ffffff', destructiveTextColor: '#ef4444',
      headerBgColor: '#16171d', hintColor: '#9ca3af', linkColor: '#c084fc',
      secondaryBgColor: '#1f2028', sectionBgColor: '#16171d',
      sectionHeaderTextColor: '#9ca3af', subtitleTextColor: '#6b6375',
      textColor: '#f3f4f6', bottomBarBgColor: '#16171d',
    },
    initData: {
      user: { id: 123456789, firstName: 'Dev', lastName: 'User', username: 'devuser', languageCode: 'en', isPremium: true },
      hash: 'mock-hash-for-dev', authDate: new Date(), startParam: 'debug',
    },
    launchParams: { tgWebAppThemeParams: {}, tgWebAppVersion: '8', tgWebAppPlatform: 'web' },
  })
}

/** Try every possible way to get the Telegram user */
function extractUser() {
  // 1. SDK's initDataUser (works after init+restore)
  try { const u = initDataUser(); if (u) return u } catch {}

  // 2. Telegram WebView low-level API (always available in Telegram)
  try {
    const tg = window.Telegram?.WebApp
    if (tg?.initDataUnsafe?.user) return tg.initDataUnsafe.user
    // Also try raw initData
    if (tg?.initData) {
      const pairs = tg.initData.split('&')
      for (const p of pairs) {
        const [k, v] = p.split('=')
        if (k === 'user' && v) return JSON.parse(decodeURIComponent(v))
      }
    }
  } catch {}

  // 3. Direct URL parsing
  try {
    const s = window.location.search || window.location.hash.replace('#', '')
    const params = new URLSearchParams(s)
    const raw = params.get('user') || new URLSearchParams(params.get('tgWebAppData') || '').get('user')
    if (raw) return JSON.parse(decodeURIComponent(raw))
  } catch {}

  return null
}

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)

  // Extract user data immediately (before SDK init)
  useEffect(() => {
    const u = extractUser()
    if (u) {
      setUser({
        id: u.id,
        firstName: u.firstName || u.first_name,
        lastName: u.lastName || u.last_name,
        username: u.username,
        languageCode: u.languageCode || u.language_code,
        photoUrl: u.photoUrl || u.photo_url,
        isPremium: u.isPremium || u.is_premium,
      })
    }
  }, [])

  // Initialize SDK features (viewport, theme, etc.)
  useEffect(() => {
    maybeMockTelegram()
    try {
      init()
      initData.restore()
      viewport.mount()
      themeParams.mountSync()
      themeParams.bindCssVars()
      viewport.expand()
    } catch (err) {
      console.warn('[Blink] SDK partial init:', err.message)
    }
    setReady(true)
  }, [])

  const value = useMemo(() => {
    const theme = themeParamsState()
    const vp = viewportState()

    return {
      user,
      theme: theme ? {
        bgColor: theme.bgColor, textColor: theme.textColor,
        hintColor: theme.hintColor, linkColor: theme.linkColor,
        buttonColor: theme.buttonColor, buttonTextColor: theme.buttonTextColor,
        secondaryBgColor: theme.secondaryBgColor, headerBgColor: theme.headerBgColor,
        accentTextColor: theme.accentTextColor, isDark: true,
      } : null,
      viewport: vp ? {
        width: vp.width, height: vp.height,
        isExpanded: vp.isExpanded, stableHeight: vp.stableHeight,
      } : null,
      ready, error,
      expandViewport: () => viewport.expand(),
    }
  }, [ready, error, user])

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  )
}

export function useTelegram() {
  const ctx = useContext(TelegramContext)
  if (!ctx) throw new Error('useTelegram must be used within <TelegramProvider>')
  return ctx
}
