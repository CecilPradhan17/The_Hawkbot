import { api } from "./api"

export interface ChatRequest {
  message: string
}

export interface ChatResponse {
  response: string
  matched: boolean
  similarity?: number
}

export function sendChatMessage(data: ChatRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', data)
}