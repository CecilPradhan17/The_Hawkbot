const adminEmail = () => (process.env.HOURS_ADMIN_EMAIL || "").trim().toLowerCase();

/**
 * Must run after requireAuth. Privileged access is checked against backend
 * configuration on every request, so it is never granted by frontend state.
 */
export function requireHoursAdmin(req, res, next) {
  const configuredEmail = adminEmail();
  if (!configuredEmail) {
    const error = new Error("Hours administration is not configured");
    error.status = 503;
    return next(error);
  }

  if (!req.user?.email || req.user.email.trim().toLowerCase() !== configuredEmail) {
    const error = new Error("Forbidden");
    error.status = 403;
    return next(error);
  }

  next();
}

