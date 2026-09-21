import { useCallback, useEffect, useState } from 'react'

const RELOAD_OPTION_DELAY_MS = 60_000

interface ServerWakeModalProps {
  isWaking: boolean
}

interface Joke {
  setup: string
  punchline: string
}

const FALLBACK_JOKES: Joke[] = [
  { setup: 'Why do programmers prefer dark mode?', punchline: 'Because light attracts bugs!' },
  { setup: 'Why was the computer cold?', punchline: 'It left its Windows open!' },
  { setup: 'What is a computer’s favorite snack?', punchline: 'Microchips!' },
]

export default function ServerWakeModal({ isWaking }: ServerWakeModalProps) {
  const [timedOut, setTimedOut] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [joke, setJoke] = useState<Joke | null>(null)
  const [jokeLoading, setJokeLoading] = useState(true)

  const fetchJoke = useCallback(async () => {
    setJokeLoading(true)
    try {
      const response = await fetch('https://official-joke-api.appspot.com/random_joke')
      if (!response.ok) throw new Error('Joke request failed')
      const data = await response.json()
      setJoke({ setup: data.setup, punchline: data.punchline })
    } catch {
      const fallback = FALLBACK_JOKES[Math.floor(Math.random() * FALLBACK_JOKES.length)]
      setJoke(fallback)
    } finally {
      setJokeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isWaking) {
      setTimedOut(false)
      setDismissed(false)
      setJoke(null)
      setJokeLoading(true)
      return
    }

    fetchJoke()
    setTimedOut(false)
    const timeout = window.setTimeout(() => setTimedOut(true), RELOAD_OPTION_DELAY_MS)
    return () => window.clearTimeout(timeout)
  }, [isWaking, fetchJoke])

  if (!isWaking || dismissed) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={() => setDismissed(true)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="server-wake-title"
        className="w-full max-w-md rounded-2xl bg-[#FAF3E1] p-6 shadow-2xl sm:p-8"
        onClick={event => event.stopPropagation()}
      >
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#8A244B]/20 border-t-[#8A244B] motion-reduce:animate-pulse" />
          <h2 id="server-wake-title" className="text-2xl font-bold text-[#8A244B]">While you wait..</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">Here are some cool jokes to pass the time.</p>
        </div>

        <div className="mt-6 min-h-[112px] rounded-xl border border-slate-200 bg-white p-5">
          {jokeLoading ? (
            <div className="space-y-3 py-1 animate-pulse motion-reduce:animate-none" role="status" aria-label="Loading joke">
              <div className="h-3.5 w-full rounded-full bg-slate-200" />
              <div className="h-3.5 w-4/5 rounded-full bg-slate-200" />
              <div className="pt-1 space-y-2">
                <div className="h-3.5 w-11/12 rounded-full bg-[#8A244B]/15" />
                <div className="h-3.5 w-2/3 rounded-full bg-[#8A244B]/15" />
              </div>
              <span className="sr-only">Loading joke…</span>
            </div>
          ) : joke ? (
            <>
              <p className="font-medium text-slate-700">{joke.setup}</p>
              <p className="mt-3 font-semibold text-[#8A244B]">{joke.punchline}</p>
            </>
          ) : null}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            onClick={fetchJoke}
            disabled={jokeLoading}
            className="min-h-11 rounded-lg border-2 border-[#8A244B] bg-white px-4 py-2 text-sm font-bold text-[#8A244B] transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:opacity-50"
          >
            {jokeLoading ? 'Loading…' : 'Another joke'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="min-h-11 rounded-lg bg-[#8A244B] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98]"
          >
            Dismiss
          </button>
        </div>

        {timedOut && (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-center">
            <p className="text-sm font-semibold text-amber-900">The server is taking longer than expected.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 min-h-11 rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-[0.98]"
            >
              Reload page
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
