import { useState } from 'react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import IosInstallModal from '@/components/IosInstallModal'
import MessageModal from '@/components/MessageModal'
import iosInstallVideoSrc from '@/assets/ios_install_demo.mp4'

const ALREADY_INSTALLED_MESSAGE = "Already have it? Check your home screen."
const MACOS_SAFARI_MESSAGE = 'Open the File menu and click "Add to Dock".'
const IOS_CHROME_MESSAGE = "Chrome on iOS can't install apps — open this page in Safari instead."
const UNSUPPORTED_MESSAGE = "Installing needs Chrome, Edge, or Safari — try opening this page in one of those."

export default function DownloadHawkbotButton({ label = 'Download Hawkbot' }: { label?: string }) {
  const { installed, installCase, promptInstall } = useInstallPrompt()
  const [message, setMessage] = useState<string | null>(null)
  const [showIosModal, setShowIosModal] = useState(false)

  const handleClick = async () => {
    if (installed) {
      setMessage(ALREADY_INSTALLED_MESSAGE)
      return
    }

    switch (installCase) {
      case 'chromium': {
        const prompted = await promptInstall()
        if (!prompted) setMessage(ALREADY_INSTALLED_MESSAGE)
        break
      }
      case 'ios-safari':
        setShowIosModal(true)
        break
      case 'macos-safari':
        setMessage(MACOS_SAFARI_MESSAGE)
        break
      case 'ios-chrome':
        setMessage(IOS_CHROME_MESSAGE)
        break
      case 'unsupported':
        setMessage(UNSUPPORTED_MESSAGE)
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
        <MessageModal message={message} onClose={() => setMessage(null)} />
      )}
      {showIosModal && (
        <IosInstallModal onClose={() => setShowIosModal(false)} videoSrc={iosInstallVideoSrc} />
      )}
    </div>
  )
}
