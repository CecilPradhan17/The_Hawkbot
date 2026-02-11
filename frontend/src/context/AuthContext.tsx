import React, { createContext, useContext, useEffect, useState } from "react"
import { login as loginRequest } from "@/api/auth.api"
import type { LoginRequest } from "@/api/auth.api"

// Types (Backend Contracts)
interface AuthContextType {
  token: string | null
  isAuthenticated: boolean
  login: (data: LoginRequest) => Promise<void>
  logout: () => void
}

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Provider 
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null)

  // Load token on app start
  useEffect(() => {
    const storedToken = localStorage.getItem("token")
    if (storedToken) {
      setToken(storedToken)
    }
  }, [])

  const login = async (data: LoginRequest) => {
    const res = await loginRequest(data)
    const token = res.user.token

    localStorage.setItem("token", token)
    setToken(token)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setToken(null)
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
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
