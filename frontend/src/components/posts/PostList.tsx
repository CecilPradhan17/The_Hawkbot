// components/posts/PostList.tsx
import Post from './Post'
import type { PostResponse } from '@/api/posts.api'

interface PostListProps {
  posts: PostResponse[]
  onPostClick: (id: number) => void  // Changed to ID
  onVote: (postId: number, voteValue: 1 | -1) => void
  onDelete: (postId: number) => void
  currentUserId: number | null
}

export default function PostList({ posts, onPostClick, onVote, onDelete, currentUserId }: PostListProps) {
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
          onPostClick={onPostClick}  // This passes the ID up
          onVote={onVote}
          onDelete={onDelete}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  )
}