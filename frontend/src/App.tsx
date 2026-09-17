import { Routes, Route } from 'react-router-dom'
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

function AppInner() {
  const { isWaking } = useServerWake()

  return (
    <>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/posts" element={<Posts />} />
          <Route path="/chat" element={<Chatbot />} />
          <Route path="/hours/admin" element={<HoursAdmin />} />
        </Route>
      </Routes>

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
