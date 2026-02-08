import { Routes, Route } from "react-router-dom"
import ProtectedRoute from "@/routes/ProtectedRoute"
import Login from "@/pages/Login"
import Register from "@/pages/Register"
import Posts from "@/pages/Posts"

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected */}
      <Route element={<ProtectedRoute />}>
        <Route path="/posts" element={<Posts />} />
      </Route>
    </Routes>
  )
}

