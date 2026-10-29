export function createRealtimeSubscriptions() {
  const listeners = new Map();
  let socket = null;

  function detachCurrent() {
    if (socket) {
      for (const [eventName, handlers] of listeners) handlers.forEach((handler) => socket.off(eventName, handler));
    }
    socket = null;
  }

  return {
    subscribe(eventName, handler) {
      if (!listeners.has(eventName)) listeners.set(eventName, new Set());
      listeners.get(eventName).add(handler);
      socket?.on(eventName, handler);
      return () => {
        listeners.get(eventName)?.delete(handler);
        socket?.off(eventName, handler);
      };
    },
    attach(nextSocket) {
      detachCurrent();
      socket = nextSocket;
      for (const [eventName, handlers] of listeners) handlers.forEach((handler) => socket.on(eventName, handler));
    },
    detach(targetSocket) {
      if (!targetSocket || targetSocket === socket) detachCurrent();
    },
    publish(eventName, payload) {
      (listeners.get(eventName) || []).forEach((handler) => handler(payload));
    },
  };
}
