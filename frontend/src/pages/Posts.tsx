import { useEffect, useState } from 'react'
import {
  createPost,
  getAllPosts,
  getOnePost,
  deletePost,
  votePost
} from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'
import { useAuth } from '@/context/AuthContext'

export default function PostsPage() {
  const [content, setContent] = useState('')
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { userId } = useAuth()

  const [selectedPost, setSelectedPost] = useState<PostResponse | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Fetch all posts on mount
  useEffect(() => {
    async function fetchPosts() {
      try {
        const data = await getAllPosts()
        setPosts(data)
      } catch {
        setError('Failed to load posts')
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  // Fetch single post when clicked
  const handlePostClick = async (id: number) => {
    try {
      setModalLoading(true)
      setError(null)

      const data = await getOnePost(id)
      setSelectedPost(data)
    } catch {
      setError('Failed to load post')
    } finally {
      setModalLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deletePost(id)
      // remove from UI state
      setPosts(prev => prev.filter(p => p.id !== id))
      // Close modal if deleted post was open
      if (selectedPost?.id === id) {
        setSelectedPost(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Handle voting with optimistic updates
  const handleVote = async (postId: number, voteValue: 1 | -1) => {
    // Stop event propagation to prevent opening modal
    
    // 1. OPTIMISTIC UPDATE - immediately update UI
    setPosts(prev => prev.map(post => 
      post.id === postId 
        ? { ...post, vote_count: post.vote_count + voteValue }
        : post
    ))

    // Also update modal if it's open
    if (selectedPost?.id === postId) {
      setSelectedPost(prev => 
        prev ? { ...prev, vote_count: prev.vote_count + voteValue } : null
      )
    }

    try {
      // 2. SEND TO BACKEND
      const response = await votePost(postId, { vote: voteValue })
      
      // 3. SYNC WITH BACKEND (in case of mismatch)
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, vote_count: response.voteCount }
          : post
      ))

      // Update modal with actual count
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => 
          prev ? { ...prev, vote_count: response.voteCount } : null
        )
      }
    } catch (error) {
      // 4. ROLLBACK ON FAILURE
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, vote_count: post.vote_count - voteValue }
          : post
      ))

      // Rollback modal
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => 
          prev ? { ...prev, vote_count: prev.vote_count - voteValue } : null
        )
      }

      setError('Failed to vote. Please try again.')
      console.error('Vote failed:', error)
    }
  }

  // Create new post
  const handleCreatePost = async () => {
    if (!content.trim()) return

    try {
      setLoading(true)
      setError(null)

      const newPost = await createPost({ content })

      // Add new post to top of list
      setPosts(prev => [newPost, ...prev])
      setContent('')
    } catch {
      setError('Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  const modalStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  }

  const modalContentStyle: React.CSSProperties = {
    background: 'white',
    padding: '2rem',
    borderRadius: '8px',
    minWidth: '300px',
  }

  if (loading) return <p style={{ padding: '2rem' }}>Loading posts...</p>

  return (
    <>
      <div style={{ padding: '2rem' }}>
        <h1>Posts</h1>

        {/* Create Post Section */}
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write something..."
            rows={4}
            style={{ width: '100%', marginBottom: '0.5rem' }}
          />

          <button onClick={handleCreatePost}>
            Create Post
          </button>

          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>

        {/* Posts List */}
        <div>
          {posts.map(post => (
            <div
              key={post.id}
              onClick={() => handlePostClick(post.id)}
              style={{
                border: '1px solid #ccc',
                padding: '1rem',
                marginBottom: '1rem',
                cursor: 'pointer',
              }}
            >
              {post.author_id === userId && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation() // Prevent modal from opening
                    handleDelete(post.id)
                  }}
                >
                  Delete
                </button>
              )}
              <p>{post.content}</p>
              
              {/* Voting buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={(e) => {
                    e.stopPropagation() // Prevent modal from opening
                    handleVote(post.id, 1)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  ⬆️ Upvote
                </button>
                
                <small>Votes: {post.vote_count}</small>
                
                <button 
                  onClick={(e) => {
                    e.stopPropagation() // Prevent modal from opening
                    handleVote(post.id, -1)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  ⬇️ Downvote
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedPost && (
        <div
          style={modalStyle}
          onClick={() => setSelectedPost(null)}
        >
          <div
            style={modalContentStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                <h2>Post Details</h2>
                <p>{selectedPost.content}</p>
                
                {/* Voting buttons in modal */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                  <button 
                    onClick={() => handleVote(selectedPost.id, 1)}
                  >
                    ⬆️ Upvote
                  </button>
                  
                  <small>Votes: {selectedPost.vote_count}</small>
                  
                  <button 
                    onClick={() => handleVote(selectedPost.id, -1)}
                  >
                    ⬇️ Downvote
                  </button>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <button onClick={() => setSelectedPost(null)}>
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}