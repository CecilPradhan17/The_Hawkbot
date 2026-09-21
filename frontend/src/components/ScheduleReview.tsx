import { useMemo, useState } from 'react'
import {
  previewSchedule,
  publishSchedule,
  validateSchedule,
  type Facility,
  type HoursSchedule,
} from '@/api/hours.api'
import { friendlyHoursValidationMessage } from '@/utils/hoursValidationMessage'

interface ScheduleReviewProps {
  schedule: HoursSchedule
  facility: Facility
  onPublished: () => Promise<void>
  onMessage: (message: string) => void
}

export default function ScheduleReview({ schedule, facility, onPublished, onMessage }: ScheduleReviewProps) {
  const [date, setDate] = useState('')
  const [preview, setPreview] = useState('')
  const [previewError, setPreviewError] = useState('')
  const [previewFingerprint, setPreviewFingerprint] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [validatedFingerprint, setValidatedFingerprint] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const fingerprint = useMemo(() => JSON.stringify(schedule), [schedule])
  const validationIsCurrent = validatedFingerprint === fingerprint
  const isValid = validationIsCurrent && validationErrors.length === 0
  const previewIsCurrent = previewFingerprint === fingerprint

  const testDate = async () => {
    if (!date) {
      setPreviewError('Choose a date to test first.')
      return
    }
    setPreviewError('')
    setPreview('')
    try {
      const result = await previewSchedule(schedule, facility.name, date)
      setPreview(result.response)
      setPreviewFingerprint(fingerprint)
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not test this date')
    }
  }

  const validate = async () => {
    setChecking(true)
    try {
      const result = await validateSchedule(schedule)
      setValidationErrors(result.errors)
      setValidatedFingerprint(fingerprint)
    } catch (error) {
      setValidationErrors([error instanceof Error ? error.message : 'Validation failed'])
      setValidatedFingerprint(fingerprint)
    } finally {
      setChecking(false)
    }
  }

  const publish = async () => {
    if (!isValid) return
    if (facility.schedule && !window.confirm(`Replace the current ${facility.name} schedule? This cannot be undone.`)) return
    setPublishing(true)
    try {
      await publishSchedule(schedule)
      await onPublished()
      onMessage('Schedule published successfully.')
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Publication failed')
    } finally {
      setPublishing(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-[#8A244B]/30 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[#8A244B]">Final step</p>
        <h2 className="text-xl font-bold text-slate-800">Review and publish</h2>
        <p className="mt-1 text-sm text-slate-500">Test important dates, validate the complete schedule, then publish it.</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-800">1. Test a date</h3>
          <p className="mt-1 text-sm text-slate-500">See the exact answer students will receive on a holiday, finals day, or regular day.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input aria-label="Date to test" type="date" value={date} onChange={event => setDate(event.target.value)} className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2" />
            <button onClick={testDate} className="min-h-11 rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white shadow-sm transition hover:bg-slate-700 active:scale-[0.98]">Test date</button>
          </div>
          {previewError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{previewError}</p>}
          {preview && previewIsCurrent && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Hawkbot will answer</p><p className="mt-1 text-sm text-slate-800">{preview}</p></div>}
          {preview && !previewIsCurrent && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">The schedule changed. Test the date again for an updated answer.</p>}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="font-bold text-slate-800">2. Validate and publish</h3>
          <p className="mt-1 text-sm text-slate-500">Validation checks dates, all seven weekdays, intervals, overlaps, and required fields. It does not save anything.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <button disabled={checking || publishing} onClick={validate} className="min-h-11 rounded-lg border-2 border-[#8A244B] bg-white px-4 py-2 font-bold text-[#8A244B] shadow-sm transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50">{checking ? 'Checking…' : validationIsCurrent ? 'Validate again' : 'Validate schedule'}</button>
            <button disabled={!isValid || publishing} onClick={publish} className="min-h-11 flex-1 rounded-lg bg-[#8A244B] px-5 py-2 font-bold text-white shadow-sm transition hover:bg-[#711d3e] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">{publishing ? 'Publishing…' : facility.schedule ? 'Replace published schedule' : 'Publish schedule'}</button>
          </div>

          {validatedFingerprint === null && <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-medium text-blue-800">Run validation to unlock publishing.</p>}
          {validatedFingerprint !== null && !validationIsCurrent && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">The schedule changed after validation. Validate it again before publishing.</p>}
          {validationIsCurrent && isValid && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">✓ Schedule is valid. Publishing is unlocked.</p>}
          {validationIsCurrent && validationErrors.length > 0 && <div role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-bold">Fix these issues:</p><ul className="mt-1 list-disc pl-5">{validationErrors.map((error, index) => <li key={index}>{friendlyHoursValidationMessage(error)}</li>)}</ul></div>}
        </div>
      </div>

      {schedule.warnings?.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-bold">Extraction warnings to review:</p><ul className="mt-1 list-disc pl-5">{schedule.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></div> : null}
    </section>
  )
}
