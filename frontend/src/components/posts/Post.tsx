// components/posts/Post.tsx
import type { PostResponse } from '@/api/posts.api'

interface PostProps {
  post: PostResponse
  onPostClick: (id: number) => void  // Changed to pass ID, not the whole post
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete?: (postId: number) => void
  currentUserId: number | null
}

export default function Post({ post, onPostClick, onVote, onDelete, currentUserId }: PostProps) {
  const isOwner = currentUserId === post.author_id

  return (
    <div 
      onClick={() => onPostClick(post.id)}  // Pass ID instead of post object
      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 
                 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="font-medium text-slate-900">@{post.username}</p>
          <p className="text-xs text-slate-500">
            {new Date(post.created_at).toLocaleDateString()}
          </p>
        </div>
        
        {isOwner && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(post.id)
            }}
            className="text-red-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-slate-700 mb-4">{post.content}</p>

      {/* Status Badge */}
      <div className="mb-4">
        <span 
          className={`text-xs px-2 py-1 rounded-full ${
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

      {/* Voting */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onVote(post.id, 1)
          }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg 
                   hover:bg-slate-100 transition-colors"
        >
          <span className="text-lg">⬆️</span>
          <span className="text-sm text-slate-600">Upvote</span>
        </button>

        <span className="font-medium text-slate-700">
          {post.vote_count} votes
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onVote(post.id, -1)
          }}
          className="flex items-center gap-1 px-3 py-1 rounded-lg 
                   hover:bg-slate-100 transition-colors"
        >
          <span className="text-lg">⬇️</span>
          <span className="text-sm text-slate-600">Downvote</span>
        </button>
      </div>
    </div>
  )
}