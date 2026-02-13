/**
 * Purpose:
 * - Manages global authentication state for the frontend application
 * - Provides login/logout logic and authentication status
 *
 * Responsibilities:
 * - Stores and synchronizes JWT token in React state
 * - Persists token in localStorage
 * - Exposes authentication utilities via React Context
 *
 * Used by:
 * - App root (wraps entire application)
 * - ProtectedRoute component
 * - Login page
 * - Any component requiring auth state
 *
 * Context Interface:
 * - token
 *   - Current JWT token (null if unauthenticated)
 *
 * - isAuthenticated
 *   - Boolean flag derived from token presence
 *
 * - login(data)
 *   - Sends login request to backend
 *   - Stores returned JWT in localStorage
 *   - Updates authentication state
 *
 * - logout()
 *   - Clears token from localStorage
 *   - Resets authentication state
 *
 * Lifecycle Behavior:
 * - On mount:
 *     - Checks localStorage for an existing token
 *     - Restores authentication state if token exists
 *
 * Hook:
 * - useAuth()
 *   - Custom hook to access auth context
 *   - Throws error if used outside AuthProvider
 *
 * Extra notes:
 * - Centralizes authentication logic in one place
 * - Prevents token duplication logic across components
 *
 * Additional info for Future Modification / Integration:
 * - Can be extended to:
 *     - Decode JWT and store user info
 *     - Implement token refresh logic
 *     - Validate token expiration on load
 *     - Integrate with backend logout endpoint
 * - Could migrate token storage from localStorage to HTTP-only cookies for improved security
 */

import React, { createContext, useContext, useEffect, useState } from "react"
import { login as loginRequest } from "@/api/auth.api"
import type { LoginRequest } from "@/api/auth.api"

// Types (Backend Contracts)
interface AuthContextType {
  token: string | null
  userId: number | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  logout: () => void
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider 
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load token on app start
  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const storedUserId = localStorage.getItem("userId")
    if (storedToken && storedUserId) {
      setToken(storedToken)
      setUserId(JSON.parse(storedUserId))
    }
    setIsLoading(false)
  }, [])

  const login = async (data: LoginRequest) => {
    const res = await loginRequest(data)
    const recievedToken = res.token
    const recievedUserId = res.id

    localStorage.setItem("token", recievedToken)
    localStorage.setItem("userId", JSON.stringify(recievedUserId))

    setToken(recievedToken)
    setUserId(recievedUserId)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
    localStorage.removeItem("userId")
    setUserId(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        userId,
        isAuthenticated: !!token,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Hook
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
