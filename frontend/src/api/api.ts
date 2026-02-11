/**
 * Purpose:
 * - Provides a simple, standardized interface for making API requests
 * - Abstracts HTTP method details away from components
 *
 * Responsibilities:
 * - Exposes helper methods for common HTTP operations
 * - Delegates request execution to the centralized `request` utility
 * - Ensures consistent typing and usage across the frontend
 *
 * Used by:
 * - Page components (Login, Register, Posts, etc.)
 * - Frontend service or data-access layers
 *
 * Functions:
 * - api.get<T>(endpoint)
 *   - Sends a GET request to the given endpoint
 *   - Returns a typed response
 *
 * - api.post<T>(endpoint, body)
 *   - Sends a POST request with a JSON body
 *   - Returns a typed response
 *
 * - api.delete<T>(endpoint)
 *   - Sends a DELETE request to the given endpoint
 *   - Returns a typed response
 *
 * Extra notes:
 * - This file intentionally contains no business logic
 * - Keeps components clean and focused on UI concerns
 *
 * Additional info for Future Modification / Integration:
 * - New HTTP methods (PUT, PATCH) can be added here without touching components
 * - Can be extended to group endpoints by domain (e.g., `api.auth`, `api.posts`)
 * - Useful location for adding request-level logging or analytics
 */

import request from "./request"

export const api = {
  get: <T>(endpoint: string) => 
    request<T>(endpoint, 'GET'),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, 'POST', body),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, 'DELETE'),
}
