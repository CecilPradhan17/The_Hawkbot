import { useState } from 'react'
import { deleteFacility, updateFacility, type Facility } from '@/api/hours.api'

interface FacilityManagerProps {
  facility: Facility
  onUpdated: () => Promise<void>
  onDeleted: () => Promise<void>
  onMessage: (message: string) => void
}

export default function FacilityManager({ facility, onUpdated, onDeleted, onMessage }: FacilityManagerProps) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [aliases, setAliases] = useState('')
  const [busy, setBusy] = useState(false)

  const startEditing = () => {
    setName(facility.name)
    setAliases(facility.aliases.filter(alias => alias !== facility.name).join(', '))
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      await updateFacility(facility.id, {
        name,
        aliases: aliases.split(',').map(alias => alias.trim()).filter(Boolean),
      })
      await onUpdated()
      setEditing(false)
      onMessage('Facility updated successfully. Its published schedule was not changed.')
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Could not update facility')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    const scheduleWarning = facility.schedule ? ' This will also permanently delete its published schedule.' : ''
    if (!window.confirm(`Delete ${facility.name}?${scheduleWarning} This cannot be undone.`)) return
    setBusy(true)
    try {
      await deleteFacility(facility.id)
      await onDeleted()
      onMessage(`${facility.name} was deleted.`)
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Could not delete facility')
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap gap-3 border-t pt-4">
        <button disabled={busy} onClick={startEditing} className="rounded-lg border border-[#8A244B] px-3 py-1.5 text-sm font-semibold text-[#8A244B] disabled:opacity-50">Edit facility</button>
        <button disabled={busy} onClick={remove} className="rounded-lg border border-red-600 px-3 py-1.5 text-sm font-semibold text-red-600 disabled:opacity-50">Delete facility</button>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-[#8A244B]/20 bg-[#FAF3E1]/40 p-3">
      <h3 className="font-semibold">Edit facility</h3>
      <div className="flex flex-wrap gap-2">
        <input value={name} onChange={event => setName(event.target.value)} placeholder="Facility name" className="rounded-lg border bg-white px-3 py-2" />
        <input value={aliases} onChange={event => setAliases(event.target.value)} placeholder="Aliases, comma separated" className="min-w-72 rounded-lg border bg-white px-3 py-2" />
      </div>
      <div className="flex gap-2">
        <button disabled={busy} onClick={save} className="rounded-lg bg-[#8A244B] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save changes</button>
        <button disabled={busy} onClick={() => setEditing(false)} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50">Cancel</button>
      </div>
    </div>
  )
}
