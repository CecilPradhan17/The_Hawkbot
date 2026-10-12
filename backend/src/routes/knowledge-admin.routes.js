import express from "express";
import {
  archiveKnowledge,
  correctKnowledge,
  createKnowledge,
  editKnowledgeReviewCategory,
  getKnowledgeForAdmin,
  requestKnowledgeReview,
} from "../controllers/knowledge-admin.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireHoursAdmin } from "../middleware/hoursAdmin.middleware.js";

const router = express.Router();

router.use(requireAuth, requireHoursAdmin);
router.get("/", getKnowledgeForAdmin);
router.post("/", createKnowledge);
router.patch("/:knowledgeId/review-category", editKnowledgeReviewCategory);
router.post("/:knowledgeId/review", requestKnowledgeReview);
router.post("/:knowledgeId/correct", correctKnowledge);
router.post("/:knowledgeId/archive", archiveKnowledge);

export default router;
