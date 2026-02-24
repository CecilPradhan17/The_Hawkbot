import { useState } from 'react'
import { createPost } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'

interface AskQuestionModalProps {
  onClose: () => void
  onPostCreated: (newPost: PostResponse) => void
}

const MAX_QUESTION_LENGTH = 500

export default function AskQuestionModal({ onClose, onPostCreated }: AskQuestionModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remainingChars = MAX_QUESTION_LENGTH - content.length
  const isOverLimit = content.length > MAX_QUESTION_LENGTH

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) { setError('Question cannot be empty'); return }
    if (isOverLimit) { setError(`Question cannot exceed ${MAX_QUESTION_LENGTH} characters`); return }
    setLoading(true)
    setError(null)
    try {
      const newPost = await createPost({ content, type: 'question' })
      onPostCreated(newPost)
      onClose()
    } catch {
      setError('Failed to submit question')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-[#1B5E8A]">Ask a Question</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 active:scale-95 transition-all text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What would you like to ask?"
            rows={6}
            className={`w-full px-4 py-3 rounded-lg border resize-none
                        focus:outline-none focus:ring-2 transition-colors
              ${isOverLimit ? 'border-red-300 focus:ring-red-500' : 'border-slate-200 focus:ring-[#1B5E8A]'}`}
            required
          />
          <div className="flex justify-between items-center mt-2">
            <span className={`text-sm ${
              isOverLimit ? 'text-red-600 font-medium' : remainingChars < 50 ? 'text-yellow-600' : 'text-slate-500'
            }`}>
              {isOverLimit ? `${Math.abs(remainingChars)} characters over limit` : `${remainingChars} characters remaining`}
            </span>
          </div>
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg
                         hover:bg-slate-50 active:scale-95 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim() || isOverLimit}
              className="flex-1 px-4 py-2 bg-[#1B5E8A] text-white rounded-lg
                         hover:scale-105 active:scale-95 disabled:opacity-50
                         disabled:hover:scale-100 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Submitting...' : 'Ask'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}