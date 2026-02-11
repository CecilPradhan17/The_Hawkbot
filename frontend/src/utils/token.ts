/**
 * Purpose:
 * - Centralizes all client-side token access logic
 * - Provides a safe, reusable way to retrieve authentication tokens
 *
 * Responsibilities:
 * - Reads the JWT from browser storage
 * - Handles storage access failures gracefully
 *
 * Used by:
 * - API utility functions (for attaching Authorization headers)
 * - Auth guards (e.g., ProtectedRoute)
 * - Auth-related hooks or context providers
 *
 * Functions:
 * - getToken()
 *   - Returns:
 *       - The stored JWT string if present
 *       - `null` if no token exists or storage is unavailable
 *   - Behavior:
 *       - Attempts to read the token from `localStorage`
 *       - Catches and suppresses storage access errors
 *
 * Extra notes:
 * - This file is intended to be the single source of truth for token handling
 * - Avoid accessing `localStorage` directly outside of this module
 *
 * Additional info for Future Modification / Integration:
 * - Can be extended with `setToken`, `removeToken`, or `decodeToken` helpers
 * - If switching storage mechanisms (cookies, sessionStorage), only this file needs updating
 * - Useful for implementing token refresh or expiration checks later
 */


export const getToken = (): string | null => {
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}