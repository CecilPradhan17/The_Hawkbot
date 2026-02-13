import { useEffect, useState } from 'react'
import {
  createPost,
  getAllPosts,
  getOnePost,
  deletePost
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
    } catch (err) {
      console.error(err)
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
              <button onClick={() => handleDelete(post.id)}>
              Delete
              </button>
              )}
              <p>{post.content}</p>
              <small>Votes: {post.vote_count}</small>
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
                <small>Votes: {selectedPost.vote_count}</small>

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
