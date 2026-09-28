import type { ReactNode } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '@/routes/ProtectedRoute'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Posts from '@/pages/Posts'
import Chatbot from '@/pages/Chatbot'
import Landing from '@/pages/Landing'
import HoursAdmin from '@/pages/HoursAdmin'
import { ServerWakeProvider, useServerWake } from '@/context/ServerWakeContext'
import ServerWakeModal from '@/components/ServerWakeModal'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt'
import { Analytics } from '@vercel/analytics/react'
import { HawkwallFeedProvider } from '@/context/HawkwallFeedContext'
import { useAuth } from '@/context/AuthContext'

function GuestOnlyRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-label="Restoring your session"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/posts" replace />
  }

  return children
}

function AppInner() {
  const { isWaking } = useServerWake()
  const { userId } = useAuth()

  return (
    <>
      <HawkwallFeedProvider key={userId ?? 'anonymous'}>
        <Routes>
          <Route path="/" element={<GuestOnlyRoute><Landing /></GuestOnlyRoute>} />
          <Route path="/login" element={<GuestOnlyRoute><Login /></GuestOnlyRoute>} />
          <Route path="/register" element={<GuestOnlyRoute><Register /></GuestOnlyRoute>} />

          <Route element={<ProtectedRoute />}>
            <Route path="/posts" element={<Posts />} />
            <Route path="/chat" element={<Chatbot />} />
            <Route path="/hours/admin" element={<HoursAdmin />} />
          </Route>
        </Routes>
      </HawkwallFeedProvider>

      <ServerWakeModal isWaking={isWaking} />
      <PwaUpdatePrompt />
    </>
  )
}

export default function App() {
  return (
    <ServerWakeProvider>
      <AppInner />
      <Analytics />
    </ServerWakeProvider>
  )
}
