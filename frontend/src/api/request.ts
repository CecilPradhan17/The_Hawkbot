import { getToken } from "@/utils/token"

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

// Cold start timeout — if a request takes longer than this (ms),
// we assume the server is waking up from sleep and show the modal.
const COLD_START_TIMEOUT_MS = 8000

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

  let res: Response

  try {
    res = await attemptRequest()
  } catch (err: any) {
    if (err.message === 'COLD_START' && wakeTrigger) {
      // Show the wake modal
      wakeTrigger()

      // Keep retrying until the server responds
      let retries = 0
      while (retries < MAX_RETRIES) {
        await sleep(RETRY_INTERVAL_MS)
        try {
          res = await attemptRequest()
          // Server is back — dismiss the modal
          resolveWake?.()
          break
        } catch {
          retries++
        }
      }

      if (!res!) {
        resolveWake?.()
        throw new Error('Server failed to wake up. Please try again.')
      }
    } else {
      throw err
    }
  }

  // Handle token expiration
  if (res!.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    window.location.href = '/login'
    throw new Error('Session expired. Please login again.')
  }

  // Handle non-2xx responses
  if (!res!.ok) {
    const errorData = await res!.json().catch(() => null)
    const message = errorData?.message || 'Request failed'
    throw new Error(message)
  }

  // 204 No Content
  if (res!.status === 204) return null as T

  return res!.json()
}

export const api = {
  get: <T>(endpoint: string) =>
    request<T>(endpoint, 'GET'),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, 'POST', body),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, 'DELETE'),
}