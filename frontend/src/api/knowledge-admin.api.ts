import { api } from './api'

export type KnowledgeStatus = 'active' | 'needs_update' | 'replaced'
export type KnowledgeStatusFilter = KnowledgeStatus | 'all'
export type ReviewCategory = 'stable' | 'yearly' | 'term' | 'frequent'

export interface AdminKnowledgeItem {
  id: number
  content: string
  rawContent: string | null
  status: KnowledgeStatus
  reviewCategory: ReviewCategory | null
  lastVerifiedAt: string | null
  reviewDueAt: string | null
  verificationRequestedAt: string | null
  sourcePostId: number | null
  sourceContent: string | null
  sourceType: string | null
  supersededById: number | null
  replacementContent: string | null
  latestVerificationStatus: string | null
  latestVerificationAt: string | null
  correctionStatus: string | null
  correctionQuestionPostId: number | null
}

export interface AdminKnowledgePage {
  items: AdminKnowledgeItem[]
  total: number
  limit: number
  offset: number
}

interface RawAdminKnowledgeItem {
  id: number
  content: string
  raw_content: string | null
  status: KnowledgeStatus
  review_category: ReviewCategory | null
  last_verified_at: string | null
  review_due_at: string | null
  verification_requested_at: string | null
  source_post_id: number | null
  source_content: string | null
  source_type: string | null
  superseded_by_id: number | null
  replacement_content: string | null
  latest_verification_status: string | null
  latest_verification_at: string | null
  correction_status: string | null
  correction_question_post_id: number | null
}

interface RawAdminKnowledgePage {
  items: RawAdminKnowledgeItem[]
  total: number
  limit: number
  offset: number
}

const normalizeItem = (item: RawAdminKnowledgeItem): AdminKnowledgeItem => ({
  id: item.id,
  content: item.content,
  rawContent: item.raw_content,
  status: item.status,
  reviewCategory: item.review_category,
  lastVerifiedAt: item.last_verified_at,
  reviewDueAt: item.review_due_at,
  verificationRequestedAt: item.verification_requested_at,
  sourcePostId: item.source_post_id,
  sourceContent: item.source_content,
  sourceType: item.source_type,
  supersededById: item.superseded_by_id,
  replacementContent: item.replacement_content,
  latestVerificationStatus: item.latest_verification_status,
  latestVerificationAt: item.latest_verification_at,
  correctionStatus: item.correction_status,
  correctionQuestionPostId: item.correction_question_post_id,
})

export async function getAdminKnowledge({
  status = 'all',
  limit = 50,
  offset = 0,
}: {
  status?: KnowledgeStatusFilter
  limit?: number
  offset?: number
} = {}): Promise<AdminKnowledgePage> {
  const query = new URLSearchParams({
    status,
    limit: String(limit),
    offset: String(offset),
  })
  const result = await api.get<RawAdminKnowledgePage>(`/knowledge/admin?${query}`)
  return { ...result, items: result.items.map(normalizeItem) }
}

export async function updateAdminKnowledgeReviewCategory(
  knowledgeId: number,
  reviewCategory: ReviewCategory,
): Promise<{ id: number; reviewCategory: ReviewCategory; reviewDueAt: string | null }> {
  const result = await api.patch<{
    id: number
    review_category: ReviewCategory
    review_due_at: string | null
  }>(`/knowledge/admin/${knowledgeId}/review-category`, { reviewCategory })

  return {
    id: result.id,
    reviewCategory: result.review_category,
    reviewDueAt: result.review_due_at,
  }
}
