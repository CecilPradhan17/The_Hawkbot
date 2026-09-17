import { DateTime } from "luxon";
import { listFacilities } from "../services/hours-admin.services.js";
import { createFacility, publishSchedule } from "../services/hours-publication.services.js";
import { getPublishedSchedule } from "../services/hours-repository.services.js";
import { answerHoursQuestion } from "../services/hours-resolution.services.js";
import { CAMPUS_TIME_ZONE, validateSchedule } from "../services/hours-validation.services.js";

export const getHoursAdminAccess = (req, res) => res.json({ authorized: true });

export async function getFacilities(req, res, next) {
  try { res.json(await listFacilities()); }
  catch (error) { next(error); }
}

export async function addFacility(req, res, next) {
  try { res.status(201).json(await createFacility(req.body)); }
  catch (error) { next(error); }
}

export async function getCurrentSchedule(req, res, next) {
  try {
    const schedule = await getPublishedSchedule(Number(req.params.facilityId));
    if (!schedule) return res.status(404).json({ message: "No published schedule found" });
    res.json(schedule);
  } catch (error) { next(error); }
}

export function validateHoursSchedule(req, res) {
  res.json(validateSchedule(req.body));
}

export function previewHoursSchedule(req, res) {
  const { schedule, facilityName, date } = req.body;
  const validation = validateSchedule(schedule);
  if (!validation.valid) return res.status(400).json(validation);
  const targetDate = DateTime.fromISO(date, { zone: CAMPUS_TIME_ZONE });
  if (!targetDate.isValid) return res.status(400).json({ message: "Preview date must be YYYY-MM-DD" });
  const result = answerHoursQuestion(
    { ...schedule, facilityName, publishedAt: new Date() },
    { facilityId: schedule.facilityId, facilityName, intent: "hours_on_date", targetDate }
  );
  res.json(result);
}

export async function publishHoursSchedule(req, res, next) {
  try { res.status(201).json(await publishSchedule(req.body)); }
  catch (error) { next(error); }
}

