/** Shared reconnect lifecycle for browser and React Native notification sockets. */
export function createNotificationStream(options: {
  createSocket: () => WebSocket | Promise<WebSocket>;
  onOpen: () => void;
  onMessage: (data: unknown) => void;
  onStatusChange?: (status: "connecting" | "connected" | "reconnecting" | "unavailable") => void;
}) {
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0;
  let pending = false;
  let stopped = false;
  let suspended = false;
  let denied = false;
  let attempts = 0;

  const schedule = () => {
    if (stopped || suspended || denied) return;
    clearTimeout(timer);
    options.onStatusChange?.("reconnecting");
    timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30_000));
  };
  async function connect() {
    if (stopped || socket || pending) return;
    if (denied) {
      options.onStatusChange?.("unavailable");
      return;
    }
    options.onStatusChange?.(attempts ? "reconnecting" : "connecting");
    suspended = false;
    clearTimeout(timer);
    const version = generation;
    pending = true;
    try {
      const current = await options.createSocket();
      if (stopped || suspended || version !== generation) {
        current.close();
        return;
      }
      socket = current;
      current.onopen = () => {
        if (stopped || socket !== current) return;
        attempts = 0;
        options.onStatusChange?.("connected");
        options.onOpen();
      };
      current.onmessage = ({ data }) => {
        if (!stopped && socket === current) options.onMessage(data);
      };
      current.onclose = ({ code }) => {
        if (stopped || socket !== current) return;
        socket = null;
        if (code === 1008) {
          denied = true;
          options.onStatusChange?.("unavailable");
        } else schedule();
      };
      current.onerror = () => {}; // Close owns retries to avoid duplicate connections.
    } catch {
      if (version === generation) schedule();
    } finally {
      if (version === generation) pending = false;
    }
  }
  const disconnect = () => {
    suspended = true;
    generation++;
    pending = false;
    clearTimeout(timer);
    const current = socket;
    socket = null;
    current?.close();
  };
  return {
    connect,
    disconnect,
    dispose: () => {
      stopped = true;
      disconnect();
    },
  };
}
