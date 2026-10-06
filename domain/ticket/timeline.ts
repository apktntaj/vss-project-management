import type { TicketActivity, TicketComment } from './types'

export type TicketTimelineItem =
  | ({ type: 'COMMENT' } & TicketComment)
  | ({ type: 'ACTIVITY' } & TicketActivity)

/** Orders immutable timeline entries chronologically, with a stable ID tie-breaker. */
export function compareTicketTimeline(left: TicketTimelineItem, right: TicketTimelineItem) {
  const leftTime = left.type === 'COMMENT' ? left.createdAt : left.occurredAt
  const rightTime = right.type === 'COMMENT' ? right.createdAt : right.occurredAt
  return leftTime.localeCompare(rightTime) || left.id.localeCompare(right.id)
}

export function mergeTicketTimeline(comments: TicketComment[], activities: TicketActivity[]) {
  return [
    ...comments.map((comment) => ({ ...comment, type: 'COMMENT' as const })),
    ...activities.map((activity) => ({ ...activity, type: 'ACTIVITY' as const })),
  ].sort(compareTicketTimeline)
}
