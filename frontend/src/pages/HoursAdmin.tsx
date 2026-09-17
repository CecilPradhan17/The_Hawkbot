import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import {
  checkHoursAccess, createFacility, extractSchedule, getCurrentSchedule, getFacilities,
  previewSchedule, publishSchedule, validateSchedule,
  type DateException, type DayRule, type Facility, type HoursInterval,
  type HoursSchedule, type HoursStatus,
} from '@/api/hours.api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const emptyWeek = (): DayRule[] => DAYS.map((_, index) => ({ weekday: index + 1, status: 'unverified', intervals: [] }))
const emptyInterval = (): HoursInterval => ({ opensAt: '08:00', closesAt: '17:00', closesNextDay: false })

function DayEditor({ day, onChange, label }: { day: DayRule; onChange: (day: DayRule) => void; label?: string }) {
  const setStatus = (status: HoursStatus) => onChange({
    ...day,
    status,
    intervals: status === 'open' ? (day.intervals.length ? day.intervals : [emptyInterval()]) : [],
  })
  const updateInterval = (index: number, patch: Partial<HoursInterval>) => onChange({
    ...day,
    intervals: day.intervals.map((interval, i) => i === index ? { ...interval, ...patch } : interval),
  })

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="w-24 font-semibold text-slate-700">{label ?? DAYS[day.weekday - 1]}</span>
        <select value={day.status} onChange={event => setStatus(event.target.value as HoursStatus)} className="rounded-lg border px-2 py-1.5">
          <option value="open">Open</option><option value="closed">Closed</option><option value="unverified">Unverified</option>
        </select>
      </div>
      {day.status === 'open' && (
        <div className="mt-3 space-y-2">
          {day.intervals.map((interval, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
              <input type="time" value={interval.opensAt} onChange={e => updateInterval(index, { opensAt: e.target.value })} className="rounded-lg border px-2 py-1.5" />
              <span>to</span>
              <input type="time" value={interval.closesAt} onChange={e => updateInterval(index, { closesAt: e.target.value })} className="rounded-lg border px-2 py-1.5" />
              <label className="flex items-center gap-1"><input type="checkbox" checked={interval.closesNextDay} onChange={e => updateInterval(index, { closesNextDay: e.target.checked })} /> next day</label>
              <button onClick={() => onChange({ ...day, intervals: day.intervals.filter((_, i) => i !== index) })} className="text-red-600">Remove</button>
            </div>
          ))}
          <button onClick={() => onChange({ ...day, intervals: [...day.intervals, emptyInterval()] })} className="text-sm font-semibold text-[#8A244B]">+ Add interval</button>
        </div>
      )}
    </div>
  )
}

function WeekEditor({ days, onChange }: { days: DayRule[]; onChange: (days: DayRule[]) => void }) {
  return <div className="space-y-2">{[...days].sort((a, b) => a.weekday - b.weekday).map(day => (
    <DayEditor key={day.weekday} day={day} onChange={next => onChange(days.map(item => item.weekday === next.weekday ? next : item))} />
  ))}</div>
}

