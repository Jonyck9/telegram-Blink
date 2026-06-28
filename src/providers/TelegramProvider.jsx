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

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      // Mock if needed
      maybeMockTelegram()

      // Initialize SDK
      init()

      // Mount core components
      initData.restore()
      viewport.mount()
      themeParams.mountSync()
      themeParams.bindCssVars()

      // Expand viewport to full height
      viewport.expand()

      setReady(true)
    } catch (err) {
      console.error('[Blink] Telegram init error:', err)
      setError(err.message)
    }
  }, [])

  const value = useMemo(() => {
    const user = initDataUser()
    const theme = themeParamsState()
    const vp = viewportState()

    return {
      user: user
        ? {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            languageCode: user.languageCode,
            photoUrl: user.photoUrl,
            isPremium: user.isPremium,
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
