import { type FormEvent, useCallback, useEffect, useState } from 'react'
import Header from '@/components/Header'
import {
  getAdminKnowledge,
  queueAdminKnowledgeReview,
  updateAdminKnowledgeReviewCategory,
  type AdminKnowledgeItem,
  type KnowledgeStatusFilter,
  type ReviewCategory,
} from '@/api/knowledge-admin.api'

const PAGE_SIZE = 25
const FILTERS: { value: KnowledgeStatusFilter; label: string }[] = [
  { value: 'all', label: 'All knowledge' },
  { value: 'active', label: 'Active' },
  { value: 'needs_update', label: 'Needs update' },
  { value: 'replaced', label: 'Replaced' },
]

const statusLabel = (status: AdminKnowledgeItem['status']) => ({
  active: 'Active',
  needs_update: 'Needs update',
  replaced: 'Replaced',
})[status]

const statusClasses = (status: AdminKnowledgeItem['status']) => ({
  active: 'bg-emerald-100 text-emerald-800',
  needs_update: 'bg-amber-100 text-amber-900',
  replaced: 'bg-slate-200 text-slate-700',
})[status]

const formatDate = (value: string | null) => {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function KnowledgeCard({
  item,
  onCategoryUpdate,
  onQueueReview,
}: {
  item: AdminKnowledgeItem
  onCategoryUpdate: (knowledgeId: number, category: ReviewCategory) => Promise<void>
  onQueueReview: (knowledgeId: number) => Promise<{ queued: boolean; alreadyOpen: boolean }>
}) {
  const [selectedCategory, setSelectedCategory] = useState<ReviewCategory | ''>(item.reviewCategory ?? '')
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryMessage, setCategoryMessage] = useState('')
  const [queueingReview, setQueueingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')

  useEffect(() => {
    setSelectedCategory(item.reviewCategory ?? '')
  }, [item.reviewCategory])

  const saveCategory = async () => {
    if (!selectedCategory || selectedCategory === item.reviewCategory) return
    setSavingCategory(true)
    setCategoryMessage('')
    try {
      await onCategoryUpdate(item.id, selectedCategory)
      setCategoryMessage('Review category saved.')
    } catch (saveError) {
      setCategoryMessage(saveError instanceof Error ? saveError.message : 'Could not save the review category.')
    } finally {
      setSavingCategory(false)
    }
  }

  const hasOpenReview = item.latestVerificationStatus === 'open'
  const isQueuedForReview = !hasOpenReview
    && item.reviewDueAt !== null
    && new Date(item.reviewDueAt).getTime() <= Date.now()

  const queueReview = async () => {
    setQueueingReview(true)
    setReviewMessage('')
    try {
      const result = await onQueueReview(item.id)
      setReviewMessage(result.alreadyOpen
        ? 'A HawkWall verification is already open.'
        : 'Queued for the next verification run.')
    } catch (queueError) {
      setReviewMessage(queueError instanceof Error ? queueError.message : 'Could not queue this fact for review.')
    } finally {
      setQueueingReview(false)
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClasses(item.status)}`}>
          {statusLabel(item.status)}
        </span>
        <span className="rounded-full bg-[#8A244B]/10 px-2.5 py-1 text-xs font-bold capitalize text-[#8A244B]">
          {item.reviewCategory ? `${item.reviewCategory} review` : 'Review unassigned'}
        </span>
        <span className="ml-auto text-xs font-semibold text-slate-400">Fact #{item.id}</span>
      </div>

      {item.status === 'active' && (
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Community verification</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {hasOpenReview
                ? 'This fact is currently being checked on HawkWall.'
                : isQueuedForReview
                  ? 'This fact will be posted by the next scheduled verification run.'
                  : 'Queue this fact to be checked again by the HawkWall community.'}
            </p>
            {reviewMessage && (
              <p role="status" className={`mt-1 text-sm font-medium ${reviewMessage.startsWith('Could not') ? 'text-red-700' : 'text-emerald-700'}`}>
                {reviewMessage}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void queueReview()}
            disabled={queueingReview || hasOpenReview || isQueuedForReview}
            className="min-h-11 shrink-0 rounded-lg border-2 border-[#8A244B] bg-white px-4 py-2 font-bold text-[#8A244B] transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-500 disabled:opacity-70"
          >
            {queueingReview
              ? 'Queueing…'
              : hasOpenReview
                ? 'Review open'
                : isQueuedForReview
                  ? 'Review queued'
                  : 'Queue review'}
          </button>
        </div>
      )}

      <p className="mt-4 whitespace-pre-wrap text-base font-medium leading-7 text-slate-800">{item.content}</p>

      <dl className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-500">Last verified</dt>
          <dd className="mt-0.5 text-slate-800">{formatDate(item.lastVerifiedAt)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Next review</dt>
          <dd className="mt-0.5 text-slate-800">
            {item.reviewCategory === 'stable' ? 'No automatic review' : formatDate(item.reviewDueAt)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Latest verification</dt>
          <dd className="mt-0.5 capitalize text-slate-800">{item.latestVerificationStatus ?? 'None'}</dd>
        </div>
      </dl>

      <div className="mt-4 rounded-xl border border-slate-200 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-semibold text-slate-700">
            Review category
            <select
              value={selectedCategory}
              disabled={savingCategory}
              onChange={event => {
                setSelectedCategory(event.target.value as ReviewCategory | '')
                setCategoryMessage('')
              }}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
            >
              <option value="" disabled>Choose a category</option>
              <option value="stable">Stable — no automatic review</option>
              <option value="yearly">Yearly — review after one year</option>
              <option value="term">Term — review for a new semester</option>
              <option value="frequent">Frequent — review after 90 days</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void saveCategory()}
            disabled={!selectedCategory || selectedCategory === item.reviewCategory || savingCategory}
            className="min-h-11 rounded-lg bg-[#8A244B] px-4 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {savingCategory ? 'Saving…' : 'Save category'}
          </button>
        </div>
        {categoryMessage && (
          <p role="status" className={`mt-2 text-sm font-medium ${categoryMessage === 'Review category saved.' ? 'text-emerald-700' : 'text-red-700'}`}>
            {categoryMessage}
          </p>
        )}
      </div>

      {(item.sourcePostId || item.sourceContent) && (
        <details className="mt-4 rounded-xl border border-slate-200 p-3">
          <summary className="cursor-pointer font-semibold text-[#8A244B]">
            View source{item.sourcePostId ? ` post #${item.sourcePostId}` : ''}
          </summary>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
            {item.sourceContent || item.rawContent || 'The source post is no longer visible.'}
          </p>
        </details>
      )}

      {item.status === 'needs_update' && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-bold">Correction workflow</p>
          <p className="mt-1">
            {item.correctionStatus === 'open'
              ? `Waiting for a corrected HawkWall answer${item.correctionQuestionPostId ? ` on post #${item.correctionQuestionPostId}` : ''}.`
              : 'No open correction question is linked to this fact.'}
          </p>
        </div>
      )}

      {item.status === 'replaced' && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-bold">Replacement{item.supersededById ? ` fact #${item.supersededById}` : ''}</p>
          <p className="mt-1">{item.replacementContent || 'Replacement details are unavailable.'}</p>
        </div>
      )}
    </article>
  )
}

