interface TimeFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export default function TimeField({ label, value, onChange }: TimeFieldProps) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <input
        aria-label={label}
        type="time"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="min-h-10 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
      />
    </label>
  )
}
