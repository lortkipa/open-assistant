// Live updates for a user's open apps (GET /agents/events). In memory, so enough for one server process.

export type Event = { type: string; [key: string]: unknown }

const listeners = new Map<string, Set<(event: Event) => void>>()

export function subscribe(userId: string, listener: (event: Event) => void) {
  let set = listeners.get(userId)
  if (!set) listeners.set(userId, (set = new Set()))
  set.add(listener)
  return () => {
    set.delete(listener)
    if (!set.size) listeners.delete(userId)
  }
}

export function publish(userId: string, event: Event) {
  for (const listener of listeners.get(userId) ?? []) listener(event)
}
