import express from "express";
import { extractHoursDocument } from "../controllers/hours-extraction.controllers.js";
import {
  addFacility,
  editFacility,
  getCurrentSchedule,
  getFacilities,
  getHoursAdminAccess,
  previewHoursSchedule,
  publishHoursSchedule,
  removeFacility,
  validateHoursSchedule,
} from "../controllers/hours-admin.controllers.js";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireHoursAdmin } from "../middleware/hoursAdmin.middleware.js";
import { uploadScheduleDocument } from "../middleware/hoursUpload.middleware.js";

const router = express.Router();

// Authentication and owner authorization apply to every administration route.
router.use(requireAuth, requireHoursAdmin);

router.get("/access", getHoursAdminAccess);
router.get("/facilities", getFacilities);
router.post("/facilities", addFacility);
router.patch("/facilities/:facilityId", editFacility);
router.delete("/facilities/:facilityId", removeFacility);
router.get("/facilities/:facilityId/schedule", getCurrentSchedule);
router.post("/extract", uploadScheduleDocument, extractHoursDocument);
router.post("/validate", validateHoursSchedule);
router.post("/preview", previewHoursSchedule);
router.post("/publish", publishHoursSchedule);

export default router;
