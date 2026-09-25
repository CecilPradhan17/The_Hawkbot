import { useContext } from 'react'
import { HawkwallFeedContext } from '@/context/hawkwallFeedState'

export function useHawkwallFeed() {
  const context = useContext(HawkwallFeedContext)
  if (!context) throw new Error('useHawkwallFeed must be used within HawkwallFeedProvider')
  return context
}
