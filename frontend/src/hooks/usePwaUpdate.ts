import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Wraps vite-plugin-pwa's React hook so components don't need to know
 * about the underlying registerSW API. Surfaces whether a new service
 * worker is waiting to take over, plus actions to apply or dismiss it.
 */
export function usePwaUpdate() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const refresh = () => updateServiceWorker(true)
  const dismiss = () => setNeedRefresh(false)

  return { needRefresh, refresh, dismiss }
}
