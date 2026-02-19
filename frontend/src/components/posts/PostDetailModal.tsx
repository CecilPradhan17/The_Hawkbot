import { useEffect, useState } from 'react'
import type { PostResponse } from '@/api/posts.api'
import { getOnePost } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

interface PostDetailModalProps {
  post: PostResponse
  replies: PostResponse[]
  onClose: () => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete?: (postId: number) => void
  onAnswerQuestion?: (question: PostResponse) => void
  onViewPost: (id: number) => void
  currentUserId: number | null
}

export default function PostDetailModal({
  post,
  replies,
  onClose,
  onVote,
  onDelete,
  onAnswerQuestion,
  onViewPost,
  currentUserId,
}: PostDetailModalProps) {
  const isOwner = currentUserId === post.author_id
  const isQuestion = post.type === 'question'
  const isAnswer = post.type === 'answer'

  const [parentQuestion, setParentQuestion] = useState<PostResponse | null>(null)
  const [parentLoading, setParentLoading] = useState(false)

  useEffect(() => {
    if (isAnswer && post.parent_id) {
      setParentLoading(true)
      getOnePost(post.parent_id)
        .then(data => setParentQuestion(data))
        .catch(err => console.error('Failed to fetch parent question:', err))
        .finally(() => setParentLoading(false))
    }
  }, [isAnswer, post.parent_id])

  const titleLabel = isQuestion ? 'Question Details' : isAnswer ? 'Answer Details' : 'Post Details'

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-6 flex-shrink-0">
          <div>
            <h2 className="text-2xl font-bold text-[#8A244B] mb-1">{titleLabel}</h2>
            <div className="flex items-center gap-3 text-sm text-slate-500">
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

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 pr-1">

          {/* For answers: show parent question */}
          {isAnswer && (
            <div className="mb-6">
              <p className="text-xs text-slate-400 uppercase font-medium mb-2">In response to</p>
              {parentLoading ? (
                <p className="text-sm text-slate-400 italic">Loading question...</p>
              ) : parentQuestion ? (
                <div className="bg-[#1B5E8A]/5 border border-[#1B5E8A]/20 rounded-lg px-4 py-3">
                  <p className="text-sm text-[#1B5E8A] font-medium">{parentQuestion.content}</p>
                  <p className="text-xs text-slate-400 mt-1">{getTimeAgo(parentQuestion.created_at)}</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Content */}
          <div className="mb-6">
            <p className="text-slate-700 text-lg leading-relaxed">{post.content}</p>
          </div>

          {/* Status Badge */}
          <div className="mb-6">
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              post.status === 'approved'
                ? 'bg-green-100 text-green-700'
                : post.status === 'disapproved'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
            }`}>
              {post.status}
            </span>
          </div>

          {/* Voting — posts and answers only */}
          {!isQuestion && (
            <div className="flex items-center gap-4 py-4 border-y border-slate-200 mb-6">
              <button
                onClick={() => onVote(post.id, 1)}
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
                onClick={() => onVote(post.id, -1)}
                className="flex items-center gap-1 px-3 py-1 rounded-lg
                           bg-slate-100 hover:bg-red-100 hover:text-red-700
                           transition-colors"
              >
                <span className="text-sm">HawkNah</span>
              </button>
            </div>
          )}

          {/* Replies — questions only */}
          {isQuestion && (
            <div className="mb-6">
              <p className="text-xs text-slate-400 uppercase font-medium mb-3">
                {replies.length} {replies.length === 1 ? 'Answer' : 'Answers'}
              </p>
              {replies.length === 0 ? (
                <p className="text-slate-400 text-sm italic">No answers yet. Be the first!</p>
              ) : (
                <div className="space-y-3">
                  {replies.map((reply) => (
                    <div
                      key={reply.id}
                      className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-200"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-slate-400">{getTimeAgo(reply.created_at)}</span>
                        <div className="flex items-center gap-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${reply.status === 'approved'
                              ? 'bg-green-100 text-green-700'
                              : reply.status === 'disapproved'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {reply.status}
                          </span>
                          <button
                            onClick={() => {
                              onClose()
                              onViewPost(reply.id)
                            }}
                            className="text-[#8A244B] hover:underline text-xs font-medium"
                          >
                            View post
                          </button>
                        </div>
                      </div>
                      <p className="text-slate-700 text-sm">{reply.content}</p>
                      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() => onVote(reply.id, 1)}
                          className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-green-100
                                     hover:text-green-700 transition-colors"
                        >
                          HawkYeah
                        </button>
                        <span className="text-xs font-medium text-slate-600">{reply.vote_count}</span>
                        <button
                          onClick={() => onVote(reply.id, -1)}
                          className="px-2 py-0.5 rounded text-xs bg-slate-100 hover:bg-red-100
                                     hover:text-red-700 transition-colors"
                        >
                          HawkNah
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions — fixed at bottom */}
        <div className="flex gap-3 mt-6 flex-shrink-0 border-t border-slate-100 pt-4">
          {isQuestion && onAnswerQuestion && (
            <button
              onClick={() => {
                onClose()
                onAnswerQuestion(post)
              }}
              className="px-4 py-2 bg-[#1B5E8A] text-white rounded-lg
                         hover:scale-105 transition-all"
            >
              Give Answer
            </button>
          )}
          {isOwner && onDelete && (
            <button
              onClick={() => {
                onDelete(post.id)
                onClose()
              }}
              className="px-4 py-2 bg-red-500 text-white rounded-lg
                         hover:bg-red-600 transition-colors"
            >
              Delete
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