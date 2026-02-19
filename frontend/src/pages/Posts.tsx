import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAllPosts, deletePost, votePost, getOnePost } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'
import CreatePostModal from '@/components/posts/CreatePostModal'
import AskQuestionModal from '@/components/posts/AskQuestionModal'
import AnswerQuestionModal from '@/components/posts/AnswerQuestionModal'
import PostList from '@/components/posts/PostList'
import PostDetailModal from '@/components/posts/PostDetailModal'

export default function Posts() {
  const { userId } = useAuth()
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [selectedPost, setSelectedPost] = useState<PostResponse | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAskModal, setShowAskModal] = useState(false)
  const [answeringQuestion, setAnsweringQuestion] = useState<PostResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Lifted replies state: keyed by question post ID
  const [repliesMap, setRepliesMap] = useState<Record<number, PostResponse[]>>({})
  const [repliesOpenMap, setRepliesOpenMap] = useState<Record<number, boolean>>({})

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

  const handleToggleReplies = async (questionId: number) => {
    const isOpen = repliesOpenMap[questionId] ?? false

    if (isOpen) {
      setRepliesOpenMap(prev => ({ ...prev, [questionId]: false }))
      return
    }

    if (repliesMap[questionId]) {
      setRepliesOpenMap(prev => ({ ...prev, [questionId]: true }))
      return
    }

    try {
      const data = await getOnePost(questionId)
      setRepliesMap(prev => ({ ...prev, [questionId]: data.answers ?? [] }))
      setRepliesOpenMap(prev => ({ ...prev, [questionId]: true }))
    } catch (err) {
      console.error('Failed to load replies:', err)
    }
  }

  const ensureRepliesFetched = async (questionId: number) => {
    if (repliesMap[questionId]) return
    try {
      const data = await getOnePost(questionId)
      setRepliesMap(prev => ({ ...prev, [questionId]: data.answers ?? [] }))
    } catch (err) {
      console.error('Failed to preload replies:', err)
    }
  }

  // Handle "View post" — works for posts, questions, and answers
  // Answers may only be in repliesMap, not in the main posts array
  const handleViewPost = async (id: number) => {
    const post =
      posts.find(p => p.id === id) ??
      Object.values(repliesMap).flat().find(r => r.id === id) ??
      null

    if (!post) return

    if (post.type === 'question') {
      await ensureRepliesFetched(post.id)
    }

    setSelectedPost(post)
  }

  const handlePostCreated = (newPost: PostResponse) => {
    setPosts(prev => [newPost, ...prev])
  }

  const handleAnswerCreated = (answer: PostResponse) => {
    const questionId = answer.parent_id!

    setRepliesMap(prev => ({
      ...prev,
      [questionId]: [...(prev[questionId] ?? []), answer],
    }))

    setRepliesOpenMap(prev => ({ ...prev, [questionId]: true }))

    setPosts(prev => prev.map(post =>
      post.id === questionId
        ? { ...post, reply_count: post.reply_count + 1 }
        : post
    ))
  }

  const handleDelete = async (postId: number) => {
    try {
      const postToDelete =
        posts.find(p => p.id === postId) ??
        Object.values(repliesMap).flat().find(r => r.id === postId)

      await deletePost(postId)

      setPosts(prev => prev.filter(p => p.id !== postId))

      if (selectedPost?.id === postId) {
        setSelectedPost(null)
      }

      if (postToDelete?.type === 'answer' && postToDelete.parent_id) {
        const questionId = postToDelete.parent_id

        setRepliesMap(prev => ({
          ...prev,
          [questionId]: (prev[questionId] ?? []).filter(r => r.id !== postId),
        }))

        setPosts(prev => prev.map(post =>
          post.id === questionId
            ? { ...post, reply_count: Math.max(0, post.reply_count - 1) }
            : post
        ))
      }
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleVote = async (postId: number, voteValue: 1 | -1) => {
    setPosts(prev => prev.map(post =>
      post.id === postId
        ? { ...post, vote_count: post.vote_count + voteValue }
        : post
    ))

    setRepliesMap(prev => {
      const updated = { ...prev }
      for (const questionId in updated) {
        updated[questionId] = updated[questionId].map(reply =>
          reply.id === postId
            ? { ...reply, vote_count: reply.vote_count + voteValue }
            : reply
        )
      }
      return updated
    })

    if (selectedPost?.id === postId) {
      setSelectedPost(prev =>
        prev ? { ...prev, vote_count: prev.vote_count + voteValue } : null
      )
    }

    try {
      const response = await votePost(postId, { vote: voteValue })

      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, vote_count: response.voteCount }
          : post
      ))

      setRepliesMap(prev => {
        const updated = { ...prev }
        for (const questionId in updated) {
          updated[questionId] = updated[questionId].map(reply =>
            reply.id === postId
              ? { ...reply, vote_count: response.voteCount }
              : reply
          )
        }
        return updated
      })

      if (selectedPost?.id === postId) {
        setSelectedPost(prev =>
          prev ? { ...prev, vote_count: response.voteCount } : null
        )
      }
    } catch {
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, vote_count: post.vote_count - voteValue }
          : post
      ))

      setRepliesMap(prev => {
        const updated = { ...prev }
        for (const questionId in updated) {
          updated[questionId] = updated[questionId].map(reply =>
            reply.id === postId
              ? { ...reply, vote_count: reply.vote_count - voteValue }
              : reply
          )
        }
        return updated
      })

      if (selectedPost?.id === postId) {
        setSelectedPost(prev =>
          prev ? { ...prev, vote_count: prev.vote_count - voteValue } : null
        )
      }
    }
  }

  const handleAnswerFromDetail = (question: PostResponse) => {
    setSelectedPost(null)
    setAnsweringQuestion(question)
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

          <div className="flex gap-3">
            <button
              onClick={() => setShowAskModal(true)}
              className="px-4 py-2 bg-[#1B5E8A] text-white rounded-lg hover:scale-105 transition-all"
            >
              Ask a Question
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-white text-[#8A244B] rounded-lg hover:scale-105 transition-all"
            >
              Create Post
            </button>
          </div>
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
            repliesMap={repliesMap}
            repliesOpenMap={repliesOpenMap}
            onViewPost={handleViewPost}
            onVote={handleVote}
            onAnswerQuestion={setAnsweringQuestion}
            onToggleReplies={handleToggleReplies}
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

      {/* Ask Question Modal */}
      {showAskModal && (
        <AskQuestionModal
          onClose={() => setShowAskModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}

      {/* Answer Question Modal */}
      {answeringQuestion && (
        <AnswerQuestionModal
          question={answeringQuestion}
          onClose={() => setAnsweringQuestion(null)}
          onAnswerCreated={handleAnswerCreated}
        />
      )}

      {/* Post Detail Modal */}
      {selectedPost && (
        <PostDetailModal
          post={selectedPost}
          replies={repliesMap[selectedPost.id] ?? []}
          onClose={() => setSelectedPost(null)}
          onVote={handleVote}
          onDelete={handleDelete}
          onAnswerQuestion={handleAnswerFromDetail}
          onViewPost={handleViewPost}
          currentUserId={userId}
        />
      )}
    </div>
  )
}