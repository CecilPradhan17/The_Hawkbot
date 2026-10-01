import express from "express";
import { getKnowledgeForAdmin } from "../controllers/knowledge-admin.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireHoursAdmin } from "../middleware/hoursAdmin.middleware.js";

const router = express.Router();

router.use(requireAuth, requireHoursAdmin);
router.get("/", getKnowledgeForAdmin);

export default router;
