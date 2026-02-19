import Post from './Post'
import type { PostResponse } from '@/api/posts.api'

interface PostListProps {
  posts: PostResponse[]
  repliesMap: Record<number, PostResponse[]>
  repliesOpenMap: Record<number, boolean>
  onPostClick: (id: number) => void
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete: (postId: number) => void
  onAnswerQuestion: (question: PostResponse) => void
  onToggleReplies: (questionId: number) => void
  currentUserId: number | null
}

export default function PostList({
  posts,
  repliesMap,
  repliesOpenMap,
  onPostClick,
  onVote,
  onDelete,
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
          onPostClick={onPostClick}
          onVote={onVote}
          onDelete={onDelete}
          onAnswerQuestion={onAnswerQuestion}
          onToggleReplies={onToggleReplies}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}