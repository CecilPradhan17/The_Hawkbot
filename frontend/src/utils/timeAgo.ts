export function getTimeAgo(dateString: string): string {
  const now = new Date()
  const past = new Date(dateString)
  const diffInSeconds = Math.floor((now.getTime() - past.getTime()) / 1000)

  if (diffInSeconds < 60) {
    return 'just now'
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60)
  if (diffInMinutes < 60) {
    if (diffInMinutes == 1){
        return `${diffInMinutes} min ago`
    }
    else{
        return `${diffInMinutes} mins ago`
    }
  }

  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) {
    if (diffInHours == 1){
        return `${diffInHours} hour ago`
    }
    else{
        return `${diffInHours} hours ago`
    }
  }

  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) {
    if (diffInDays == 1){
        return `${diffInDays} day ago`
    }
    else{
        return `${diffInDays} days ago`
    }
  }

  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) {
    if (diffInWeeks == 1){
        return `${diffInWeeks} week ago`
    }
    else{
        return `${diffInWeeks} weeks ago`
    }
  }

  const diffInMonths = Math.floor(diffInDays / 30)
  if (diffInMonths < 12) {
    if (diffInMonths == 1){
        return `${diffInMonths} month ago`
    }
    else{
        return `${diffInMonths} months ago`
    }
  }

  const diffInYears = Math.floor(diffInDays / 365)
  if (diffInYears == 1){
        return `${diffInYears} year ago`
    }
    else{
        return `${diffInYears} years ago`
    }
}