import { getToken } from "@/utils/token"

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

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

  const res = await fetch(`${BASE_URL}${endpoint}`, fetchOptions).catch(() => {
    throw new Error('Could not reach the server. Please try again.')
  })

  // Handle token expiration
  if (res.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
      const errorData = await res.json().catch(() => null)
      const onLoginPage = typeof window !== 'undefined' && window.location.pathname === '/login'
      // If this was not a login request and user isn't on login page, redirect
      if (!onLoginPage && endpoint !== '/login') {
        window.location.href = '/login'
        throw new Error('Session expired. Please login again.')
      }
      // For login requests, throw the backend-provided message (or a sensible default)
      const message = errorData?.message || 'Invalid email or password.'
      throw new Error(message)
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
