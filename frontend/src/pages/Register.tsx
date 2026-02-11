// pages/Register.tsx
import { useState } from 'react'
import { register } from '@/api/auth.api'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await register({ username, email, password })
      console.log('REGISTER SUCCESS:', res)
    } catch (err) {
      console.error('REGISTER ERROR:', err)
    }
  }

  return (
    <div className="register-page">
      <h1>Register</h1>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit">Register</button>
      </form>
    </div>
  )
}