export default function HoursAdmin() {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [facilities, setFacilities] = useState<Facility[]>([])
  const [facilityId, setFacilityId] = useState<number | null>(null)
  const [schedule, setSchedule] = useState<HoursSchedule | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [documentType, setDocumentType] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewDate, setPreviewDate] = useState('')
  const [preview, setPreview] = useState('')
  const [newName, setNewName] = useState('')
  const [newAliases, setNewAliases] = useState('')
  const selectedFacility = useMemo(() => facilities.find(item => item.id === facilityId), [facilities, facilityId])

  const refreshFacilities = async () => {
    const data = await getFacilities()
    setFacilities(data)
    if (!facilityId && data[0]) setFacilityId(data[0].id)
  }

  useEffect(() => {
    checkHoursAccess()
      .then(async () => {
        setAuthorized(true)
        const data = await getFacilities()
        setFacilities(data)
        if (data[0]) setFacilityId(data[0].id)
      })
      .catch(() => setAuthorized(false))
  }, [])

  useEffect(() => () => { if (documentUrl) URL.revokeObjectURL(documentUrl) }, [documentUrl])

  const handleUpload = async (file?: File) => {
    if (!file || !facilityId) return
    setBusy(true); setErrors([]); setMessage('Extracting schedule…')
    if (documentUrl) URL.revokeObjectURL(documentUrl)
    setDocumentUrl(URL.createObjectURL(file)); setDocumentType(file.type)
    try {
      const extracted = await extractSchedule(file)
      setSchedule({ ...extracted, facilityId })
      setMessage('Extraction complete. Review every field before publishing.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Extraction failed') }
    finally { setBusy(false) }
  }

  const handleValidate = async () => {
    if (!schedule) return
    const result = await validateSchedule(schedule)
    setErrors(result.errors); setMessage(result.valid ? 'Schedule is valid and ready to publish.' : 'Fix the listed validation errors.')
  }

  const handlePublish = async () => {
    if (!schedule || !selectedFacility) return
    const validation = await validateSchedule(schedule)
    setErrors(validation.errors)
    if (!validation.valid) return setMessage('Fix validation errors before publishing.')
    if (selectedFacility.schedule && !window.confirm(`Replace the current ${selectedFacility.name} schedule? This cannot be undone.`)) return
    setBusy(true)
    try {
      await publishSchedule(schedule)
      await refreshFacilities()
      setMessage('Schedule published successfully.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Publication failed') }
    finally { setBusy(false) }
  }

  const addSpecialPeriod = () => setSchedule(current => current ? ({ ...current, specialPeriods: [...current.specialPeriods, { name: '', startDate: '', endDate: '', days: emptyWeek() }] }) : current)
  const addException = () => setSchedule(current => current ? ({ ...current, exceptions: [...current.exceptions, { date: '', name: '', status: 'closed', intervals: [] }] }) : current)

  if (authorized === null) return <div className="min-h-screen bg-[#FAF3E1]"><Header /><p className="p-8 text-center">Checking access…</p></div>
  if (!authorized) return <div className="min-h-screen bg-[#FAF3E1]"><Header /><p className="p-8 text-center text-red-700">You are not authorized to manage hours.</p></div>

  return (
    <div className="min-h-screen bg-[#FAF3E1]"><Header />
      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        <h1 className="text-3xl font-bold text-slate-800">Campus Hours Manager</h1>
        <p className="mt-1 text-slate-500">Upload, review, preview, and publish one current schedule per facility.</p>

        <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="font-bold">Create facility</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Facility name" className="rounded-lg border px-3 py-2" />
            <input value={newAliases} onChange={e => setNewAliases(e.target.value)} placeholder="Aliases, comma separated" className="min-w-72 rounded-lg border px-3 py-2" />
            <button className="rounded-lg bg-[#8A244B] px-4 py-2 text-white" onClick={async () => {
              try { await createFacility({ name: newName, aliases: newAliases.split(',').map(x => x.trim()).filter(Boolean) }); setNewName(''); setNewAliases(''); await refreshFacilities() }
              catch (error) { setMessage(error instanceof Error ? error.message : 'Could not create facility') }
            }}>Create</button>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
          <label className="font-bold">Facility</label>
          <select value={facilityId ?? ''} onChange={e => { setFacilityId(Number(e.target.value)); setSchedule(null) }} className="ml-3 rounded-lg border px-3 py-2">
            {facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
          </select>
          {selectedFacility?.schedule && <button className="ml-3 text-sm font-semibold text-[#8A244B]" onClick={async () => setSchedule(await getCurrentSchedule(selectedFacility.id))}>Load current schedule</button>}
          <div className="mt-4"><input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={!facilityId || busy} onChange={e => handleUpload(e.target.files?.[0])} /></div>
        </section>

        {message && <p className="mt-4 rounded-xl bg-white p-3 text-sm text-slate-700">{message}</p>}
        {schedule && <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="min-h-96 rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-3 text-xl font-bold">Original document</h2>
            {!documentUrl ? <p className="text-slate-500">The currently published schedule has no stored document.</p>
              : documentType === 'application/pdf' ? <iframe src={documentUrl} title="Uploaded schedule" className="h-[70vh] w-full rounded-xl border" />
              : <img src={documentUrl} alt="Uploaded schedule" className="max-h-[70vh] w-full rounded-xl object-contain" />}
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <h2 className="text-xl font-bold">Schedule details</h2>
              <label className="mt-3 block text-sm">Source label<input value={schedule.sourceLabel} onChange={e => setSchedule({ ...schedule, sourceLabel: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-sm">Coverage start<input type="date" value={schedule.coverageStart} onChange={e => setSchedule({ ...schedule, coverageStart: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
                <label className="text-sm">Coverage end<input type="date" value={schedule.coverageEnd} onChange={e => setSchedule({ ...schedule, coverageEnd: e.target.value })} className="mt-1 w-full rounded-lg border px-3 py-2" /></label>
              </div>
            </div>

            <div><h2 className="mb-2 text-xl font-bold">Regular weekly hours</h2><WeekEditor days={schedule.weekly} onChange={weekly => setSchedule({ ...schedule, weekly })} /></div>

            <div><div className="mb-2 flex justify-between"><h2 className="text-xl font-bold">Special periods</h2><button onClick={addSpecialPeriod} className="font-semibold text-[#8A244B]">+ Add</button></div>
              {schedule.specialPeriods.map((period, index) => <div key={index} className="mb-4 rounded-2xl border border-[#8A244B]/20 p-3">
                <div className="grid grid-cols-3 gap-2"><input placeholder="Name" value={period.name} onChange={e => setSchedule({ ...schedule, specialPeriods: schedule.specialPeriods.map((p, i) => i === index ? { ...p, name: e.target.value } : p) })} className="rounded-lg border px-2" /><input type="date" value={period.startDate} onChange={e => setSchedule({ ...schedule, specialPeriods: schedule.specialPeriods.map((p, i) => i === index ? { ...p, startDate: e.target.value } : p) })} className="rounded-lg border px-2" /><input type="date" value={period.endDate} onChange={e => setSchedule({ ...schedule, specialPeriods: schedule.specialPeriods.map((p, i) => i === index ? { ...p, endDate: e.target.value } : p) })} className="rounded-lg border px-2" /></div>
                <button onClick={() => setSchedule({ ...schedule, specialPeriods: schedule.specialPeriods.filter((_, i) => i !== index) })} className="my-2 text-sm text-red-600">Remove period</button>
                <WeekEditor days={period.days} onChange={days => setSchedule({ ...schedule, specialPeriods: schedule.specialPeriods.map((p, i) => i === index ? { ...p, days } : p) })} />
              </div>)}</div>

            <div><div className="mb-2 flex justify-between"><h2 className="text-xl font-bold">Date exceptions</h2><button onClick={addException} className="font-semibold text-[#8A244B]">+ Add</button></div>
              {schedule.exceptions.map((exception: DateException, index) => <div key={index} className="mb-2 rounded-xl border bg-white p-3">
                <div className="flex flex-wrap gap-2"><input type="date" value={exception.date} onChange={e => setSchedule({ ...schedule, exceptions: schedule.exceptions.map((x, i) => i === index ? { ...x, date: e.target.value } : x) })} className="rounded-lg border px-2" /><input placeholder="Name" value={exception.name} onChange={e => setSchedule({ ...schedule, exceptions: schedule.exceptions.map((x, i) => i === index ? { ...x, name: e.target.value } : x) })} className="rounded-lg border px-2" /><select value={exception.status} onChange={e => setSchedule({ ...schedule, exceptions: schedule.exceptions.map((x, i) => i === index ? { ...x, status: e.target.value as HoursStatus, intervals: e.target.value === 'open' ? [emptyInterval()] : [] } : x) })} className="rounded-lg border px-2"><option value="closed">Closed</option><option value="open">Open</option><option value="unverified">Unverified</option></select><button onClick={() => setSchedule({ ...schedule, exceptions: schedule.exceptions.filter((_, i) => i !== index) })} className="text-red-600">Remove</button></div>
                {exception.status === 'open' && <DayEditor label="Hours" day={{ weekday: 1, status: exception.status, intervals: exception.intervals }} onChange={day => setSchedule({ ...schedule, exceptions: schedule.exceptions.map((x, i) => i === index ? { ...x, intervals: day.intervals } : x) })} />}
              </div>)}</div>

            {(schedule.warnings?.length || errors.length > 0) && <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"><h3 className="font-bold">Review findings</h3><ul className="list-disc pl-5">{schedule.warnings?.map((x, i) => <li key={`w${i}`}>{x}</li>)}{errors.map((x, i) => <li key={`e${i}`} className="text-red-700">{x}</li>)}</ul></div>}

            <div className="rounded-2xl border bg-white p-4"><h2 className="font-bold">Calendar preview</h2><div className="mt-2 flex gap-2"><input type="date" value={previewDate} onChange={e => setPreviewDate(e.target.value)} className="rounded-lg border px-3 py-2" /><button onClick={async () => selectedFacility && setPreview((await previewSchedule(schedule, selectedFacility.name, previewDate)).response)} className="rounded-lg border px-3 py-2">Preview</button></div>{preview && <p className="mt-3 text-sm">{preview}</p>}</div>

            <div className="flex gap-3"><button onClick={handleValidate} className="rounded-xl border border-[#8A244B] px-5 py-2 font-semibold text-[#8A244B]">Validate</button><button disabled={busy} onClick={handlePublish} className="rounded-xl bg-[#8A244B] px-5 py-2 font-semibold text-white disabled:opacity-50">Publish schedule</button></div>
          </section>
        </div>}
      </main>
    </div>
  )
}
