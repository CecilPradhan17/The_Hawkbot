import { useEffect, useState } from 'react'
import { createPost } from '@/api/posts.api'
import { getAllPosts } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'

export default function PostsPage() {
  const [content, setContent] = useState('')
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPosts() {
        try{
            const data = await getAllPosts()
            setPosts(data)
        }catch(error){
            setError("Failled to load posts")
        }finally {
            setLoading(false)
        }
    }
    fetchPosts()
  }, [])

  const handleCreatePost = async () => {
    if (!content.trim()) return

    try {
      setLoading(true)
      setError(null)

      const newPost = await createPost({ content })

      // Add new post to top of list
      setPosts(prev => [newPost, ...prev])

      setContent('')
    } catch (err) {
      setError('Failed to create post')
    } finally {
      setLoading(false)
    }
  }

  

  return (
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

        <button onClick={handleCreatePost} disabled={loading}>
          {loading ? 'Posting...' : 'Create Post'}
        </button>

        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>

      {/* Posts List */}
      <div>
        {posts.map(post => (
          <div
            key={post.id}
            style={{
              border: '1px solid #ccc',
              padding: '1rem',
              marginBottom: '1rem',
            }}
          >
            <p>{post.content}</p>
            <small>
            Votes: {post.vote_count}
            </small>
          </div>
        ))}
      </div>
    </div>
  )
}
