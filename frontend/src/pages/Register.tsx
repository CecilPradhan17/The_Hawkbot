// pages/Register.tsx
import { useState } from 'react'
import { register } from '@/api/auth.api'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await register({ username, email, password })
      console.log('REGISTER SUCCESS:', res)
      navigate('/login')
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF3E1] flex items-center justify-center p-4 relative overflow-hidden">
      
      <div className="w-full max-w-md relative">
        {/* Card */}
        <div className="">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl text-[#8A244B] font-bold  mb-2">
              Join Hawkbot
            </h1>
            <p className="text-slate-600 text-sm">
              Create your account and start posting
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="group">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm
                         focus:outline-none focus:ring-2 focus:ring-black-500 focus:border-transparent
                         transition-all duration-200 placeholder:text-slate-400
                         group-hover:border-slate-300"
                placeholder="johndoe"
              />
            </div>

            {/* Email */}
            <div className="group">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm
                         focus:outline-none focus:ring-2 focus:ring-black-500 focus:border-transparent
                         transition-all duration-200 placeholder:text-slate-400
                         group-hover:border-slate-300"
                placeholder="you@example.com"
              />
            </div>

            {/* Password */}
            <div className="group">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-white/50 backdrop-blur-sm
                         focus:outline-none focus:ring-2 focus:ring-black-500 focus:border-transparent
                         transition-all duration-200 placeholder:text-slate-400
                         group-hover:border-slate-300"
                placeholder="••••••••"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#8A244B] text-white py-3 px-4 rounded-lg
                       font-medium shadow-lg shadow-black-400/30 
                       hover:shadow-xl hover:shadow-black-500/40 hover:scale-[1.02]
                       active:scale-[0.98]
                       disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                       transition-all duration-200"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle 
                      className="opacity-25" 
                      cx="12" 
                      cy="12" 
                      r="10" 
                      stroke="currentColor" 
                      strokeWidth="4"
                      fill="none"
                    />
                    <path 
                      className="opacity-75" 
                      fill="currentColor" 
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Creating account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm">
              Already have an account?{' '}
              <a 
                href="/login" 
                className="text-[#8A244B] font-medium hover:text-blue-700 transition-colors"
              >
                Sign in
              </a>
            </p>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="text-center text-[#8A244B] mt-8 text-slate-700">
          <p><small>Hawk Yeah! Let's Go!</small></p>
        </div>
      </div>
    </div>
  )
}