import { createContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { PostResponse, PostsCursor } from '@/api/posts.api'

export interface HawkwallFeedContextValue {
  posts: PostResponse[]
  setPosts: Dispatch<SetStateAction<PostResponse[]>>
  nextCursor: PostsCursor | null
  setNextCursor: Dispatch<SetStateAction<PostsCursor | null>>
  hasMore: boolean
  setHasMore: Dispatch<SetStateAction<boolean>>
  repliesMap: Record<number, PostResponse[]>
  setRepliesMap: Dispatch<SetStateAction<Record<number, PostResponse[]>>>
  repliesOpenMap: Record<number, boolean>
  setRepliesOpenMap: Dispatch<SetStateAction<Record<number, boolean>>>
  lastFetchedAt: number
  setLastFetchedAt: Dispatch<SetStateAction<number>>
  scrollPosition: number
  setScrollPosition: Dispatch<SetStateAction<number>>
}

export const HawkwallFeedContext = createContext<HawkwallFeedContextValue | null>(null)
