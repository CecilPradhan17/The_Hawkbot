import { listKnowledgeForAdmin } from "../services/knowledge-admin.services.js";

export async function getKnowledgeForAdmin(req, res, next) {
  try {
    const result = await listKnowledgeForAdmin({
      status: req.query.status || "all",
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}
