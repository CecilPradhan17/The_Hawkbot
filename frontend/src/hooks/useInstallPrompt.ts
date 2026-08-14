import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallCase =
  | 'chromium' // Chrome/Edge on Android or Desktop — beforeinstallprompt
  | 'ios-safari' // Safari on iOS — Share > Add to Home Screen
  | 'macos-safari' // Safari on macOS — File menu > Add to Dock
  | 'ios-chrome' // Chrome on iOS — WebKit-locked by Apple, no install path in Chrome itself
  | 'unsupported' // no known install path — direct the user to Chrome/Edge/Safari

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function detectCase(hasDeferredPrompt: boolean): InstallCase {
  const ua = window.navigator.userAgent
  const isIos = /iPad|iPhone|iPod/.test(ua)
  const isMac = /Macintosh/.test(ua) && !isIos
  const isIosChrome = isIos && /CriOS/.test(ua)
  // iOS forces every browser onto WebKit, so a "Chrome" UA on iOS never
  // gets beforeinstallprompt — only desktop/Android Chrome/Edge do.
  const isChromiumUA = !isIos && /Chrome|Chromium|Edg\//.test(ua)
  const isSafariEngine = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Chromium|Edg\//.test(ua)

  if (hasDeferredPrompt) return 'chromium'
  if (isIosChrome) return 'ios-chrome'
  if (isIos && isSafariEngine) return 'ios-safari'
  if (isMac && isSafariEngine) return 'macos-safari'
  // Real Chrome/Edge where the event hasn't fired yet (or won't this
  // session) still belongs in the chromium bucket, not "unsupported".
  if (isChromiumUA) return 'chromium'
  return 'unsupported'
}

/**
 * Android/Desktop Chrome/Edge fire `beforeinstallprompt`, which we capture
 * and can trigger on demand. Every other browser has no programmatic
 * install API, so we bucket by UA into the closest instructional case
 * instead (see InstallCase).
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  // Returns false when there was nothing to prompt — most often because
  // it's already installed, since Chrome won't fire beforeinstallprompt
  // again once it is. Callers use this to fall back to messaging instead
  // of leaving the click looking like it did nothing.
  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPrompt) return false
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    return true
  }

  return {
    installed,
    installCase: detectCase(!!deferredPrompt),
    promptInstall,
  }
}
