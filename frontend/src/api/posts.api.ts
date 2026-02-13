/**
 * Purpose:
 * - Defines post-related API contracts and request helpers
 * - Serves as the single source of truth for post data structures
 *
 * Responsibilities:
 * - Declares TypeScript interfaces matching backend post responses
 * - Exposes strongly-typed functions for post creation and retrieval
 * - Encapsulates post-related endpoint paths
 *
 * Used by:
 * - Feed page
 * - Create Post form
 * - Admin moderation pages (future)
 *
 * Types (Backend Contracts):
 * - PostResponse
 *   - Represents a single post returned from the backend
 *   - Includes content, author info, vote count, status, and timestamp
 *
 * - CreatePostRequest
 *   - Payload required to create a new post
 *
 * API Functions:
 * - createPost(data)
 *   - Sends post content to the backend
 *   - Returns the created post object
 *
 * - getAllPosts()
 *   - Fetches all posts from the backend
 *   - Returns an array of PostResponse objects
 *
 * Extra notes:
 * - Status field supports moderation workflow:
 *     - 'approved'
 *     - 'disapproved'
 *     - 'pending'
 * - Components should use these types instead of redefining shapes
 *
 * Additional info for Future Modification / Integration:
 * - Ideal place to add:
 *     - votePost(id)
 *     - deletePost(id)
 *     - getPostById(id)
 *     - getPostsByUser(userId)
 * - If backend response structure changes, only this file requires updates
 */

import { api } from './api'

export interface PostResponse {
  id: number
  content: string
  author_id: number
  username: string
  vote_count: number
  status: 'approved' | 'disapproved' | 'pending'
  created_at: string
}

export interface CreatePostRequest {
  content: string
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