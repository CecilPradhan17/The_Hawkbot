import { useState } from 'react'
import type { ReactNode } from 'react'
import type { PostResponse, PostsCursor } from '@/api/posts.api'
import { HawkwallFeedContext } from '@/context/hawkwallFeedState'

export function HawkwallFeedProvider({ children }: { children: ReactNode }) {
  const [posts, setPosts] = useState<PostResponse[]>([])
  const [nextCursor, setNextCursor] = useState<PostsCursor | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [repliesMap, setRepliesMap] = useState<Record<number, PostResponse[]>>({})
  const [repliesOpenMap, setRepliesOpenMap] = useState<Record<number, boolean>>({})
  const [lastFetchedAt, setLastFetchedAt] = useState(0)
  const [scrollPosition, setScrollPosition] = useState(0)

  return (
    <HawkwallFeedContext.Provider value={{
      posts,
      setPosts,
      nextCursor,
      setNextCursor,
      hasMore,
      setHasMore,
      repliesMap,
      setRepliesMap,
      repliesOpenMap,
      setRepliesOpenMap,
      lastFetchedAt,
      setLastFetchedAt,
      scrollPosition,
      setScrollPosition,
    }}>
      {children}
    </HawkwallFeedContext.Provider>
  )
}
