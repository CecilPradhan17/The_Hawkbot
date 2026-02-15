import type { PostResponse } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

interface PostDetailModalProps {
  post: PostResponse
  onClose: () => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete?: (postId: number) => void
  currentUserId: number | null
}

export default function PostDetailModal({ 
  post, 
  onClose, 
  onVote, 
  onDelete, 
  currentUserId 
}: PostDetailModalProps) {
  const isOwner = currentUserId === post.author_id

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#8A244B] mb-1">Post Details</h2>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              {/* <span className="font-medium">@{post.username}</span>
              <span>•</span> */}
              <span>{getTimeAgo(post.created_at)}</span>
            </div>
          </div>
          
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-3xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="text-slate-700 text-lg leading-relaxed">{post.content}</p>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          <span 
            className={`text-xs px-3 py-1 rounded-full font-medium ${
              post.status === 'approved' 
                ? 'bg-green-100 text-green-700' 
                : post.status === 'disapproved'
                ? 'bg-red-100 text-red-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}
          >
            {post.status}
          </span>
        </div>

        {/* Voting Section */}
        <div className="flex items-center gap-4 py-4 border-y border-slate-200">
          <button
          onClick={(e) => {
            e.stopPropagation()
            onVote(post.id, 1)
          }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg 
                    bg-slate-100 hover:bg-green-100 hover:text-green-700
                    transition-colors"
        >
          <span className="text-sm">HawkYeah</span>
        </button>

          <div className="text-center">
            <p className="text-2xl font-bold text-[#8A244B]">{post.vote_count}</p>
            <p className="text-xs text-slate-500">votes</p>
          </div>

          <button
          onClick={(e) => {
            e.stopPropagation()
            onVote(post.id, -1)
          }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg 
                    bg-slate-100 hover:bg-red-100 hover:text-red-700
                    transition-colors"
        >
          <span className="text-sm">HawkNah</span>
        </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {isOwner && onDelete && (
            <button
              onClick={() => {
                onDelete(post.id)
                onClose()
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg 
                       hover:bg-red-600 transition-colors"
            >
              Delete Post
            </button>
          )}
          
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-200 rounded-lg 
                     hover:bg-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}