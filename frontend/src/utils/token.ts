export const getToken = (): string | null => {
  try {
    return localStorage.getItem("token")
  } catch {
    return null
  }
}