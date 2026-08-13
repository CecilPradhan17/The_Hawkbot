import { usePwaUpdate } from '@/hooks/usePwaUpdate'

export default function PwaUpdatePrompt() {
  const { needRefresh, refresh, dismiss } = usePwaUpdate()

  if (!needRefresh) return null

  return (
    <div
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-50
                 bg-[#FAF3E1] border border-[#8A244B]/20 rounded-2xl shadow-2xl p-4"
    >
      <p className="text-sm text-slate-700 mb-3">
        A new version of Hawkbot is available.
      </p>
      <div className="flex gap-2 justify-end">
        <button
          onClick={dismiss}
          className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Later
        </button>
        <button
          onClick={refresh}
          className="px-4 py-1.5 bg-[#8A244B] text-white rounded-lg text-sm font-medium
                     hover:scale-105 active:scale-95 transition-all"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}
