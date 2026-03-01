import { createContext, useContext, useState, useCallback, useRef } from 'react'

interface ServerWakeContextType {
  isWaking: boolean
  triggerWake: () => Promise<void>
  resolveWake: () => void
}

const ServerWakeContext = createContext<ServerWakeContextType | null>(null)

export function ServerWakeProvider({ children }: { children: React.ReactNode }) {
  const [isWaking, setIsWaking] = useState(false)
  const resolveRef = useRef<(() => void) | null>(null)

  // Called by request.ts when a cold start is detected.
  // Returns a promise that resolves when the server wakes up.
  const triggerWake = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve
      setIsWaking(true)
    })
  }, [])

  // Called when the retried request succeeds — dismisses the modal.
  const resolveWake = useCallback(() => {
    setIsWaking(false)
    resolveRef.current?.()
    resolveRef.current = null
  }, [])

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