import { api } from './api'
import { getToken } from '@/utils/token'

export type HoursStatus = 'open' | 'closed' | 'unverified'
export interface HoursInterval { opensAt: string; closesAt: string; closesNextDay: boolean }
export interface DayRule { weekday: number; status: HoursStatus; intervals: HoursInterval[] }
export interface SpecialPeriod { name: string; startDate: string; endDate: string; days: DayRule[] }
export interface DateException { date: string; name: string; status: HoursStatus; intervals: HoursInterval[] }
export interface HoursSchedule {
  facilityId: number
  sourceLabel: string
  coverageStart: string
  coverageEnd: string
  weekly: DayRule[]
  specialPeriods: SpecialPeriod[]
  exceptions: DateException[]
  warnings?: string[]
}
export interface Facility {
  id: number
  name: string
  aliases: string[]
  schedule: null | { coverageStart: string; coverageEnd: string; sourceLabel: string; publishedAt: string }
}
export interface ValidationResult { valid: boolean; errors: string[]; warnings: string[] }

export const checkHoursAccess = () => api.get<{ authorized: boolean }>('/hours/access')
export const getFacilities = () => api.get<Facility[]>('/hours/facilities')
export const createFacility = (data: { name: string; aliases: string[] }) => api.post<Facility>('/hours/facilities', data)
export const updateFacility = (facilityId: number, data: { name: string; aliases: string[] }) =>
  api.patch<Facility>(`/hours/facilities/${facilityId}`, data)
export const deleteFacility = (facilityId: number) => api.delete<void>(`/hours/facilities/${facilityId}`)
export const getCurrentSchedule = (facilityId: number) => api.get<HoursSchedule>(`/hours/facilities/${facilityId}/schedule`)
export const validateSchedule = (schedule: HoursSchedule) => api.post<ValidationResult>('/hours/validate', schedule)
export const previewSchedule = (schedule: HoursSchedule, facilityName: string, date: string) =>
  api.post<{ response: string }>('/hours/preview', { schedule, facilityName, date })
export const publishSchedule = (schedule: HoursSchedule) =>
  api.post<{ scheduleId: number; publishedAt: string }>('/hours/publish', schedule)

export async function extractSchedule(document: File): Promise<Omit<HoursSchedule, 'facilityId'>> {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4005/api'
  const form = new FormData()
  form.append('document', document)
  const token = getToken()
  const response = await fetch(`${baseUrl}/hours/extract`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new Error(body?.message || 'Schedule extraction failed')
  return body
}
