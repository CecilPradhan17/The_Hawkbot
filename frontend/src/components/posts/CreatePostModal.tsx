import { useState } from 'react'
import { createPost } from '@/api/posts.api'

interface CreatePostModalProps {
  onClose: () => void
  onPostCreated: (newPost: any) => void
}

export default function CreatePostModal({ onClose, onPostCreated }: CreatePostModalProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return

    setLoading(true)
    setError(null)

    try {
      const newPost = await createPost({ content })
      onPostCreated(newPost) // Tell parent about new post
      onClose() // Close modal
    } catch (err) {
      setError('Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Modal backdrop (dark overlay)
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose} // Click outside to close
    >
      {/* Modal content */}
      <div 
        className="bg-white rounded-2xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold text-[#8A244B]">Create Post</h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={6}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 
                     focus:outline-none focus:ring-2 focus:ring-[#8A244B] 
                     resize-none"
            required
          />

          {error && (
            <p className="text-red-600 text-sm mt-2">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg 
                       hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex-1 px-4 py-2 bg-[#8A244B] text-white rounded-lg
                       hover:scale-105 disabled:opacity-50 disabled:hover:scale-100
                       transition-all"
            >
              {loading ? 'Posting...' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}