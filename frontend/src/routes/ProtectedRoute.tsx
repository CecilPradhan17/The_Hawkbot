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

import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { jwtDecode } from "jwt-decode"
import PostListSkeleton from "@/components/posts/PostListSkeleton"

const ProtectedRoute = () => {
  const location = useLocation()
  const { token, isLoading } = useAuth()
  
  if (isLoading) {
    return <ProtectedRouteSkeleton showChat={location.pathname === '/chat'} />
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  // Check if token is expired
  try {
    const decoded: any = jwtDecode(token)
    const currentTime = Date.now() / 1000
    if (decoded.exp < currentTime) {
      return <Navigate to="/login" replace />
    }
  } catch (error) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}

function ProtectedRouteSkeleton({ showChat }: { showChat: boolean }) {
  return (
    <div className="min-h-screen bg-[#FAF3E1]" role="status" aria-label="Loading your account">
      <div className="h-[68px] sm:h-[76px] bg-[#8A244B] border-b border-[#6d1c3a] px-4 sm:px-6 flex items-center justify-between">
        <div className="h-9 w-20 rounded-xl bg-white/15 animate-pulse motion-reduce:animate-none" />
        <div className="h-7 w-28 rounded-full bg-white/20 animate-pulse motion-reduce:animate-none" />
        <div className="h-9 w-20 rounded-lg bg-white/15 animate-pulse motion-reduce:animate-none" />
      </div>

      {showChat ? (
        <div className="h-[calc(100vh-76px)] max-w-3xl mx-auto px-4 flex flex-col items-center justify-center gap-4 animate-pulse motion-reduce:animate-none">
          <div className="h-16 w-16 rounded-xl bg-slate-200" />
          <div className="h-7 w-64 max-w-full rounded-full bg-slate-200" />
          <div className="absolute bottom-6 h-14 w-[calc(100%-2rem)] max-w-3xl rounded-2xl bg-white border border-slate-200" />
        </div>
      ) : (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <PostListSkeleton />
        </main>
      )}
      <span className="sr-only">Loading your account...</span>
    </div>
  )
}

export default ProtectedRoute
