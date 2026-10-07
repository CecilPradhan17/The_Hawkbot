import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '@/components/Header'
import { getHawkWallSource, type HawkWallSourceResponse, type PostResponse } from '@/api/posts.api'
import { getTimeAgo } from '@/utils/timeAgo'

function StatusBadge({ status }: { status: PostResponse['status'] }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
      status === 'approved'
        ? 'bg-emerald-100 text-emerald-800'
        : status === 'disapproved'
          ? 'bg-red-100 text-red-700'
          : 'bg-amber-100 text-amber-800'
    }`}>
      {status}
    </span>
  )
}

function EvidenceCard({ post, highlighted }: { post: PostResponse; highlighted: boolean }) {
  return (
    <article className={`rounded-xl border bg-white p-5 shadow-sm ${
      highlighted ? 'border-[#1B5E8A] ring-2 ring-[#1B5E8A]/15' : 'border-slate-200'
    }`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StatusBadge status={post.status} />
          {highlighted && (
            <span className="rounded-full bg-[#1B5E8A] px-2.5 py-1 text-xs font-semibold text-white">
              Source used by Hawkbot
            </span>
          )}
        </div>
        <span className="text-xs text-slate-500">{getTimeAgo(post.created_at)}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{post.content}</p>
      {post.type !== 'question' && (
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Community score: {post.vote_count}
        </p>
      )}
    </article>
  )
}

export default function HawkWallSource() {
  const navigate = useNavigate()
  const { threadId } = useParams()
  const [thread, setThread] = useState<HawkWallSourceResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestedSourcePostId = Number(threadId)
  const invalidSource = !Number.isInteger(requestedSourcePostId) || requestedSourcePostId <= 0

  useEffect(() => {
    if (invalidSource) return
    getHawkWallSource(requestedSourcePostId)
      .then(setThread)
      .catch(error => setError(error instanceof Error ? error.message : 'This HawkWall source could not be loaded.'))
  }, [invalidSource, requestedSourcePostId])

  return (
    <div className="min-h-screen bg-[#FAF3E1]">
      <Header />
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={() => navigate('/chat')}
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#1B5E8A] hover:underline"
        >
          ← Back to Hawkbot
        </button>

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#1B5E8A]">HawkWall evidence</p>
          <h1 className="mt-1 text-2xl font-bold text-[#8A244B]">Source discussion</h1>
          <p className="mt-2 text-sm text-slate-600">
            This is the community discussion Hawkbot used. Moderation labels are preserved so you can evaluate the context yourself.
          </p>
        </div>

        {!thread && !error && !invalidSource && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500" role="status">
            Loading source discussion…
          </div>
        )}

        {(error || invalidSource) && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {invalidSource ? 'This source link is invalid.' : error}
          </div>
        )}

        {thread && (
          <div className="space-y-5">
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {thread.post.type === 'question' ? 'Question' : 'Post'}
              </p>
              <EvidenceCard post={thread.post} highlighted={thread.post.id === thread.sourcePostId} />
            </section>

            {thread.post.type === 'question' && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {thread.answers?.length ?? 0} {(thread.answers?.length ?? 0) === 1 ? 'Answer' : 'Answers'}
                </p>
                <div className="space-y-3">
                  {(thread.answers ?? []).map(answer => (
                    <EvidenceCard key={answer.id} post={answer} highlighted={answer.id === thread.sourcePostId} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
