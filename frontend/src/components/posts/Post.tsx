import { useState } from 'react'
import type { PostResponse } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

interface PostProps {
  post: PostResponse
  replies: PostResponse[]
  repliesOpen: boolean
  onViewPost: (id: number) => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onAnswerQuestion?: (question: PostResponse) => void
  onToggleReplies: (questionId: number) => void
  currentUserId: number | null
}

export default function Post({
  post,
  replies,
  repliesOpen,
  onViewPost,
  onVote,
  onAnswerQuestion,
  onToggleReplies
}: PostProps) {
  const isQuestion = post.type === 'question'
  const [repliesLoading, setRepliesLoading] = useState(false)

  const handleToggleReplies = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRepliesLoading(true)
    await onToggleReplies(post.id)
    setRepliesLoading(false)
  }

  const replyCountDisplay = repliesOpen ? replies.length : post.reply_count

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs text-slate-500">{getTimeAgo(post.created_at)}</p>
        <button
          onClick={() => onViewPost(post.id)}
          className="text-[#8A244B] hover:underline active:scale-95 transition-all text-sm font-medium"
        >
          View post
        </button>
      </div>

      {/* Content */}
      <p className="text-slate-700 mb-4">{post.content}</p>

      {/* Footer actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
        {isQuestion ? (
          <>
            <button
              onClick={handleToggleReplies}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-slate-100 hover:bg-[#1B5E8A]/10 hover:text-[#1B5E8A]
                         active:scale-95 transition-all text-sm"
            >
              {repliesLoading
                ? 'Loading...'
                : repliesOpen
                  ? 'Hide replies'
                  : `${replyCountDisplay} replies`
              }
            </button>
            <button
              onClick={() => onAnswerQuestion?.(post)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-[#8A244B]/10 hover:bg-[#8A244B]/20 text-[#8A244B]
                         active:scale-95 transition-all text-sm"
            >
              Give Answer
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onVote(post.id, 1)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-slate-100 hover:bg-green-100 hover:text-green-700
                         active:scale-95 transition-all"
            >
              <span className="text-sm">HawkYeah</span>
            </button>
            <span className="font-medium text-slate-700">{post.vote_count}</span>
            <button
              onClick={() => onVote(post.id, -1)}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-slate-100 hover:bg-red-100 hover:text-red-700
                         active:scale-95 transition-all"
            >
              <span className="text-sm">HawkNah</span>
            </button>
          </>
        )}
      </div>

      {/* Replies list */}
      {repliesOpen && (
        <div className="mt-4 space-y-3">
          {replies.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No answers yet. Be the first!</p>
          ) : (
            replies.map((reply) => (
              <div
                key={reply.id}
                className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200"
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-slate-400">{getTimeAgo(reply.created_at)}</span>
                  <button
                    onClick={() => onViewPost(reply.id)}
                    className="text-[#8A244B] hover:underline active:scale-95 transition-all text-xs font-medium"
                  >
                    View post
                  </button>
                </div>
                <p className="text-slate-700 text-sm">{reply.content}</p>
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                  <button
                    onClick={() => onVote(reply.id, 1)}
                    className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-green-100
                               hover:text-green-700 active:scale-95 transition-all"
                  >
                    HawkYeah
                  </button>
                  <span className="text-xs font-medium text-slate-600">{reply.vote_count}</span>
                  <button
                    onClick={() => onVote(reply.id, -1)}
                    className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-red-100
                               hover:text-red-700 active:scale-95 transition-all"
                  >
                    HawkNah
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}