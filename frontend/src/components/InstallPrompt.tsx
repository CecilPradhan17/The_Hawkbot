import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'

export default function InstallPrompt() {
  const { canInstall, showIosInstructions, promptInstall } = useInstallPrompt()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || (!canInstall && !showIosInstructions)) return null

  return (
    <div
      className="fixed bottom-24 inset-x-4 sm:inset-x-auto sm:right-4 sm:w-80 z-50
                 bg-[#FAF3E1] border border-[#8A244B]/20 rounded-2xl shadow-2xl p-4"
    >
      {canInstall ? (
        <>
          <p className="text-sm text-slate-700 mb-3">
            Install Hawkbot for quick access from your home screen.
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Not now
            </button>
            <button
              onClick={promptInstall}
              className="px-4 py-1.5 bg-[#8A244B] text-white rounded-lg text-sm font-medium
                         hover:scale-105 active:scale-95 transition-all"
            >
              Install
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-700 mb-3">
            Install Hawkbot: tap <span className="font-semibold">Share</span>, then{' '}
            <span className="font-semibold">Add to Home Screen</span>.
          </p>
          <div className="flex justify-end">
            <button
              onClick={() => setDismissed(true)}
              className="px-4 py-1.5 bg-[#8A244B] text-white rounded-lg text-sm font-medium
                         hover:scale-105 active:scale-95 transition-all"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  )
}