export default function KnowledgeAdmin() {
  const [status, setStatus] = useState<KnowledgeStatusFilter>('all')
  const [searchInput, setSearchInput] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [items, setItems] = useState<AdminKnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadKnowledge = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getAdminKnowledge({
        status,
        search: appliedSearch,
        limit: PAGE_SIZE,
        offset,
      })
      setItems(result.items)
      setTotal(result.total)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load knowledge.')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, offset, status])

  useEffect(() => {
    void loadKnowledge()
  }, [loadKnowledge])

  const selectStatus = (nextStatus: KnowledgeStatusFilter) => {
    setStatus(nextStatus)
    setOffset(0)
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextSearch = searchInput.trim()
    setOffset(0)
    if (nextSearch === appliedSearch && offset === 0) {
      void loadKnowledge()
      return
    }
    setAppliedSearch(nextSearch)
  }

  const clearSearch = () => {
    setSearchInput('')
    setOffset(0)
    if (appliedSearch) setAppliedSearch('')
  }

  const updateReviewCategory = async (knowledgeId: number, reviewCategory: ReviewCategory) => {
    const updated = await updateAdminKnowledgeReviewCategory(knowledgeId, reviewCategory)
    setItems(current => current.map(item => item.id === knowledgeId
      ? { ...item, reviewCategory: updated.reviewCategory, reviewDueAt: updated.reviewDueAt }
      : item))
  }

  const queueReview = async (knowledgeId: number) => {
    const result = await queueAdminKnowledgeReview(knowledgeId)
    if (result.queued && result.reviewDueAt) {
      setItems(current => current.map(item => item.id === knowledgeId
        ? { ...item, reviewDueAt: result.reviewDueAt ?? item.reviewDueAt }
        : item))
    }
    return result
  }

  const firstShown = total === 0 ? 0 : offset + 1
  const lastShown = Math.min(offset + items.length, total)

  return (
    <div className="min-h-screen bg-[#FAF3E1]">
      <Header />
      <main className="mx-auto max-w-6xl p-4 sm:p-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#8A244B]">Owner tools</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-800">Knowledge Manager</h1>
            <p className="mt-1 max-w-2xl text-slate-600">
              Review what Hawkbot currently knows, where each fact came from, and whether it needs attention.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadKnowledge()}
            disabled={loading}
            className="min-h-11 rounded-lg border-2 border-[#8A244B] bg-white px-4 py-2 font-bold text-[#8A244B] transition hover:bg-[#8A244B]/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        <nav aria-label="Knowledge status" className="mt-6 flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map(filter => (
            <button
              type="button"
              key={filter.value}
              onClick={() => selectStatus(filter.value)}
              aria-pressed={status === filter.value}
              className={`min-h-11 shrink-0 rounded-full px-4 py-2 text-sm font-bold transition active:scale-[0.98] ${
                status === filter.value
                  ? 'bg-[#8A244B] text-white shadow-sm'
                  : 'border border-slate-300 bg-white text-slate-700 hover:border-[#8A244B] hover:text-[#8A244B]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex sm:items-end sm:gap-3">
          <label className="block flex-1 text-sm font-semibold text-slate-700">
            Search knowledge
            <input
              type="search"
              value={searchInput}
              maxLength={200}
              onChange={event => setSearchInput(event.target.value)}
              placeholder="Try library, tutoring, parking…"
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20"
            />
          </label>
          <div className="mt-3 flex gap-2 sm:mt-0">
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 flex-1 rounded-lg bg-[#8A244B] px-5 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none"
            >
              Search
            </button>
            {(searchInput || appliedSearch) && (
              <button
                type="button"
                onClick={clearSearch}
                disabled={loading}
                className="min-h-11 flex-1 rounded-lg border border-slate-300 px-4 py-2 font-bold text-slate-700 transition hover:border-[#8A244B] hover:text-[#8A244B] disabled:opacity-50 sm:flex-none"
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm text-slate-600">
          <p aria-live="polite">
            {loading
              ? 'Loading knowledge…'
              : `${total} ${total === 1 ? 'fact' : 'facts'}${appliedSearch ? ` matching “${appliedSearch}”` : ''}`}
          </p>
          {!loading && total > 0 && <p>Showing {firstShown}–{lastShown}</p>}
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <p className="font-bold">Knowledge could not be loaded</p>
            <p className="mt-1 text-sm">{error}</p>
            <button type="button" onClick={() => void loadKnowledge()} className="mt-3 font-bold underline">Try again</button>
          </div>
        )}

        {!error && loading && (
          <div role="status" className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            Loading Hawkbot knowledge…
          </div>
        )}

        {!error && !loading && items.length === 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-bold text-slate-800">No matching knowledge</h2>
            <p className="mt-1 text-sm text-slate-600">There are no facts in this status right now.</p>
          </div>
        )}

        {!error && !loading && items.length > 0 && (
          <section aria-label="Knowledge facts" className="mt-4 space-y-4">
            {items.map(item => (
              <KnowledgeCard
                key={item.id}
                item={item}
                onCategoryUpdate={updateReviewCategory}
                onQueueReview={queueReview}
              />
            ))}
          </section>
        )}

        {!error && !loading && total > PAGE_SIZE && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset(current => Math.max(0, current - PAGE_SIZE))}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(current => current + PAGE_SIZE)}
              className="min-h-11 rounded-lg bg-[#8A244B] px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
