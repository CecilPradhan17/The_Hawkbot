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

export function getAllPosts():Promise<PostResponse[]> {
    return api.get<PostResponse[]>('/display')
}

export function getOnePost(data: number):Promise<PostResponse> {
    return api.get<PostResponse>(`/displayPost/${data}`)
}

export function deletePost(id: number): Promise<void> {
    return api.delete(`/delete/${id}`)
}

export function votePost(id: number, data: VoteRequest): Promise<VoteResponse> {
  return api.post<VoteResponse>(`/posts/${id}/vote`, data)
}