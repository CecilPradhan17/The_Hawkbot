import Post from './Post'
import type { PostResponse } from '@/api/posts.api'

interface PostListProps {
  posts: PostResponse[]
  repliesMap: Record<number, PostResponse[]>
  repliesOpenMap: Record<number, boolean>
  onViewPost: (id: number) => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onAnswerQuestion: (question: PostResponse) => void
  onToggleReplies: (questionId: number) => void
  currentUserId: number | null
}

export default function PostList({
  posts,
  repliesMap,
  repliesOpenMap,
  onViewPost,
  onVote,
  onAnswerQuestion,
  onToggleReplies,
  currentUserId,
}: PostListProps) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500 text-lg">No posts yet. Be the first to post!</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <Post
          key={post.id}
          post={post}
          replies={repliesMap[post.id] ?? []}
          repliesOpen={repliesOpenMap[post.id] ?? false}
          onViewPost={onViewPost}
          onVote={onVote}
          onAnswerQuestion={onAnswerQuestion}
          onToggleReplies={onToggleReplies}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}