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
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF3E1] rounded-2xl p-6 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl relative"
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
          <p className="text-slate-500 text-sm">Takes about 10 seconds 🦅</p>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#8A244B]/15 shadow-sm mb-5 aspect-[9/16] bg-slate-200">
          {videoSrc ? (
            <video
              src={videoSrc}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm px-6 text-center">
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
