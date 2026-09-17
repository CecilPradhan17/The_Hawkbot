import { extractSchedule } from "../services/hours-extraction.services.js";

export async function extractHoursDocument(req, res, next) {
  try {
    const proposal = await extractSchedule(req.file);
    res.status(200).json(proposal);
  } catch (error) {
    next(error);
  }
}

