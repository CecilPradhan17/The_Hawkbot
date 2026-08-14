import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import IosInstallModal from '@/components/IosInstallModal'

const ALREADY_INSTALLED_MESSAGE = "Already have it? Check your home screen."

export default function DownloadHawkbotButton({ label = 'Download Hawkbot' }: { label?: string }) {
  const { installed, installCase, promptInstall } = useInstallPrompt()
  const [message, setMessage] = useState<string | null>(null)
  const [showIosModal, setShowIosModal] = useState(false)

  const handleClick = () => {
    if (installed) {
      setMessage(ALREADY_INSTALLED_MESSAGE)
      return
    }

    switch (installCase) {
      case 'chromium':
        promptInstall()
        break
      case 'ios-safari':
        setShowIosModal(true)
        break
      case 'macos-safari':
      case 'ios-chrome':
      case 'unsupported':
        // TODO: per-case instructional prompt, built out in later chunks
        break
    }
  }

  return (
    <div className="mt-6 flex flex-col items-center">
      <button
        onClick={handleClick}
        className="px-6 py-3 bg-[#8A244B] text-white rounded-lg font-medium shadow-lg
                   shadow-black-400/30 hover:shadow-xl hover:shadow-black-500/40
                   hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
      >
        {label}
      </button>
      {message && (
        <p className="mt-3 text-sm text-slate-500">{message}</p>
      )}
      {showIosModal && (
        <IosInstallModal onClose={() => setShowIosModal(false)} />
      )}
    </div>
  )
}
