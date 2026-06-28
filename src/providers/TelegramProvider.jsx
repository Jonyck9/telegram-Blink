import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import {
  init, initData, initDataUser,
  themeParams, themeParamsState,
  viewport, viewportState,
  isTMA, mockTelegramEnv,
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

/** Full debug: dump EVERYTHING we can find about the Telegram environment */
function debugTelegramEnv() {
  const dump = {
    // URL info
    url: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
    // SDK
    isTMA: false,
    // Telegram WebView global
    hasTelegramGlobal: !!(window.Telegram),
    hasTelegramWebApp: !!(window.Telegram?.WebApp),
    tgInitData: null,
    tgInitDataUnsafe: null,
    // Extracted user
    extractedUser: null,
  }

  // Check SDK
  try { dump.isTMA = isTMA() } catch {}

  // Check Telegram global
  try {
    if (window.Telegram?.WebApp) {
      dump.tgInitData = window.Telegram.WebApp.initData
      dump.tgInitDataUnsafe = window.Telegram.WebApp.initDataUnsafe
    }
  } catch {}

  // Try SDK user
  try { dump.sdkUser = initDataUser() } catch {}

  // Extract user from any source
  try {
    // From initDataUnsafe
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      dump.extractedUser = window.Telegram.WebApp.initDataUnsafe.user
    }
    // From initData string
    if (!dump.extractedUser && window.Telegram?.WebApp?.initData) {
      for (const p of window.Telegram.WebApp.initData.split('&')) {
        const [k, v] = p.split('=')
        if (k === 'user' && v) {
          dump.extractedUser = JSON.parse(decodeURIComponent(v))
        }
      }
    }
    // From URL
    if (!dump.extractedUser) {
      const s = window.location.search || window.location.hash.replace('#', '')
      const params = new URLSearchParams(s)
      const raw = params.get('user') || new URLSearchParams(params.get('tgWebAppData') || '').get('user')
      if (raw) dump.extractedUser = JSON.parse(decodeURIComponent(raw))
    }
  } catch {}

  console.log('[Blink] 🐛 Telegram debug dump:', dump)
  return dump
}

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)

  // Try to extract user on mount (before SDK)
  useEffect(() => {
    const dump = debugTelegramEnv()
    setDebugInfo(dump)
    console.log('[Blink] Debug:', JSON.stringify(dump, null, 2))

    if (dump.extractedUser || dump.sdkUser) {
      const u = dump.extractedUser || dump.sdkUser
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

  // Initialize SDK
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
      debug: debugInfo,
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
  }, [ready, error, user, debugInfo])

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
