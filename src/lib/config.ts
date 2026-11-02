/** Hard limits of the studio. */
export const MAX_RECORD_SECONDS = 60 * 60; // 1 hour per recording
export const KEEP_SECONDS = 6 * 60 * 60; // recordings are deleted 6 hours after they end
export const ABANDONED_SECONDS = 2 * 60 * 60; // a session that never started recording is dropped after 2 hours
