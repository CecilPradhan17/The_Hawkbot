/**
 * Purpose:
 * - Defines the top-level routing structure for the React application
 * - Acts as the central place for declaring public and protected routes
 *
 * Responsibilities:
 * - Maps URL paths to page-level components
 * - Separates public routes from protected routes
 * - Serves as the integration point for route guards and layouts
 *
 * Used by:
 * - main.tsx (rendered as the root application component)
 *
 * Components:
 * - <Routes />
 *   - Container for all route definitions
 *
 * Routes:
 * - /login → <Login />
 * - /register → <Register />
 *
 * Extra notes:
 * - Protected routes are planned but currently commented out
 * - `ProtectedRoute` will be used to enforce JWT-based authentication
 *
 * Additional info for Future Modification / Integration:
 * - Add protected routes by wrapping them with `<ProtectedRoute />`
 * - This file is the ideal place to introduce layout routes (e.g., navbar, sidebar)
 * - Can be extended to support role-based routing or route-level loaders
 */
import { Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import ProtectedRoute from '@/routes/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Posts from '@/pages/Posts'
import Chatbot from '@/pages/Chatbot'
import { ServerWakeProvider, useServerWake } from '@/context/ServerWakeContext'
import ServerWakeModal from '@/components/ServerWakeModal'
import { setWakeTrigger } from '@/api/request'

// Inner component so it can access the ServerWakeContext
function AppInner() {
  const { isWaking, triggerWake, resolveWake } = useServerWake()

  // Register the wake trigger with request.ts so it can call it globally
  useEffect(() => {
    setWakeTrigger(triggerWake, resolveWake)
  }, [triggerWake, resolveWake])

  return (
    <>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/posts" element={<Posts />} />
          <Route path="/chat" element={<Chatbot />} />
        </Route>
      </Routes>

      {/* Global cold start modal — renders on top of any page */}
      <ServerWakeModal isWaking={isWaking} />
    </>
  )
}

export default function App() {
  return (
    <ServerWakeProvider>
      <AppInner />
    </ServerWakeProvider>
  )
}