type EventListener = (event: {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}) => void;

const globalForSSE = globalThis as unknown as {
  sseListeners: Set<EventListener> | undefined;
};

const listeners = globalForSSE.sseListeners ?? new Set<EventListener>();
globalForSSE.sseListeners = listeners;

export function subscribeSSE(listener: EventListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function broadcastEvent(type: string, payload: Record<string, unknown>) {
  const event = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  listeners.forEach((fn) => {
    try {
      fn(event);
    } catch {
      // ignore closed stream
    }
  });
}
