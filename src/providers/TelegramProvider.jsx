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

/**
 * In development mode, mock the Telegram environment so the app
 * works outside the Telegram client.
 */
function maybeMockTelegram() {
  if (isTMA()) return // already in Telegram

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

/** Try to extract user from current URL as fallback */
function userFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search)
    const tgData = params.get('tgWebAppData') || params.get('tgWebAppData')
    if (!tgData) return null
    // Look for user= in the tgWebAppData query string
    const up = new URLSearchParams(tgData)
    const raw = up.get('user')
    if (raw) return JSON.parse(decodeURIComponent(raw))
  } catch {}
  return null
}

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      // Mock if needed
      maybeMockTelegram()

      // Initialize SDK
      init()
      console.log('[Blink] SDK init done')

      // Mount core components
      initData.restore()
      console.log('[Blink] initData restored')

      viewport.mount()
      themeParams.mountSync()
      themeParams.bindCssVars()

      // Expand viewport to full height
      viewport.expand()

      // Debug: log user data
      const user = initDataUser()
      console.log('[Blink] user from initDataUser:', user)

      try {
        const lp = retrieveLaunchParams()
        console.log('[Blink] launch params:', lp)
      } catch (e) {
        console.log('[Blink] launch params not available:', e.message)
      }

      setReady(true)
    } catch (err) {
      console.error('[Blink] Telegram init error:', err)
      setError(err.message)
    }
  }, [])

  const value = useMemo(() => {
    // Try initDataUser first, fall back to direct URL parsing
    let user = initDataUser()
    console.log('[Blink] initDataUser value:', user)

    if (!user) {
      user = userFromUrl()
      console.log('[Blink] fallback user from URL:', user)
    }

    const theme = themeParamsState()
    const vp = viewportState()

    return {
      user: user
        ? {
            id: user.id,
            firstName: user.firstName || user.first_name,
            lastName: user.lastName || user.last_name,
            username: user.username,
            languageCode: user.languageCode || user.language_code,
            photoUrl: user.photoUrl || user.photo_url,
            isPremium: user.isPremium || user.is_premium,
          }
        : null,
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
