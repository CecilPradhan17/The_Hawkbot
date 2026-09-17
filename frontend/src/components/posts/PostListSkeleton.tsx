const CONTENT_WIDTHS = [
  ['w-full', 'w-11/12', 'w-2/3'],
  ['w-full', 'w-4/5'],
  ['w-full', 'w-full', 'w-3/5'],
  ['w-full', 'w-3/4'],
]

export default function PostListSkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse motion-reduce:animate-none"
      role="status"
      aria-label="Loading posts"
    >
      {CONTENT_WIDTHS.map((lineWidths, cardIndex) => (
        <div
          key={cardIndex}
          className="bg-white rounded-xl p-6 shadow-sm border border-slate-200"
          aria-hidden="true"
        >
          <div className="flex justify-between items-center mb-5">
            <div className="h-3 w-20 rounded-full bg-slate-200" />
            <div className="h-3 w-16 rounded-full bg-slate-200" />
          </div>

          <div className="space-y-2.5 mb-5">
            {lineWidths.map((width, lineIndex) => (
              <div
                key={lineIndex}
                className={`h-4 ${width} rounded-full bg-slate-200`}
              />
            ))}
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
            <div className="h-7 w-20 rounded-lg bg-slate-200" />
            <div className="h-7 w-24 rounded-lg bg-slate-200" />
          </div>
        </div>
      ))}
      <span className="sr-only">Loading posts...</span>
    </div>
  )
}
