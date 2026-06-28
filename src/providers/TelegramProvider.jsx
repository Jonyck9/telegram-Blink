import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import {
  init,
  initData,
  initDataUser,
  themeParams,
  themeParamsState,
  viewport,
  viewportState,
  retrieveLaunchParams,
  isTMA,
  mockTelegramEnv,
} from '@telegram-apps/sdk'

const TelegramContext = createContext(null)

function maybeMockTelegram() {
  if (isTMA()) return
  console.info('[Blink] Not in Telegram — applying mock environment')
  mockTelegramEnv({
    themeParams: {
      accentTextColor: '#c084fc',
      bgColor: '#16171d',
      buttonColor: '#c084fc',
      buttonTextColor: '#ffffff',
      destructiveTextColor: '#ef4444',
      headerBgColor: '#16171d',
      hintColor: '#9ca3af',
      linkColor: '#c084fc',
      secondaryBgColor: '#1f2028',
      sectionBgColor: '#16171d',
      sectionHeaderTextColor: '#9ca3af',
      subtitleTextColor: '#6b6375',
      textColor: '#f3f4f6',
      bottomBarBgColor: '#16171d',
    },
    initData: {
      user: {
        id: 123456789,
        firstName: 'Dev',
        lastName: 'User',
        username: 'devuser',
        languageCode: 'en',
        isPremium: true,
      },
      hash: 'mock-hash-for-dev',
      authDate: new Date(),
      startParam: 'debug',
    },
    launchParams: {
      tgWebAppThemeParams: {},
      tgWebAppVersion: '8',
      tgWebAppPlatform: 'web',
    },
  })
}

/** Extract user data from Telegram init data by any means possible */
function extractUser() {
  // 1. SDK method
  try {
    const u = initDataUser()
    if (u) return u
  } catch {}

  // 2. Direct from URL tgWebAppData
  try {
    const params = new URLSearchParams(window.location.search)
    const tgData = params.get('tgWebAppData')
    if (tgData) {
      const up = new URLSearchParams(tgData)
      const raw = up.get('user')
      if (raw) return JSON.parse(decodeURIComponent(raw))
    }
  } catch {}

  // 3. From Telegram WebView low-level API
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user) {
      return window.Telegram.WebApp.initDataUnsafe.user
    }
  } catch {}

  return null
}

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      maybeMockTelegram()
      init()
      initData.restore()
      viewport.mount()
      themeParams.mountSync()
      themeParams.bindCssVars()
      viewport.expand()
      setReady(true)
    } catch (err) {
      console.error('[Blink] Telegram init error:', err)
      setError(err.message)
    }
  }, [])

  const value = useMemo(() => {
    const raw = extractUser()
    const theme = themeParamsState()
    const vp = viewportState()

    const user = raw
      ? {
          id: raw.id,
          firstName: raw.firstName || raw.first_name,
          lastName: raw.lastName || raw.last_name,
          username: raw.username,
          languageCode: raw.languageCode || raw.language_code,
          photoUrl: raw.photoUrl || raw.photo_url,
          isPremium: raw.isPremium || raw.is_premium,
        }
      : null

    return {
      user,
      theme: theme
        ? {
            bgColor: theme.bgColor,
            textColor: theme.textColor,
            hintColor: theme.hintColor,
            linkColor: theme.linkColor,
            buttonColor: theme.buttonColor,
            buttonTextColor: theme.buttonTextColor,
            secondaryBgColor: theme.secondaryBgColor,
            headerBgColor: theme.headerBgColor,
            accentTextColor: theme.accentTextColor,
            isDark: true,
          }
        : null,
      viewport: vp
        ? {
            width: vp.width,
            height: vp.height,
            isExpanded: vp.isExpanded,
            stableHeight: vp.stableHeight,
          }
        : null,
      ready,
      error,
      expandViewport: () => viewport.expand(),
    }
  }, [ready, error])

  return (
    <TelegramContext.Provider value={value}>
      {children}
    </TelegramContext.Provider>
  )
}

export function useTelegram() {
  const ctx = useContext(TelegramContext)
  if (!ctx) {
    throw new Error('useTelegram must be used within <TelegramProvider>')
  }
  return ctx
}
