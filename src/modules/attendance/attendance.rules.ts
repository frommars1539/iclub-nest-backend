/** Marking opens this many minutes before an activity starts. */
export const MARKING_OPENS_MINUTES_BEFORE = 20;

export interface ActivityWindow {
  startsAt: Date;
  endsAt: Date;
  status: 'SCHEDULED' | 'CANCELLED';
}

/**
 * TODO(you): return true only if attendance may be marked at `now`.
 * Rules:
 *  1. a CANCELLED activity can never be marked
 *  2. marking opens MARKING_OPENS_MINUTES_BEFORE minutes before startsAt
 *  3. there is no closing time here: late marking is allowed, and changes
 *     after endsAt are "amendments" handled by isAmendment() below
 * Hint: Date values are milliseconds since 1970, so
 *   startsAt.getTime() - MARKING_OPENS_MINUTES_BEFORE * 60_000
 * gives you the opening instant.
 */

export function isMarkingOpen(activity: ActivityWindow, now: Date): boolean {
    if (activity.status === 'CANCELLED') {
        return false;
    }

    const opensAt =
       activity.startsAt.getTime() - MARKING_OPENS_MINUTES_BEFORE * 60_000;

    return now.getTime() >= opensAt;
}

/** A change made after the activity has ended is an amendment (FR-033). */
export function isAmendment(activity: ActivityWindow, now: Date): boolean {
  return now.getTime() > activity.endsAt.getTime();
}