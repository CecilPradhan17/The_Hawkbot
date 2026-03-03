import { getToken } from "@/utils/token"

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'
const SERVER_URL = BASE_URL.replace(/\/api$/, '')
const HEALTH_CHECK_TIMEOUT_MS = 2000

type HttpMethod = 'GET' | 'POST' | 'DELETE'

// Cold start timeout — if a request takes longer than this (ms),
// we assume the server is waking up from sleep and show the modal.
const COLD_START_TIMEOUT_MS = 3000

// Retry interval — how often to retry while server is waking (ms)
const RETRY_INTERVAL_MS = 3000

// Max retries before giving up
const MAX_RETRIES = 25

// Global wake trigger — set by ServerWakeProvider via setWakeTrigger()
let wakeTrigger: (() => Promise<void>) | null = null
let resolveWake: (() => void) | null = null

export function setWakeTrigger(
  trigger: () => Promise<void>,
  resolve: () => void
) {
  wakeTrigger = trigger
  resolveWake = resolve
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function isServerAwake(): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), HEALTH_CHECK_TIMEOUT_MS)
    fetch(`${SERVER_URL}/health`)
      .then(res => { clearTimeout(timeout); resolve(res.ok) })
      .catch(() => { clearTimeout(timeout); resolve(false) })
  })
}

// helper that performs fetch with an explicit timeout
async function attemptFetch(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs)
    fetch(url, options)
      .then(r => {
        clearTimeout(timer)
        resolve(r)
      })
      .catch(err => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

export default async function request<T>(
  endpoint: string,
  method: HttpMethod,
  body?: unknown
): Promise<T> {
  const token = getToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  const fetchOptions: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  }

  const url = `${BASE_URL}${endpoint}`

  // Attempt the request with a timeout to detect cold starts
  const attemptRequest = (): Promise<Response> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('COLD_START'))
      }, COLD_START_TIMEOUT_MS)

      fetch(url, fetchOptions)
        .then(res => {
          clearTimeout(timeout)
          resolve(res)
        })
        .catch(() => {
          clearTimeout(timeout)
          // Network errors (e.g. server completely down) also treated as cold start
          reject(new Error('COLD_START'))
        })
    })
  }

  let res: Response | null = null

  try {
    res = await attemptRequest()
  } catch {
    const awake = await isServerAwake()

    if (awake) {
      // Server up but slow — retry silently, no modal
      try {
        res = await attemptFetch(url, fetchOptions, 30000)
      } catch {
        throw new Error('The server is taking too long to respond. Please try again.')
      }
    } else {
      // Genuinely asleep — show modal and retry
      if (wakeTrigger) wakeTrigger()

      // simple retry loop while the server wakes
      let attempt = 0
      while (attempt < MAX_RETRIES) {
        try {
          res = await attemptFetch(url, fetchOptions, COLD_START_TIMEOUT_MS)
          resolveWake?.()
          break
        } catch {
          await sleep(RETRY_INTERVAL_MS)
          attempt++
        }
      }

      if (!res) {
        resolveWake?.()
        throw new Error('The server did not wake up. Please try again later.')
      }
    }
  }

  // Handle token expiration
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    // Don't force a reload if the request was the login request
    // or if the user is already on the login page — let the caller
    // handle showing the error so they can display it persistently.
    const onLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
    if (!onLoginPage && endpoint !== '/login') {
      window.location.href = '/login'
    }
    throw new Error('Session expired. Please login again.')
  }

  // Handle non-2xx responses
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    const message = errorData?.message || 'Request failed'
    throw new Error(message)
  }

  // 204 No Content
  if (res.status === 204) return null as T

  return res.json()
}

export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, 'GET'),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, 'POST', body),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, 'DELETE'),
}