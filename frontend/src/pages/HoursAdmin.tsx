import { useEffect, useMemo, useState } from 'react'
import Header from '@/components/Header'
import FacilityManager from '@/components/FacilityManager'
import ScheduleReview from '@/components/ScheduleReview'
import TimeField from '@/components/TimeField'
import {
  checkHoursAccess, createFacility, extractSchedule, getCurrentSchedule, getFacilities,
  type DateException, type DayRule, type Facility, type HoursInterval,
  type HoursSchedule, type HoursStatus,
} from '@/api/hours.api'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const emptyWeek = (): DayRule[] => DAYS.map((_, index) => ({ weekday: index + 1, status: 'unverified', intervals: [] }))
const emptyInterval = (): HoursInterval => ({ opensAt: '08:00', closesAt: '17:00', closesNextDay: false })
const emptySchedule = (facility: Pick<Facility, 'id' | 'name'>): HoursSchedule => ({
  facilityId: facility.id,
  sourceLabel: `Manually entered hours for ${facility.name}`,
  coverageStart: '',
  coverageEnd: '',
  weekly: emptyWeek(),
  specialPeriods: [],
  exceptions: [],
  warnings: [],
})

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
        <span className="text-xs font-semibold text-slate-500">Status</span><select aria-label="Hours status" value={day.status} onChange={event => setStatus(event.target.value as HoursStatus)} className="rounded-lg border px-2 py-1.5">
          <option value="open">Open</option><option value="closed">Closed</option><option value="unverified">Unverified</option>
        </select>
      </div>
      {day.status === 'open' && (
        <div className="mt-3 space-y-2">
          {day.intervals.map((interval, index) => (
            <div key={index} className="flex flex-wrap items-center gap-2 text-sm">
              <TimeField label="Opens" value={interval.opensAt} onChange={value => updateInterval(index, { opensAt: value })} />
              <span>to</span>
              <TimeField label="Closes" value={interval.closesAt} onChange={value => updateInterval(index, { closesAt: value })} />
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
  const [documentName, setDocumentName] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
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
    setBusy(true); setMessage('Extracting schedule…')
    if (documentUrl) URL.revokeObjectURL(documentUrl)
    setDocumentUrl(URL.createObjectURL(file)); setDocumentType(file.type); setDocumentName(file.name)
    try {
      const extracted = await extractSchedule(file)
      setSchedule({ ...extracted, facilityId })
      setMessage('Extraction complete. Review every field before publishing.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Extraction failed') }
    finally { setBusy(false) }
  }

  const handleManualEntry = (facility: Pick<Facility, 'id' | 'name'>) => {
    if (documentUrl) URL.revokeObjectURL(documentUrl)
    setFacilityId(facility.id)
    setDocumentUrl(null)
    setDocumentType('')
    setDocumentName('')
    setSchedule(emptySchedule(facility))
    setMessage(`Enter ${facility.name}'s hours below, then validate and publish the schedule.`)
  }

  const handleCreateFacility = async (startManualEntry: boolean) => {
    setBusy(true)
    try {
      const facility = await createFacility({
        name: newName,
        aliases: newAliases.split(',').map(alias => alias.trim()).filter(Boolean),
      })
      setNewName('')
      setNewAliases('')
      await refreshFacilities()
      setFacilityId(facility.id)
      if (startManualEntry) handleManualEntry(facility)
      else setMessage(`${facility.name} was created.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not create facility')
    } finally {
      setBusy(false)
    }
  }

  const handleLoadCurrent = async () => {
    if (!selectedFacility) return
    setBusy(true)
    setMessage('Loading current schedule…')
    try {
      setSchedule(await getCurrentSchedule(selectedFacility.id))
      setDocumentUrl(null)
      setDocumentType('')
      setDocumentName('')
      setMessage('Current schedule loaded. Review it before making changes.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load schedule')
    } finally {
      setBusy(false)
    }
  }

  const handleFacilityUpdated = async () => {
    await refreshFacilities()
  }

  const handleFacilityDeleted = async () => {
    if (documentUrl) URL.revokeObjectURL(documentUrl)
    setDocumentUrl(null)
    setDocumentType('')
    setDocumentName('')
    setSchedule(null)
    const data = await getFacilities()
    setFacilities(data)
    setFacilityId(data[0]?.id ?? null)
  }

  const addSpecialPeriod = () => setSchedule(current => current ? ({ ...current, specialPeriods: [...current.specialPeriods, { name: '', startDate: '', endDate: '', days: emptyWeek() }] }) : current)
  const addException = () => setSchedule(current => current ? ({ ...current, exceptions: [...current.exceptions, { date: '', name: '', status: 'closed', intervals: [] }] }) : current)

  if (authorized === null) return <div className="min-h-screen bg-[#FAF3E1]"><Header /><p className="p-8 text-center">Checking access…</p></div>
  if (!authorized) return <div className="min-h-screen bg-[#FAF3E1]"><Header /><p className="p-8 text-center text-red-700">You are not authorized to manage hours.</p></div>

  return (
    <div className="min-h-screen bg-[#FAF3E1]"><Header />
      <main className="mx-auto max-w-7xl p-4 sm:p-8">
        <h1 className="text-3xl font-bold text-slate-800">Campus Hours Manager</h1>
        <p className="mt-1 text-slate-600">Follow the steps below to update the hours students receive from Hawkbot.</p>

        <details className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-bold text-[#8A244B]">+ Create a new facility</summary>
          <p className="mt-2 text-sm text-slate-500">Only use this when the facility is not already listed below.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Facility name" className="rounded-lg border px-3 py-2" />
            <input value={newAliases} onChange={e => setNewAliases(e.target.value)} placeholder="Aliases, comma separated" className="min-w-72 rounded-lg border px-3 py-2" />
            <button disabled={busy || !newName.trim()} className="rounded-lg border border-[#8A244B] px-4 py-2 font-semibold text-[#8A244B] disabled:opacity-50" onClick={() => handleCreateFacility(false)}>Create only</button>
            <button disabled={busy || !newName.trim()} className="rounded-lg bg-[#8A244B] px-4 py-2 font-semibold text-white disabled:opacity-50" onClick={() => handleCreateFacility(true)}>Create &amp; enter hours</button>
          </div>
        </details>

        <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#8A244B]">Step 1</p>
            <h2 className="text-xl font-bold text-slate-800">Choose a facility</h2>
            <p className="mt-1 text-sm text-slate-500">Select the place whose hours you want to manage.</p>
          </div>
          {facilities.length === 0 ? <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-800">No facilities yet. Create one using the option above.</p> : <>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <select aria-label="Facility" value={facilityId ?? ''} onChange={event => { setFacilityId(Number(event.target.value)); setSchedule(null); setMessage('') }} className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium">
                {facilities.map(facility => <option key={facility.id} value={facility.id}>{facility.name}</option>)}
              </select>
              {selectedFacility?.schedule && <button disabled={busy} onClick={handleLoadCurrent} className="min-h-11 rounded-lg border-2 border-[#8A244B] bg-white px-4 py-2 font-bold text-[#8A244B] transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:opacity-50">Edit published schedule</button>}
            </div>

            <div className="mt-5 border-t pt-5">
              <p className="text-xs font-bold uppercase tracking-wider text-[#8A244B]">Step 2</p>
              <h2 className="text-lg font-bold text-slate-800">Upload a new schedule</h2>
              <p className="mt-1 text-sm text-slate-500">PDF, PNG, JPEG, or WebP up to 10 MB. You will review everything before publishing.</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="cursor-pointer rounded-lg bg-[#8A244B] px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-[#711d3e] active:scale-[0.98] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                  {busy ? 'Processing…' : 'Choose schedule file'}
                  <input className="sr-only" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" disabled={!facilityId || busy} onChange={event => handleUpload(event.target.files?.[0])} />
                </label>
                <span className="text-sm font-medium text-slate-600">{documentName || 'No new file selected'}</span>
                <span className="text-sm text-slate-400">or</span>
                <button
                  disabled={!selectedFacility || busy}
                  onClick={() => selectedFacility && handleManualEntry(selectedFacility)}
                  className="rounded-lg border-2 border-[#8A244B] bg-white px-5 py-2 font-bold text-[#8A244B] transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:opacity-50"
                >
                  Enter hours manually
                </button>
              </div>
            </div>
            {selectedFacility && <FacilityManager key={selectedFacility.id} facility={selectedFacility} onUpdated={handleFacilityUpdated} onDeleted={handleFacilityDeleted} onMessage={setMessage} />}
          </>}
        </section>

        {message && <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700 shadow-sm">{message}</p>}
        {schedule && <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wider text-[#8A244B]">Step 3</p>
            <h2 className="text-2xl font-bold text-slate-800">Review and correct the schedule</h2>
            <p className="mt-1 text-sm text-slate-600">Compare every field with the source document. Changes here are not saved until you publish.</p>
          </div>
          <section className="min-h-96 rounded-2xl border bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <h2 className="mb-3 text-xl font-bold">Original document</h2>
            {!documentUrl ? <p className="text-slate-500">No source document is attached. Complete the schedule fields manually, then validate before publishing.</p>
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

            <ScheduleReview schedule={schedule} facility={selectedFacility!} onPublished={refreshFacilities} onMessage={setMessage} />
          </section>
        </div>}
      </main>
    </div>
  )
}
