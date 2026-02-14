/**
 * ProtectedRoute.tsx
 *
 * Purpose:
 * - Restricts access to authenticated-only routes in the application
 * - Acts as a route guard based on the presence of a JWT
 *
 * Responsibilities:
 * - Checks for an authentication token on route access
 * - Redirects unauthenticated users to the login page
 * - Renders protected routes for authenticated users
 *
 * Used by:
 * - App.tsx (to wrap protected routes)
 *
 * Components:
 * - <Outlet />
 *   - Renders nested routes when authentication passes
 *
 * Extra notes:
 * - Relies on isLoading state from useAuth to wait for useEffect to load up the token in state
 * - Relies on token presence rather than token validity
 * - Token validation occurs on the backend via JWT middleware
 *
 * Additional info for Future Modification / Integration:
 * - Can be extended to validate token expiration client-side
 * - Useful integration point for role-based access control
 * - Can display loading or fallback UI during auth checks
 * - Works seamlessly with nested and layout routes
 */

import { Navigate, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

const ProtectedRoute = () => {
  
  const { token, isLoading } = useAuth()
  
  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
