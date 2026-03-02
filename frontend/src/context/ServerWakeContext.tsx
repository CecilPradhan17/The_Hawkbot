import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { setWakeTrigger } from '@/api/request'

interface ServerWakeContextType {
  isWaking: boolean
  triggerWake: () => Promise<void>
  resolveWake: () => void
}

const ServerWakeContext = createContext<ServerWakeContextType | null>(null)

export function ServerWakeProvider({ children }: { children: React.ReactNode }) {
  const [isWaking, setIsWaking] = useState(false)
  const resolveRef = useRef<(() => void) | null>(null)

  const triggerWake = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setIsWaking(true)
    })
  }, [])

  const resolveWake = useCallback(() => {
    setIsWaking(false)
    resolveRef.current?.()
    resolveRef.current = null
  }, [])

  // Register immediately on first render — not in useEffect —
  // so the trigger is available before any child component fires a request.
  // Using useLayoutEffect would also work but this is simpler.
  // We call setWakeTrigger here so it's registered synchronously
  // when the provider mounts, before Login/Register make any API calls.
  useEffect(() => {
    setWakeTrigger(triggerWake, resolveWake)
  }, [triggerWake, resolveWake])

  // Also register synchronously outside of effect for the very first render
  setWakeTrigger(triggerWake, resolveWake)

  return (
    <ServerWakeContext.Provider value={{ isWaking, triggerWake, resolveWake }}>
      {children}
    </ServerWakeContext.Provider>
  )
}

export function useServerWake() {
  const ctx = useContext(ServerWakeContext)
  if (!ctx) throw new Error('useServerWake must be used within ServerWakeProvider')
  return ctx
}