import {
  listKnowledgeForAdmin,
  queueKnowledgeReview,
  updateKnowledgeReviewCategory,
} from "../services/knowledge-admin.services.js";

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
