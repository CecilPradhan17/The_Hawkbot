/**
 *
 * Purpose:
 * - Provides a centralized HTTP request utility for the frontend
 * - Standardizes API communication and authentication handling
 *
 * Responsibilities:
 * - Builds and sends HTTP requests to the backend API
 * - Automatically attaches JWTs to authenticated requests
 * - Handles JSON serialization and response parsing
 * - Normalizes error handling for non-successful responses
 *
 * Used by:
 * - Page components (Login, Register, Posts, etc.)
 * - Service or data-fetching utilities
 * - Any frontend logic that communicates with the backend API
 *
 * Functions:
 * - request<T>(endpoint, method, body?)
 *   - Parameters:
 *       - endpoint: API path relative to the base URL (e.g., `/login`, `/posts`)
 *       - method: HTTP method (`GET`, `POST`, `DELETE`)
 *       - body: Optional request payload (automatically JSON-stringified)
 *   - Returns:
 *       - A Promise resolving to type `T`
 *   - Behavior:
 *       - Reads the JWT using `getToken()`
 *       - Attaches Authorization header when a token exists
 *       - Sends a fetch request to the configured backend API
 *       - Throws a normalized error for non-2xx responses
 *       - Safely handles 204 No Content responses
 *
 * Security notes:
 * - JWTs are never manually passed by components
 * - Authorization headers are attached automatically and consistently
 *
 * Error handling:
 * - Throws a descriptive Error for failed requests
 * - Falls back to a generic error message if response parsing fails
 *
 * Extra notes:
 * - Base API URL is configurable via environment variables
 * - Strong typing via generics improves safety and DX
 *
 * Additional info for Future Modification / Integration:
 * - Can be extended to support PUT/PATCH methods
 * - Ideal place to add request/response interceptors (logging, retries)
 * - Can integrate token refresh or global logout on 401 responses
 * - If backend routes change, updates are isolated to this layer
 */

import { getToken } from "@/utils/token"

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'

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