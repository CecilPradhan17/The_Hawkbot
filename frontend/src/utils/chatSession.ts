export const DAILY_CHAT_LIMIT = 7
export const MAX_CHAT_MESSAGE_LENGTH = 250

const withName = (name: string | null) => name ? `, ${name}` : ''

const GREETINGS = [
  (name: string | null) => `What's on your mind${withName(name)}?`,
  (name: string | null) => `How can I help${withName(name)}?`,
  (name: string | null) => `What are we figuring out today${withName(name)}?`,
  (name: string | null) => `Where should we start${withName(name)}?`,
  (name: string | null) => `What can I help you find${withName(name)}?`,
]

export function getRandomChatGreeting(name: string | null) {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)](name)
}

function getTodayKey() {
  return `hawkbot_usage_${new Date().toISOString().split('T')[0]}`
}

export function getStoredChatUsage(): number {
  const stored = localStorage.getItem(getTodayKey())
  return stored ? parseInt(stored, 10) : 0
}

export function saveChatUsage(count: number) {
  localStorage.setItem(getTodayKey(), String(count))
}
