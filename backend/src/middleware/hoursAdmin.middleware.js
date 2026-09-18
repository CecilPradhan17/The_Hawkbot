import { isAdminEmail } from "../utils/admin.js";

/**
 * Must run after requireAuth. Privileged access is checked against backend
 * configuration on every request, so it is never granted by frontend state.
 */
export function requireHoursAdmin(req, res, next) {
  if (!(process.env.HOURS_ADMIN_EMAIL || "").trim()) {
    const error = new Error("Hours administration is not configured");
    error.status = 503;
    return next(error);
  }

  if (!isAdminEmail(req.user?.email)) {
    const error = new Error("Forbidden");
    error.status = 403;
    return next(error);
  }

  next();
}
