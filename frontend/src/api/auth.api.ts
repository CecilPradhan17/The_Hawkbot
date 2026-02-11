/**
 * Purpose:
 * - Defines authentication-related API contracts and request helpers
 * - Serves as the single source of truth for auth request/response shapes
 *
 * Responsibilities:
 * - Declares TypeScript interfaces that mirror backend auth responses
 * - Exposes strongly-typed functions for login and registration
 * - Encapsulates endpoint paths for authentication actions
 *
 * Used by:
 * - Login page
 * - Register page
 * - Auth-related hooks or context providers
 *
 * Types (Backend Contracts):
 * - AuthUser
 *   - Represents the authenticated user returned by the backend
 *   - Includes public user info and JWT token
 *
 * - LoginRequest
 *   - Payload required to authenticate a user
 *
 * - LoginResponse
 *   - Response returned after a successful login
 *
 * - RegisterRequest
 *   - Payload required to register a new user
 *
 * - RegisterResponse
 *   - Response returned after a successful registration
 *
 * API Functions:
 * - login(data)
 *   - Sends user credentials to the backend login endpoint
 *   - Returns authenticated user data and JWT token
 *
 * - register(data)
 *   - Sends registration data to the backend
 *   - Returns a success message
 *
 * Extra notes:
 * - All interfaces are aligned with backend controller responses
 * - Components should rely on these types instead of inline typing
 *
 * Additional info for Future Modification / Integration:
 * - Ideal place to add logout or token refresh endpoints
 * - Can be extended with password reset or email verification flows
 * - If backend response shapes change, updates are isolated to this file
 */

import { api } from './api'

// Types (Backend Contracts)

export interface AuthUser {
  id: number
  email: string
  username: string
  token: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LoginResponse {
  user: AuthUser
}

export interface RegisterRequest {
    email: string
    username: string
    password: string
}

export interface RegisterResponse {
    message: string
}

// API Functions

export function login(data: LoginRequest): Promise<LoginResponse> {
    return api.post<LoginResponse>('/login', data)
}

export function register(data: RegisterRequest): Promise<RegisterResponse> {
    return api.post<RegisterResponse>('/register', data)
}
