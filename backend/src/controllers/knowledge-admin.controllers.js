import {
  listKnowledgeForAdmin,
  queueKnowledgeReview,
  updateKnowledgeReviewCategory,
} from "../services/knowledge-admin.services.js";
import {
  archiveKnowledgeForAdmin,
  correctKnowledgeForAdmin,
} from "../services/knowledge-admin-management.services.js";

export async function getKnowledgeForAdmin(req, res, next) {
  try {
    const result = await listKnowledgeForAdmin({
      status: req.query.status || "all",
      search: req.query.search || "",
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function editKnowledgeReviewCategory(req, res, next) {
  try {
    const result = await updateKnowledgeReviewCategory(
      req.params.knowledgeId,
      req.body.reviewCategory,
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function requestKnowledgeReview(req, res, next) {
  try {
    const result = await queueKnowledgeReview(req.params.knowledgeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function correctKnowledge(req, res, next) {
  try {
    const result = await correctKnowledgeForAdmin({
      knowledgeId: req.params.knowledgeId,
      adminUserId: req.user.id,
      content: req.body.content,
      reviewCategory: req.body.reviewCategory,
      note: req.body.note,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function archiveKnowledge(req, res, next) {
  try {
    const result = await archiveKnowledgeForAdmin({
      knowledgeId: req.params.knowledgeId,
      adminUserId: req.user.id,
      note: req.body.note,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
