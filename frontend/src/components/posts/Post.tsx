import { useState } from 'react'
import type { PostResponse } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

interface PostProps {
  post: PostResponse
  replies: PostResponse[]
  repliesOpen: boolean
  onPostClick: (id: number) => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete?: (postId: number) => void
  onAnswerQuestion?: (question: PostResponse) => void
  onToggleReplies: (questionId: number) => void
  currentUserId: number | null
}

export default function Post({
  post,
  replies,
  repliesOpen,
  onPostClick,
  onVote,
  onDelete,
  onAnswerQuestion,
  onToggleReplies,
  currentUserId,
}: PostProps) {
  const isOwner = currentUserId === post.author_id
  const isQuestion = post.type === 'question'

  // Local loading only — just for the button text while fetching
  const [repliesLoading, setRepliesLoading] = useState(false)

  const handleToggleReplies = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setRepliesLoading(true)
    await onToggleReplies(post.id)
    setRepliesLoading(false)
  }

  // Use reply_count from the post data before replies are fetched,
  // then switch to replies.length once the replies are loaded
  const replyCountDisplay = repliesOpen ? replies.length : post.reply_count

  return (
    <div
      onClick={() => onPostClick(post.id)}
      className="bg-white rounded-xl p-6 shadow-sm border border-slate-200
                 hover:shadow-md transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <p className="text-xs text-slate-500">{getTimeAgo(post.created_at)}</p>
        {isOwner && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(post.id)
            }}
            className="text-black-500 hover:text-red-700 text-sm"
          >
            Delete
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-slate-700 mb-4">{post.content}</p>

      {/* Footer actions */}
      <div className="flex items-center gap-4 pt-3 border-t border-slate-100">
        {isQuestion ? (
          <>
            {/* Replies toggle */}
            <button
              onClick={handleToggleReplies}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-slate-100 hover:bg-[#1B5E8A]/10 hover:text-[#1B5E8A]
                         transition-colors text-sm"
            >
              {repliesLoading
                ? 'Loading...'
                : repliesOpen
                  ? 'Hide replies'
                  : `${replyCountDisplay} replies`
              }
            </button>

            {/* Give answer */}
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAnswerQuestion?.(post)
              }}
              className="flex items-center gap-1 px-3 py-1 rounded-lg
                         bg-[#8A244B]/10 hover:bg-[#8A244B]/20 text-[#8A244B]
                         transition-colors text-sm"
            >
              Give Answer
            </button>
          </>
        ) : (
          <>
            {/* Vote buttons — posts and answers only */}
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
            <span className="font-medium text-slate-700">{post.vote_count}</span>
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
          </>
        )}
      </div>

      {/* Replies list */}
      {repliesOpen && (
        <div
          className="mt-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          {replies.length === 0 ? (
            <p className="text-slate-400 text-sm italic">No answers yet. Be the first!</p>
          ) : (
            replies.map((reply) => {
              return (
                <div
                  key={reply.id}
                  className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200"
                >
                  {/* Reply header */}
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-slate-400">{getTimeAgo(reply.created_at)}</span>
                    <div className="flex items-center gap-3">
                      {isOwner && onDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(reply.id)
                          }}
                          className="text-black-500 hover:text-red-700 text-xs"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Reply content */}
                  <p className="text-slate-700 text-sm">{reply.content}</p>

                  {/* Answer votes */}
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onVote(reply.id, 1)
                      }}
                      className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-green-100
                                 hover:text-green-700 transition-colors"
                    >
                      HawkYeah
                    </button>
                    <span className="text-xs font-medium text-slate-600">{reply.vote_count}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onVote(reply.id, -1)
                      }}
                      className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-red-100
                                 hover:text-red-700 transition-colors"
                    >
                      HawkNah
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}