import { getToken } from "@/utils/token"

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5173'

type HttpMethod = 'GET' | 'POST' | 'DELETE'

export default async function request<T>(
  endpoint: string,
  method: HttpMethod,
  body?: unknown
): Promise<T> {
  const token = getToken()

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  // Handle non-2xx responses
  if (!res.ok) {
    const errorData = await res.json().catch(() => null)
    const message = errorData?.message || 'Request failed'
    throw new Error(message)
  }

  // Some endpoints may return no content (204)
  if (res.status === 204) {
    return null as T
  }

  return res.json()
}