interface MessageModalProps {
  message: string
  onClose: () => void
}

export default function MessageModal({ message, onClose }: MessageModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#FAF3E1] rounded-2xl p-6 max-w-sm w-full shadow-2xl relative text-center"
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

        <p className="text-slate-700 text-base mt-2 mb-5">{message}</p>

        <button
          onClick={onClose}
          className="px-6 py-2 bg-[#8A244B] text-white rounded-lg font-medium
                     hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
        >
          Got it
        </button>
      </div>
    </div>
  )
}
