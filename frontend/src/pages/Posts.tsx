// pages/PostsPage.tsx
import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAllPosts, deletePost, votePost } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'
import CreatePostModal from '@/components/posts/CreatePostModal'
import PostList from '@/components/posts/PostList'
import PostDetailModal from '@/components/posts/PostDetailModal'

export default function Posts() {
  const { userId } = useAuth()
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [selectedPost, setSelectedPost] = useState<PostResponse | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch all posts on mount
  useEffect(() => {
    async function fetchPosts() {
      try {
        const data = await getAllPosts()
        setPosts(data)
      } catch (err) {
        setError('Failed to load posts')
      } finally {
        setLoading(false)
      }
    }
    fetchPosts()
  }, [])

  // Handle new post created
  const handlePostCreated = (newPost: PostResponse) => {
    setPosts([newPost, ...posts])
  }

  // Handle delete
  const handleDelete = async (postId: number) => {
    try {
      await deletePost(postId)
      setPosts(prev => prev.filter(p => p.id !== postId))
      if (selectedPost?.id === postId) {
        setSelectedPost(null)
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  // Handle vote with optimistic updates
  const handleVote = async (postId: number, voteValue: 1 | -1) => {
    // Optimistic update
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, vote_count: post.vote_count + voteValue }
        : post
    ))

    if (selectedPost?.id === postId) {
      setSelectedPost(prev =>
        prev ? { ...prev, vote_count: prev.vote_count + voteValue } : null
      )
    }

    try {
      const response = await votePost(postId, { vote: voteValue })
      
      // Sync with backend
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, vote_count: response.voteCount }
          : post
      ))

      if (selectedPost?.id === postId) {
        setSelectedPost(prev =>
          prev ? { ...prev, vote_count: response.voteCount } : null
        )
      }
    } catch (error) {
      // Rollback on failure
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, vote_count: post.vote_count - voteValue }
          : post
      ))

      if (selectedPost?.id === postId) {
        setSelectedPost(prev =>
          prev ? { ...prev, vote_count: prev.vote_count - voteValue } : null
        )
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF3E1]">
      {/* Header */}
      <header className="bg-[#8A244B] border-b border-slate-200 px-6 py-4 z-40">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <button className="px-4 py-2 text-slate-200 hover:text-white transition-colors">
            Chatbot
          </button>
          
          <h1 className="text-2xl font-bold text-white">Hawkbot</h1>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-white text-[#8A244B] rounded-lg hover:scale-105 transition-all"
          >
            Create Post
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {loading && (
          <div className="text-center py-12">
            <p className="text-slate-600">Loading posts...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!loading && !error && (
          <PostList
            posts={posts}
            onPostClick={(id: number) => {
              const post = posts.find(p => p.id === id) || null
              setSelectedPost(post)
            }}
            onVote={handleVote}
            onDelete={handleDelete}
            currentUserId={userId}
          />
        )}
      </main>

      {/* Create Post Modal */}
      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          onVote={handleVote}
          onDelete={handleDelete}
          currentUserId={userId}
        />
      )}
    </div>
  )
}