import { useRef, useState } from 'react'

interface IosInstallModalProps {
  onClose: () => void
  videoSrc?: string
}

const STEPS = [
  'Tap the Share icon',
  'Scroll down and tap "Add to Home Screen"',
  'Tap "Add" in the top right',
]

export default function IosInstallModal({ onClose, videoSrc }: IosInstallModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ended, setEnded] = useState(false)

  const handleReplay = () => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = 0
    video.play()
    setEnded(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF3E1] rounded-2xl p-6 max-w-sm w-full max-h-[90vh] overflow-y-auto shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full
                     text-slate-400 hover:text-slate-600 hover:bg-black/5 transition-colors"
        >
          ✕
        </button>

        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-[#8A244B] mb-1">
            Add Hawkbot to your Home Screen
          </h2>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#8A244B]/15 shadow-sm mb-5 bg-slate-200 h-[420px] flex items-center justify-center relative">
          {videoSrc ? (
            <>
              <video
                ref={videoRef}
                src={videoSrc}
                autoPlay
                muted
                playsInline
                onEnded={() => setEnded(true)}
                className="max-w-full max-h-full object-contain"
              />
              {ended && (
                <div className="absolute inset-0 bg-gray-800/60 flex items-center justify-center">
                  <button
                    onClick={handleReplay}
                    aria-label="Replay video"
                    className="w-12 h-12 rounded-full bg-white/25 backdrop-blur-sm border border-white/40
                               flex items-center justify-center text-white text-xl
                               hover:bg-white/35 transition-colors"
                  >
                    ↻
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-slate-400 text-sm px-6 text-center">
              Video coming soon
            </div>
          )}
        </div>

        <ol className="space-y-2">
          {STEPS.map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#8A244B] text-white flex items-center justify-center text-xs font-semibold">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
