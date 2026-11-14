/** Shared reconnect lifecycle for browser and React Native notification sockets. */
export function createNotificationStream(options: {
  createSocket: () => WebSocket | Promise<WebSocket>;
  onOpen: () => void;
  onMessage: (data: unknown) => void;
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
    timer = setTimeout(connect, Math.min(1000 * 2 ** attempts++, 30_000));
  };
  async function connect() {
    if (stopped || denied || socket || pending) return;
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
        options.onOpen();
      };
      current.onmessage = ({ data }) => {
        if (!stopped && socket === current) options.onMessage(data);
      };
      current.onclose = ({ code }) => {
        if (stopped || socket !== current) return;
        socket = null;
        if (code === 1008) denied = true;
        else schedule();
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
