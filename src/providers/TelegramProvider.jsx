import { createContext, useContext, useEffect, useState, useMemo } from 'react'
import {
  init, initData, initDataUser,
  themeParams, themeParamsState,
  viewport, viewportState,
  isTMA, mockTelegramEnv,
} from '@telegram-apps/sdk'
import { registerUser } from '../lib/supabase'

const TelegramContext = createContext(null)

function maybeMockTelegram() {
  if (isTMA()) return false
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
  return true
}

/**
 * Read user data from Telegram WebView by every possible method.
 * Order: (1) SDK initDataUser (works after initData.restore),
 *         (2) window.Telegram.WebApp.initDataUnsafe (always available in real TMA),
 *         (3) manual initData string parse,
 *         (4) URL search / hash params.
 */
function extractUserFromAnywhere() {
  // 1 — SDK
  try {
    const u = initDataUser()
    if (u && u.id) {
      if (typeof u.id === 'number' && u.id > 0) {
        console.log('[Blink] ✅ User via SDK:', u.id, u.firstName)
        return u
      }
    }
  } catch (_) { /* SDK not initialised yet */ }

  // 2 — window.Telegram.WebApp (sync, always ready in real TMA)
  try {
    const tg = window.Telegram?.WebApp
    const u = tg?.initDataUnsafe?.user
    if (u && typeof u.id === 'number' && u.id > 0) {
      console.log('[Blink] ✅ User via window.Telegram.WebApp:', u.id, u.first_name || u.firstName)
      return u
    }
  } catch (_) {}

  // 3 — manual parse of initData string
  try {
    const raw = window.Telegram?.WebApp?.initData
    if (raw) {
      for (const part of raw.split('&')) {
        const [k, v] = part.split('=')
        if (k === 'user' && v) {
          const parsed = JSON.parse(decodeURIComponent(v))
          if (parsed?.id) {
            console.log('[Blink] ✅ User via initData string parse:', parsed.id, parsed.first_name)
            return parsed
          }
        }
      }
    }
  } catch (_) {}

  // 4 — URL search / hash (works with tgWebAppData param)
  try {
    const s = window.location.search || window.location.hash.replace(/^#/, '')
    const params = new URLSearchParams(s)
    // Direct user param
    const rawUser = params.get('user')
    if (rawUser) {
      const parsed = JSON.parse(decodeURIComponent(rawUser))
      if (parsed?.id) { console.log('[Blink] ✅ User via URL user param:', parsed.id); return parsed }
    }
    // Inside tgWebAppData
    const tgWebAppData = params.get('tgWebAppData')
    if (tgWebAppData) {
      const tgParams = new URLSearchParams(tgWebAppData)
      const rawFromTg = tgParams.get('user')
      if (rawFromTg) {
        const parsed = JSON.parse(decodeURIComponent(rawFromTg))
        if (parsed?.id) { console.log('[Blink] ✅ User via URL tgWebAppData:', parsed.id); return parsed }
      }
    }
  } catch (_) {}

  return null
}

function normalizeUser(raw) {
  if (!raw || !raw.id) return null
  return {
    id: raw.id,
    firstName: raw.firstName || raw.first_name || '',
    lastName: raw.lastName || raw.last_name || '',
    username: raw.username || '',
    languageCode: raw.languageCode || raw.language_code || '',
    photoUrl: raw.photoUrl || raw.photo_url || '',
    isPremium: raw.isPremium || raw.is_premium || false,
  }
}

function collectDebugDump(rawUser, normalizedUser) {
  let initDataStr = null
  let initDataUnsafe = null
  try { initDataStr = window.Telegram?.WebApp?.initData || null } catch (_) {}
  try { initDataUnsafe = window.Telegram?.WebApp?.initDataUnsafe || null } catch (_) {}

  return {
    url: window.location.href,
    search: window.location.search,
    hash: window.location.hash,
    hasTelegramGlobal: typeof window.Telegram !== 'undefined',
    hasTelegramWebApp: !!(window.Telegram?.WebApp),
    initData: initDataStr ? initDataStr.slice(0, 500) : null,
    initDataUnsafe: initDataUnsafe ? {
      query_id: initDataUnsafe.query_id || null,
      auth_date: initDataUnsafe.auth_date || null,
      hash: initDataUnsafe.hash || null,
      hasUser: !!initDataUnsafe.user,
      userId: initDataUnsafe.user?.id || null,
    } : null,
    extractedUser: rawUser,
    normalizedUser,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
  }
}

export function TelegramProvider({ children }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [user, setUser] = useState(null)
  const [debugInfo, setDebugInfo] = useState(null)

  // ─── Phase 1: init SDK & extract user ──────────────────────────────
  useEffect(() => {
    const isMock = maybeMockTelegram()

    // Init SDK before reading user
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

    // Now try to extract user (SDK is initialised, initData restored)
    const raw = extractUserFromAnywhere()
    const normalized = normalizeUser(raw)
    if (normalized) {
      setUser(normalized)
      console.log('[Blink] 👤 User set:', normalized.firstName)

      // Register user in Supabase (fire & forget)
      registerUser(normalized)
    } else {
      console.log('[Blink] ❌ No user found. Mock-mode:', isMock)
    }

    // Collect full debug dump
    setDebugInfo(collectDebugDump(raw, normalized))
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
