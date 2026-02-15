// components/posts/Post.tsx
import type { PostResponse } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

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
          {/* <p className="font-medium text-slate-900">@{post.username}</p> */}
          <p className="text-xs text-slate-500">
            {getTimeAgo(post.created_at)}
          </p>
        </div>
        
        {isOwner && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(post.id)
            }}
            className="text-Black-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-slate-700 mb-4">{post.content}</p>

      {/* Voting */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
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

        <span className="font-medium text-slate-700">
          {post.vote_count}
        </span>

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
    </div>
  )
}