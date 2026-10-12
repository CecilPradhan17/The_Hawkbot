import { api } from "./api"

export interface ChatRequest {
  message: string
  recentTurns?: ChatTurn[]
  clarification?: ChatClarificationState
}

export type ChatAction = 'answer' | 'clarify' | 'fallback'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
  action?: ChatAction
}

export interface ChatClarificationExchange {
  question: string
  answer?: string
}

export interface ChatClarificationState {
  originalQuery: string
  exchanges: ChatClarificationExchange[]
  count: number
}

export interface ChatResponse {
  response: string
  matched: boolean
  action?: ChatAction
  clarification?: ChatClarificationState | null
  similarity?: number
  knowledgeIds?: number[]
  sources?: ChatSource[]
}

export interface ChatSource {
  type?: 'official' | 'hawkwall'
  title: string
  url: string
  excerpt?: string
  postId?: number
  threadPostId?: number
  approvalCount?: number
  createdAt?: string | null
  lastVerifiedAt?: string | null
}

export function reportOutdatedKnowledge(knowledgeIds: number[]): Promise<{ reported: boolean; queued: boolean }> {
  return api.post('/chat/outdated', { knowledgeIds })
}

export function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', data)
}
