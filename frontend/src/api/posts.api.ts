import { api } from './api'

export interface PostResponse {
  id: number
  content: string
  author_id: number
  username: string
  vote_count: number
  status: 'approved' | 'disapproved' | 'pending'
  created_at: string
  type: 'post' | 'question' | 'answer'
  parent_id: number | null
  approved_child_id: number | null
  answers?: PostResponse[]
  reply_count: number
  user_vote: 1 | -1 | null 
}

export interface PostDetailResponse {
  post: PostResponse
  answers: PostResponse[] | null
}

export interface PostsCursor {
  before: string
  beforeId: number
}

export interface PostsPageResponse {
  posts: PostResponse[]
  nextCursor: PostsCursor | null
  hasMore: boolean
}

export interface CreatePostRequest {
 content: string
  type: 'post' | 'question' | 'answer'
  parent_id?: number | null
}

export interface VoteRequest {
  vote: 1 | -1
}

export interface VoteResponse {
  voteCount: number
}

export function createPost(data: CreatePostRequest): Promise<PostResponse> {
    return api.post<PostResponse>('/posts', data)
}

export function getPostsPage(cursor?: PostsCursor): Promise<PostsPageResponse> {
  const params = new URLSearchParams({ limit: '10' })
  if (cursor) {
    params.set('before', cursor.before)
    params.set('beforeId', String(cursor.beforeId))
  }
  return api.get<PostsPageResponse>(`/display?${params.toString()}`)
}

export function getOnePost(data: number):Promise<PostDetailResponse> {
    return api.get<PostDetailResponse>(`/displayPost/${data}`)
}

export function deletePost(id: number): Promise<void> {
    return api.delete(`/delete/${id}`)
}

export function votePost(id: number, data: VoteRequest): Promise<VoteResponse> {
  return api.post<VoteResponse>(`/posts/${id}/vote`, data)
}
