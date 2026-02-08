import request from "./request"

export const api = {
  get: <T>(endpoint: string) => 
    request<T>(endpoint, 'GET'),
  post: <T>(endpoint: string, body: unknown) =>
    request<T>(endpoint, 'POST', body),
  delete: <T>(endpoint: string) =>
    request<T>(endpoint, 'DELETE'),
}
