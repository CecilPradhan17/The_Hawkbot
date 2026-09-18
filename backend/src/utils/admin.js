export const isAdminEmail = (email) => {
  const configuredEmail = (process.env.HOURS_ADMIN_EMAIL || "").trim().toLowerCase();
  return Boolean(configuredEmail && email?.trim().toLowerCase() === configuredEmail);
};
