import { useState, useRef, useEffect } from 'react'
import { createPost } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'

interface AskQuestionModalProps {
  onClose: () => void
  onPostCreated: (newPost: PostResponse) => void
  initialContent?: string
  fromChatbot?: boolean
}

const MAX_QUESTION_LENGTH = 250
type ComposerMode = 'question' | 'post'

export default function AskQuestionModal({ onClose, onPostCreated, initialContent = '', fromChatbot = false }: AskQuestionModalProps) {
  const [content, setContent] = useState(initialContent)
  const [mode, setMode] = useState<ComposerMode>('question')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus to open keyboard on mobile
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const remainingChars = MAX_QUESTION_LENGTH - content.length
  const isOverLimit = content.length > MAX_QUESTION_LENGTH
  const isQuestion = mode === 'question'
  const contentLabel = isQuestion ? 'Question' : 'Post'

  const changeMode = (nextMode: ComposerMode) => {
    setMode(nextMode)
    setError(null)
    textareaRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) { setError(`${contentLabel} cannot be empty`); return }
    if (isOverLimit) { setError(`${contentLabel} cannot exceed ${MAX_QUESTION_LENGTH} characters`); return }
    setLoading(true)
    setError(null)
    try {
      const newPost = await createPost({ content, type: mode })
      onPostCreated(newPost)
      onClose()
    } catch {
      setError(isQuestion ? 'Failed to submit question' : 'Failed to create post')
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
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className={`text-2xl font-bold ${isQuestion ? 'text-[#1B5E8A]' : 'text-[#8A244B]'}`}>
              {fromChatbot ? 'Ask the Hawkwall' : isQuestion ? 'Ask a Question' : 'Create a Post'}
            </h2>
            {fromChatbot && <p className="mt-1 text-sm text-slate-500">Hawkbot couldn't verify an answer. Review the draft, then post it for other students.</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 active:scale-95 transition-all text-2xl"
          >
            ×
          </button>
        </div>

        {!fromChatbot && (
          <div className="mb-4 grid grid-cols-2 rounded-xl bg-slate-100 p-1" aria-label="Choose post type">
            <button
              type="button"
              onClick={() => changeMode('question')}
              aria-pressed={isQuestion}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isQuestion ? 'bg-white text-[#1B5E8A] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Ask Question
            </button>
            <button
              type="button"
              onClick={() => changeMode('post')}
              aria-pressed={!isQuestion}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !isQuestion ? 'bg-white text-[#8A244B] shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Create Post
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={isQuestion ? 'What would you like to ask?' : "What's on your mind?"}
            rows={6}
            // text-base (16px) prevents iOS auto-zoom on focus
            className={`w-full px-4 py-3 rounded-lg border resize-none text-base
                        focus:outline-none focus:ring-2 transition-colors
              ${isOverLimit
                ? 'border-red-300 focus:ring-red-500'
                : isQuestion ? 'border-slate-200 focus:ring-[#1B5E8A]' : 'border-slate-200 focus:ring-[#8A244B]'
              }`}
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
              className={`flex-1 px-4 py-2 text-white rounded-lg
                         hover:scale-105 active:scale-95 disabled:opacity-50
                         disabled:hover:scale-100 disabled:cursor-not-allowed transition-all
                         ${isQuestion ? 'bg-[#1B5E8A]' : 'bg-[#8A244B]'}`}
            >
              {loading ? 'Posting...' : fromChatbot ? 'Post to Hawkwall' : isQuestion ? 'Ask' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
