export const INACTIVITY_TIMEOUT_SECONDS = 90 * 60;
export const WARNING_THRESHOLD_SECONDS = 85 * 60;
export const PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS = 30 * 60;
export const PLATFORM_ADMIN_WARNING_THRESHOLD_SECONDS = 25 * 60;
export const COOKIE_NAME = "tf_last_activity";

/** Unknown roles keep the shorter timeout until the account is resolved. */
export function getSessionTimeouts(role: string | null | undefined) {
  const useAdminTimeout = !role || role === "platform_admin";
  return {
    inactivityTimeoutSeconds: useAdminTimeout
      ? PLATFORM_ADMIN_INACTIVITY_TIMEOUT_SECONDS
      : INACTIVITY_TIMEOUT_SECONDS,
    warningThresholdSeconds: useAdminTimeout
      ? PLATFORM_ADMIN_WARNING_THRESHOLD_SECONDS
      : WARNING_THRESHOLD_SECONDS,
  };
}
