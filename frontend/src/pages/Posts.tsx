import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getAllPosts, deletePost, votePost, getOnePost } from '@/api/posts.api'
import type { PostResponse } from '@/api/posts.api'
import Header from '@/components/Header'
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

  const handleViewPost = async (id: number) => {
    const post =
      posts.find(p => p.id === id) ??
      Object.values(repliesMap).flat().find(r => r.id === id) ??
      null
    if (!post) return
    if (post.type === 'question') await ensureRepliesFetched(post.id)
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
      if (selectedPost?.id === postId) setSelectedPost(null)
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

  /**
   * Derives the new user_vote after clicking a vote button.
   * Clicking the same vote again toggles it off (null).
   * Clicking a different vote switches to it.
   */
  const deriveUserVote = (current: 1 | -1 | null, clicked: 1 | -1): 1 | -1 | null => {
    return current === clicked ? null : clicked
  }

  /**
   * Calculates the correct vote_count delta for optimistic update.
   * 
   * Cases:
   * null  → +1:  +1  (new upvote)
   * null  → -1:  -1  (new downvote)
   * +1    → +1:  -1  (toggle off upvote)
   * -1    → -1:  +1  (toggle off downvote)
   * +1    → -1:  -2  (switch from up to down)
   * -1    → +1:  +2  (switch from down to up)
   */
  const deriveVoteCountDelta = (current: 1 | -1 | null, clicked: 1 | -1): number => {
    if (current === null) return clicked        // new vote
    if (current === clicked) return -clicked    // toggle off
    return clicked * 2                          // switch direction
  }

  const updatePost = (post: PostResponse, voteValue: 1 | -1, newVoteCount?: number): PostResponse => ({
    ...post,
    user_vote: deriveUserVote(post.user_vote, voteValue),
    vote_count: newVoteCount ?? post.vote_count + deriveVoteCountDelta(post.user_vote, voteValue),
  })

  const applyVoteToMap = (
    prev: Record<number, PostResponse[]>,
    postId: number,
    voteValue: 1 | -1,
    newVoteCount?: number
  ) => {
    const updated = { ...prev }
    for (const questionId in updated) {
      updated[questionId] = updated[questionId].map(reply =>
        reply.id === postId ? updatePost(reply, voteValue, newVoteCount) : reply
      )
    }
    return updated
  }

  const handleVote = async (postId: number, voteValue: 1 | -1) => {
    // Optimistic update
    setPosts(prev => prev.map(post =>
      post.id === postId ? updatePost(post, voteValue) : post
    ))
    setRepliesMap(prev => applyVoteToMap(prev, postId, voteValue))
    if (selectedPost?.id === postId) {
      setSelectedPost(prev => prev ? updatePost(prev, voteValue) : null)
    }

    try {
      const response = await votePost(postId, { vote: voteValue })

      // Reconcile vote_count with server (user_vote already correct from optimistic update)
      setPosts(prev => prev.map(post =>
        post.id === postId ? { ...post, vote_count: response.voteCount } : post
      ))
      setRepliesMap(prev => {
        const updated = { ...prev }
        for (const questionId in updated) {
          updated[questionId] = updated[questionId].map(reply =>
            reply.id === postId ? { ...reply, vote_count: response.voteCount } : reply
          )
        }
        return updated
      })
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? { ...prev, vote_count: response.voteCount } : null)
      }
    } catch {
      // Rollback: apply same vote again to reverse the optimistic update
      setPosts(prev => prev.map(post =>
        post.id === postId ? updatePost(post, voteValue) : post
      ))
      setRepliesMap(prev => applyVoteToMap(prev, postId, voteValue))
      if (selectedPost?.id === postId) {
        setSelectedPost(prev => prev ? updatePost(prev, voteValue) : null)
      }
    }
  }

  const handleAnswerFromDetail = (question: PostResponse) => {
    setSelectedPost(null)
    setAnsweringQuestion(question)
  }

  return (
    <div className="min-h-screen bg-[#FAF3E1]">
      <Header
        rightContent={
          <>
            <button
              onClick={() => setShowAskModal(true)}
              className="px-2 sm:px-4 py-2 bg-[#1B5E8A] text-white rounded-lg
                         hover:scale-105 active:scale-95 transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">Ask a Question</span>
              <span className="sm:hidden">Ask</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-2 sm:px-4 py-2 bg-white text-[#8A244B] rounded-lg
                         hover:scale-105 active:scale-95 transition-all text-xs sm:text-sm whitespace-nowrap"
            >
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">Post</span>
            </button>
          </>
        }
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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

      {showCreateModal && (
        <CreatePostModal
          onClose={() => setShowCreateModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
      {showAskModal && (
        <AskQuestionModal
          onClose={() => setShowAskModal(false)}
          onPostCreated={handlePostCreated}
        />
      )}
      {answeringQuestion && (
        <AnswerQuestionModal
          question={answeringQuestion}
          onClose={() => setAnsweringQuestion(null)}
          onAnswerCreated={handleAnswerCreated}
        />
      )}
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