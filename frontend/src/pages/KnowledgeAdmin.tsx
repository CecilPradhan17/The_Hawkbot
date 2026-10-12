import { type FormEvent, useCallback, useEffect, useState } from 'react'
import Header from '@/components/Header'
import {
  archiveAdminKnowledge,
  correctAdminKnowledge,
  createAdminKnowledge,
  getAdminKnowledge,
  improveAdminKnowledge,
  queueAdminKnowledgeReview,
  updateAdminKnowledgeReviewCategory,
  type AdminKnowledgeItem,
  type KnowledgeStatusFilter,
  type KnowledgeSuggestion,
  type ReviewCategory,
} from '@/api/knowledge-admin.api'

const PAGE_SIZE = 25
const FILTERS: { value: KnowledgeStatusFilter; label: string }[] = [
  { value: 'all', label: 'All knowledge' },
  { value: 'active', label: 'Active' },
  { value: 'needs_update', label: 'Needs update' },
  { value: 'replaced', label: 'Replaced' },
  { value: 'archived', label: 'Archived' },
]

const statusLabel = (status: AdminKnowledgeItem['status']) => ({
  active: 'Active',
  needs_update: 'Needs update',
  replaced: 'Replaced',
  archived: 'Archived',
})[status]

const statusClasses = (status: AdminKnowledgeItem['status']) => ({
  active: 'bg-emerald-100 text-emerald-800',
  needs_update: 'bg-amber-100 text-amber-900',
  replaced: 'bg-slate-200 text-slate-700',
  archived: 'bg-rose-100 text-rose-800',
})[status]

