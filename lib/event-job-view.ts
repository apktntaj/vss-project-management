export type EventJobViews = Record<string, boolean>

export function getNextEventJobView(views: EventJobViews, eventId: string): EventJobViews {
  return { ...views, [eventId]: !views[eventId] }
}
