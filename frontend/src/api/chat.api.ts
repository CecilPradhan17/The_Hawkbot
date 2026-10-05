import { api } from "./api"

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  response: string
  matched: boolean
  similarity?: number
  knowledgeIds?: number[]
  sources?: ChatSource[]
}

export interface ChatSource {
  title: string
  url: string
  lastVerifiedAt?: string | null
}

export function reportOutdatedKnowledge(knowledgeIds: number[]): Promise<{ reported: boolean; queued: boolean }> {
  return api.post('/chat/outdated', { knowledgeIds })
}

export function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', data)
}