const formatDate = (value: string | null) => {
  if (!value) return 'Not scheduled'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function AddKnowledgePanel({
  onCreate,
}: {
  onCreate: (knowledge: {
    content: string
    reviewCategory: ReviewCategory
    sourceTitle: string
    sourceUrl: string
  }) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [reviewCategory, setReviewCategory] = useState<ReviewCategory | ''>('')
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [improving, setImproving] = useState(false)
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([])
  const [savingSuggestionIndex, setSavingSuggestionIndex] = useState<number | null>(null)
  const [improvementError, setImprovementError] = useState('')
  const busy = saving || improving || savingSuggestionIndex !== null
  const sourceUrlValid = !sourceUrl.trim() || sourceUrl.trim().startsWith('https://')

  const reset = () => {
    setContent('')
    setReviewCategory('')
    setSourceTitle('')
    setSourceUrl('')
    setError('')
    setSuggestions([])
    setImprovementError('')
  }

  const cancel = () => {
    reset()
    setOpen(false)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!reviewCategory) return
    setSaving(true)
    setError('')
    try {
      await onCreate({
        content: content.trim(),
        reviewCategory,
        sourceTitle: sourceTitle.trim(),
        sourceUrl: sourceUrl.trim(),
      })
      reset()
      setOpen(false)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Could not add this knowledge.')
    } finally {
      setSaving(false)
    }
  }

  const improve = async () => {
    if (content.trim().length < 5) return
    setImproving(true)
    setImprovementError('')
    try {
      const result = await improveAdminKnowledge(content.trim())
      setSuggestions(result.suggestions)
    } catch (improveError) {
      setImprovementError(improveError instanceof Error ? improveError.message : 'Could not improve this knowledge.')
    } finally {
      setImproving(false)
    }
  }

  const updateSuggestion = (index: number, update: Partial<KnowledgeSuggestion>) => {
    setSuggestions(current => current.map((suggestion, suggestionIndex) => (
      suggestionIndex === index ? { ...suggestion, ...update } : suggestion
    )))
    setImprovementError('')
  }

  const saveSuggestion = async (index: number) => {
    const suggestion = suggestions[index]
    if (!suggestion) return
    setSavingSuggestionIndex(index)
    setImprovementError('')
    try {
      await onCreate({
        content: suggestion.content.trim(),
        reviewCategory: suggestion.reviewCategory,
        sourceTitle: sourceTitle.trim(),
        sourceUrl: sourceUrl.trim(),
      })
      setSuggestions(current => current.filter((_, suggestionIndex) => suggestionIndex !== index))
    } catch (saveError) {
      setImprovementError(saveError instanceof Error ? saveError.message : 'Could not add this suggestion.')
    } finally {
      setSavingSuggestionIndex(null)
    }
  }

  if (!open) {
    return (
      <div className="mt-6 rounded-2xl border border-[#8A244B]/20 bg-white p-4 shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h2 className="font-bold text-slate-800">Add verified knowledge</h2>
          <p className="mt-1 text-sm text-slate-600">
            Add one sourced, self-contained fact directly to Hawkbot.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 min-h-11 w-full rounded-lg bg-[#8A244B] px-5 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98] sm:mt-0 sm:w-auto"
        >
          Add knowledge
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border-2 border-[#8A244B]/30 bg-white p-4 shadow-sm sm:p-5">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Add verified knowledge</h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter one atomic fact. Hawkbot stores this wording exactly and generates an embedding when you save.
        </p>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Knowledge fact
        <textarea
          required
          minLength={5}
          maxLength={2000}
          rows={4}
          value={content}
          disabled={busy}
          placeholder="Example: The Registrar is located in Sandel Hall."
          onChange={event => {
            setContent(event.target.value)
            setError('')
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal leading-6 outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
        />
        <span className="mt-1 block text-xs font-normal text-slate-500">{content.length}/2000 characters</span>
      </label>

      <div className="flex flex-col gap-3 rounded-xl border border-violet-200 bg-violet-50 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-violet-950">Optional AI assistance</p>
          <p className="mt-0.5 text-sm text-violet-800">
            Uses one AI call to suggest atomic wording. Nothing is saved until you approve a suggestion.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void improve()}
          disabled={busy || content.trim().length < 5}
          className="min-h-11 shrink-0 rounded-lg border-2 border-violet-700 bg-white px-4 py-2 font-bold text-violet-800 transition hover:bg-violet-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {improving ? 'Improving…' : 'Improve with AI'}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-slate-700">
          Review category
          <select
            required
            value={reviewCategory}
            disabled={busy}
            onChange={event => {
              setReviewCategory(event.target.value as ReviewCategory | '')
              setError('')
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

        <label className="block text-sm font-semibold text-slate-700">
          Source label
          <input
            required
            minLength={3}
            maxLength={200}
            value={sourceTitle}
            disabled={busy}
            placeholder="Example: ULM Registrar website"
            onChange={event => {
              setSourceTitle(event.target.value)
              setError('')
            }}
            className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
          />
        </label>
      </div>

      <label className="block text-sm font-semibold text-slate-700">
        Source URL <span className="font-normal text-slate-500">(optional, HTTPS only)</span>
        <input
          type="url"
          pattern="https://.*"
          maxLength={2000}
          value={sourceUrl}
          disabled={busy}
          placeholder="https://www.ulm.edu/..."
          onChange={event => {
            setSourceUrl(event.target.value)
            setError('')
          }}
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
        />
      </label>

      {suggestions.length > 0 && (
        <section aria-label="Unsaved AI suggestions" className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-3">
          <div>
            <h3 className="font-bold text-violet-950">Unsaved AI suggestions</h3>
            <p className="mt-0.5 text-sm text-violet-800">
              Check every detail. Edit or discard suggestions, then add only the facts you approve.
            </p>
          </div>
          {suggestions.map((suggestion, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-violet-200 bg-white p-3">
              <label className="block text-sm font-semibold text-slate-700">
                Suggested fact {index + 1}
                <textarea
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  value={suggestion.content}
                  disabled={busy}
                  onChange={event => updateSuggestion(index, { content: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal leading-6 outline-none transition focus:border-violet-600 focus:ring-2 focus:ring-violet-600/20 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Suggested review category
                <select
                  value={suggestion.reviewCategory}
                  disabled={busy}
                  onChange={event => updateSuggestion(index, { reviewCategory: event.target.value as ReviewCategory })}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal"
                >
                  <option value="stable">Stable — no automatic review</option>
                  <option value="yearly">Yearly — review after one year</option>
                  <option value="term">Term — review for a new semester</option>
                  <option value="frequent">Frequent — review after 90 days</option>
                </select>
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setSuggestions(current => current.filter((_, suggestionIndex) => suggestionIndex !== index))}
                  disabled={busy}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void saveSuggestion(index)}
                  disabled={busy || suggestion.content.trim().length < 5 || sourceTitle.trim().length < 3 || !sourceUrlValid}
                  className="min-h-11 rounded-lg bg-violet-700 px-4 py-2 font-bold text-white transition hover:bg-violet-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingSuggestionIndex === index ? 'Adding suggestion…' : 'Add this fact'}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {improvementError && <p role="alert" className="text-sm font-medium text-red-700">{improvementError}</p>}

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={cancel}
          disabled={busy}
          className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || content.trim().length < 5 || !reviewCategory || sourceTitle.trim().length < 3 || !sourceUrlValid}
          className="min-h-11 rounded-lg bg-[#8A244B] px-5 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving ? 'Adding knowledge…' : 'Add to Hawkbot'}
        </button>
      </div>
    </form>
  )
}

function KnowledgeCard({
  item,
  onArchive,
  onCategoryUpdate,
  onCorrect,
  onQueueReview,
}: {
  item: AdminKnowledgeItem
  onArchive: (knowledgeId: number, note: string) => Promise<void>
  onCategoryUpdate: (knowledgeId: number, category: ReviewCategory) => Promise<void>
  onCorrect: (
    knowledgeId: number,
    content: string,
    category: ReviewCategory,
    note: string,
    sourceTitle: string,
    sourceUrl: string,
  ) => Promise<void>
  onQueueReview: (knowledgeId: number) => Promise<{ queued: boolean; alreadyOpen: boolean }>
}) {
  const [selectedCategory, setSelectedCategory] = useState<ReviewCategory | ''>(item.reviewCategory ?? '')
  const [savingCategory, setSavingCategory] = useState(false)
  const [categoryMessage, setCategoryMessage] = useState('')
  const [queueingReview, setQueueingReview] = useState(false)
  const [reviewMessage, setReviewMessage] = useState('')
  const [showCorrection, setShowCorrection] = useState(false)
  const [correctedContent, setCorrectedContent] = useState(item.content)
  const [correctionCategory, setCorrectionCategory] = useState<ReviewCategory | ''>(item.reviewCategory ?? '')
  const [correctionNote, setCorrectionNote] = useState('')
  const [correctionSourceTitle, setCorrectionSourceTitle] = useState(item.sourceTitle ?? '')
  const [correctionSourceUrl, setCorrectionSourceUrl] = useState(item.sourceUrl ?? '')
  const [correcting, setCorrecting] = useState(false)
  const [correctionMessage, setCorrectionMessage] = useState('')
  const [showArchive, setShowArchive] = useState(false)
  const [archiveNote, setArchiveNote] = useState('')
  const [archiveConfirmed, setArchiveConfirmed] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  const correctionSourceUrlValid = !correctionSourceUrl.trim() || correctionSourceUrl.trim().startsWith('https://')

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

  const closeCorrection = () => {
    setShowCorrection(false)
    setCorrectedContent(item.content)
    setCorrectionCategory(item.reviewCategory ?? '')
    setCorrectionNote('')
    setCorrectionSourceTitle(item.sourceTitle ?? '')
    setCorrectionSourceUrl(item.sourceUrl ?? '')
    setCorrectionMessage('')
  }

  const submitCorrection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!correctionCategory) return
    setCorrecting(true)
    setCorrectionMessage('')
    try {
      await onCorrect(
        item.id,
        correctedContent.trim(),
        correctionCategory,
        correctionNote.trim(),
        correctionSourceTitle.trim(),
        correctionSourceUrl.trim(),
      )
    } catch (correctionError) {
      setCorrectionMessage(correctionError instanceof Error ? correctionError.message : 'Could not correct this fact.')
    } finally {
      setCorrecting(false)
    }
  }

  const closeArchive = () => {
    setShowArchive(false)
    setArchiveNote('')
    setArchiveConfirmed(false)
    setArchiveMessage('')
  }

  const submitArchive = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!archiveConfirmed) return
    setArchiving(true)
    setArchiveMessage('')
    try {
      await onArchive(item.id, archiveNote.trim())
    } catch (archiveError) {
      setArchiveMessage(archiveError instanceof Error ? archiveError.message : 'Could not archive this fact.')
    } finally {
      setArchiving(false)
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

      {(item.status === 'active' || item.status === 'needs_update') && (
        <div className="mt-4 rounded-xl border border-[#8A244B]/25 bg-[#8A244B]/5 p-3">
          {!showCorrection ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">Is this fact incorrect?</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Replace it with corrected knowledge while preserving the original in history.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCorrection(true)}
                className="min-h-11 shrink-0 rounded-lg bg-[#8A244B] px-4 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98]"
              >
                Correct fact
              </button>
            </div>
          ) : (
            <form onSubmit={submitCorrection} className="space-y-3">
              <div>
                <p className="font-bold text-slate-800">Correct fact #{item.id}</p>
                <p className="mt-0.5 text-sm text-slate-600">
                  Saving creates a new active fact and keeps this version as replaced history.
                </p>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Correct information
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  rows={4}
                  value={correctedContent}
                  disabled={correcting}
                  onChange={event => {
                    setCorrectedContent(event.target.value)
                    setCorrectionMessage('')
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal leading-6 outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Review category
                <select
                  required
                  value={correctionCategory}
                  disabled={correcting}
                  onChange={event => {
                    setCorrectionCategory(event.target.value as ReviewCategory | '')
                    setCorrectionMessage('')
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
              <label className="block text-sm font-semibold text-slate-700">
                Reason for correction
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                  value={correctionNote}
                  disabled={correcting}
                  placeholder="For example: Updated from the current official notice."
                  onChange={event => {
                    setCorrectionNote(event.target.value)
                    setCorrectionMessage('')
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal leading-6 outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Source label
                  <input
                    required
                    minLength={3}
                    maxLength={200}
                    value={correctionSourceTitle}
                    disabled={correcting}
                    placeholder="Example: ULM Registrar website"
                    onChange={event => {
                      setCorrectionSourceTitle(event.target.value)
                      setCorrectionMessage('')
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-700">
                  Source URL <span className="font-normal text-slate-500">(optional, HTTPS only)</span>
                  <input
                    type="url"
                    pattern="https://.*"
                    maxLength={2000}
                    value={correctionSourceUrl}
                    disabled={correcting}
                    placeholder="https://www.ulm.edu/..."
                    onChange={event => {
                      setCorrectionSourceUrl(event.target.value)
                      setCorrectionMessage('')
                    }}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal outline-none transition focus:border-[#8A244B] focus:ring-2 focus:ring-[#8A244B]/20 disabled:opacity-60"
                  />
                </label>
              </div>
              {correctionMessage && (
                <p role="alert" className="text-sm font-medium text-red-700">{correctionMessage}</p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCorrection}
                  disabled={correcting}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correcting || !correctionCategory || correctedContent.trim().length < 5 || correctionNote.trim().length < 3 || correctionSourceTitle.trim().length < 3 || !correctionSourceUrlValid}
                  className="min-h-11 rounded-lg bg-[#8A244B] px-4 py-2 font-bold text-white transition hover:bg-[#711d3e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {correcting ? 'Saving correction…' : 'Save corrected fact'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {(item.status === 'active' || item.status === 'needs_update') && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          {!showArchive ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-red-900">Remove this fact from Hawkbot?</p>
                <p className="mt-0.5 text-sm text-red-800">
                  Archive it when the information should no longer be used and does not need a replacement.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowArchive(true)}
                className="min-h-11 shrink-0 rounded-lg border-2 border-red-700 bg-white px-4 py-2 font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
              >
                Archive fact
              </button>
            </div>
          ) : (
            <form onSubmit={submitArchive} className="space-y-3">
              <div>
                <p className="font-bold text-red-900">Archive fact #{item.id}</p>
                <p className="mt-0.5 text-sm text-red-800">
                  The fact will remain in admin history, but Hawkbot will stop using it in answers.
                </p>
              </div>
              <label className="block text-sm font-semibold text-red-900">
                Reason for archiving
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={2}
                  value={archiveNote}
                  disabled={archiving}
                  placeholder="For example: This service is no longer offered."
                  onChange={event => {
                    setArchiveNote(event.target.value)
                    setArchiveMessage('')
                  }}
                  className="mt-1 w-full rounded-lg border border-red-300 bg-white px-3 py-2 font-normal leading-6 text-slate-800 outline-none transition focus:border-red-600 focus:ring-2 focus:ring-red-600/20 disabled:opacity-60"
                />
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-200 bg-white p-3 text-sm text-red-900">
                <input
                  type="checkbox"
                  checked={archiveConfirmed}
                  disabled={archiving}
                  onChange={event => {
                    setArchiveConfirmed(event.target.checked)
                    setArchiveMessage('')
                  }}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-red-700"
                />
                <span>I understand that Hawkbot will no longer use this fact in its answers.</span>
              </label>
              {archiveMessage && (
                <p role="alert" className="text-sm font-medium text-red-700">{archiveMessage}</p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeArchive}
                  disabled={archiving}
                  className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 font-bold text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={archiving || !archiveConfirmed || archiveNote.trim().length < 3}
                  className="min-h-11 rounded-lg bg-red-700 px-4 py-2 font-bold text-white transition hover:bg-red-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {archiving ? 'Archiving…' : 'Confirm archive'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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

      {(item.status === 'active' || item.status === 'needs_update') && (
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
      )}

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

      {(item.sourceTitle || item.sourceUrl) && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <p className="font-bold text-slate-900">Official source</p>
          <p className="mt-1">{item.sourceTitle || 'Official source'}</p>
          {item.sourceUrl && (
            <a
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-10 items-center font-semibold text-[#8A244B] underline decoration-[#8A244B]/40 underline-offset-4 hover:decoration-[#8A244B]"
            >
              Open source
            </a>
          )}
        </div>
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

      {item.status === 'archived' && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-bold">Archived knowledge</p>
          <p className="mt-1">This fact is preserved for history but is no longer available to Hawkbot's answers.</p>
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
  const [actionMessage, setActionMessage] = useState('')

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

  const correctKnowledge = async (
    knowledgeId: number,
    content: string,
    reviewCategory: ReviewCategory,
    note: string,
    sourceTitle: string,
    sourceUrl: string,
  ) => {
    setActionMessage('')
    const result = await correctAdminKnowledge(knowledgeId, {
      content,
      reviewCategory,
      note,
      sourceTitle,
      sourceUrl,
    })
    setActionMessage(`Fact #${knowledgeId} was corrected. Replacement fact #${result.replacement.id} is now active.`)
    await loadKnowledge()
  }

  const archiveKnowledge = async (knowledgeId: number, note: string) => {
    setActionMessage('')
    await archiveAdminKnowledge(knowledgeId, note)
    setActionMessage(`Fact #${knowledgeId} was archived and removed from Hawkbot answers.`)
    await loadKnowledge()
  }

  const createKnowledge = async (knowledge: {
    content: string
    reviewCategory: ReviewCategory
    sourceTitle: string
    sourceUrl: string
  }) => {
    setActionMessage('')
    const result = await createAdminKnowledge(knowledge)
    setActionMessage(`Fact #${result.created.id} was added and is now available to Hawkbot.`)
    await loadKnowledge()
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

        <AddKnowledgePanel onCreate={createKnowledge} />

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
              placeholder="Try library, tutoring, or a source name…"
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

        {actionMessage && (
          <div role="status" className="mt-4 flex items-start justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <div>
              <p className="font-bold">Knowledge updated</p>
              <p className="mt-1 text-sm">{actionMessage}</p>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage('')}
              aria-label="Dismiss success message"
              className="min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100"
            >
              Dismiss
            </button>
          </div>
        )}

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
                onArchive={archiveKnowledge}
                onCategoryUpdate={updateReviewCategory}
                onCorrect={correctKnowledge}
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
