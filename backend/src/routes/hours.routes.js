import express from "express";
import { extractHoursDocument } from "../controllers/hours-extraction.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireHoursAdmin } from "../middleware/hoursAdmin.middleware.js";
import { uploadScheduleDocument } from "../middleware/hoursUpload.middleware.js";

const router = express.Router();

router.post(
  "/extract",
  requireAuth,
  requireHoursAdmin,
  uploadScheduleDocument,
  extractHoursDocument
);

export default router;

