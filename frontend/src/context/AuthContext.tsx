/**
 * Purpose:
 * - Manages global authentication state for the frontend application
 * - Provides login/logout logic and authentication status
 *
 * Responsibilities:
 * - Stores and synchronizes JWT token in React state
 * - Persists token and userId in localStorage
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
 *   - Stores returned JWT and userIdin localStorage
 *   - Updates authentication state
 *
 * - logout()
 *   - Clears token and userId from localStorage
 *   - Resets authentication state
 *
 * Lifecycle Behavior:
 * - On mount:
 *     - Checks localStorage for an existing token and userId 
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
 *     - Validate token expiration on load
 *     - Integrate with backend logout endpoint
 * - Could migrate token storage from localStorage to HTTP-only cookies for improved security
 */

import React, { createContext, useContext, useEffect, useState } from "react"
import { login as loginRequest } from "@/api/auth.api"
import type { LoginRequest } from "@/api/auth.api"
import { jwtDecode } from "jwt-decode"
//import { useNavigate } from "react-router-dom"

interface AuthContextType {
  token: string | null
  userId: number | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const isTokenExpired = (token: string): boolean => {
  try {
    const decoded: any = jwtDecode(token)
    const currentTime = Date.now() / 1000 // Convert to seconds
    return decoded.exp < currentTime
  } catch (error) {
    return true 
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    setToken(null)
    setUserId(null)
  }

  // Check token validity on mount
  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    const storedUserId = localStorage.getItem("userId")

    if (storedToken && storedUserId) {
      if (isTokenExpired(storedToken)) {
        logout()
      } else {
        setToken(storedToken)
        setUserId(JSON.parse(storedUserId))
      }
    }
    
    setIsLoading(false)
  }, [])

  useEffect(() => {
    if (!token) return

    const checkAndLogout = () => {
      if (isTokenExpired(token)) {
        console.log('[AuthContext] Token expired, logging out')
        logout()
        window.location.href = '/login' 
      }
    }

    // Check immediately on mount
    console.log('[AuthContext] Checking token expiration')
    checkAndLogout()

    // Then check frequently (every 1 second) to catch expiration quickly
    const interval = setInterval(checkAndLogout, 1000)

    return () => clearInterval(interval)
  }, [token])

  const login = async (data: LoginRequest) => {
    const res = await loginRequest(data)
    const receivedToken = res.token
    const receivedUserId = res.id

    localStorage.setItem("token", receivedToken)
    localStorage.setItem("userId", JSON.stringify(receivedUserId))
    
    setToken(receivedToken)
    setUserId(receivedUserId)
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

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}