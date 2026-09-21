const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const friendlyDetail = (detail: string) => detail
  .replace('must use 24-hour HH:mm times', 'needs both a valid opening time and closing time')
  .replace('closes before it opens; mark it as closing next day if intentional', 'closes before it opens; select “next day” if it closes after midnight')

export function friendlyHoursValidationMessage(error: string) {
  const regular = /^weekly\[(\d+)](?:\.intervals\[(\d+)])? (.+)$/.exec(error)
  if (regular) {
    const day = DAYS[Number(regular[1])] || `Weekday ${Number(regular[1]) + 1}`
    const interval = regular[2] === undefined ? '' : `, interval ${Number(regular[2]) + 1}`
    return `${day}${interval}: ${friendlyDetail(regular[3])}`
  }

  const special = /^specialPeriods\[(\d+)]\.days\[(\d+)](?:\.intervals\[(\d+)])? (.+)$/.exec(error)
  if (special) {
    const day = DAYS[Number(special[2])] || `Weekday ${Number(special[2]) + 1}`
    const interval = special[3] === undefined ? '' : `, interval ${Number(special[3]) + 1}`
    return `Special period ${Number(special[1]) + 1}, ${day}${interval}: ${friendlyDetail(special[4])}`
  }

  return error
    .replace('sourceLabel', 'Source label')
    .replace('coverageStart', 'Coverage start')
    .replace('coverageEnd', 'Coverage end')
}
