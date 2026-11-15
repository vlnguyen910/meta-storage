import { createNotificationStream } from "@metastorage/api-client";
import { afterEach, expect, it, vi } from "vitest";

afterEach(() => vi.useRealTimers());

function socket() {
  return { close: vi.fn() } as unknown as WebSocket;
}

it("reconnects once after a network close and never retries an authorization denial", async () => {
  vi.useFakeTimers();
  const sockets = [socket(), socket()];
  const createSocket = vi.fn(() => sockets[createSocket.mock.calls.length - 1] as WebSocket);
  const onOpen = vi.fn();
  const onStatusChange = vi.fn();
  const stream = createNotificationStream({
    createSocket,
    onOpen,
    onStatusChange,
    onMessage: vi.fn(),
  });
  await stream.connect();
  sockets[0]?.onopen?.(new Event("open"));
  expect(onOpen).toHaveBeenCalledOnce();
  sockets[0]?.onclose?.(new CloseEvent("close", { code: 1006 }));
  expect(onStatusChange).toHaveBeenLastCalledWith("reconnecting");
  await vi.advanceTimersByTimeAsync(1000);
  expect(createSocket).toHaveBeenCalledTimes(2);
  sockets[1]?.onclose?.(new CloseEvent("close", { code: 1008 }));
  expect(onStatusChange).toHaveBeenLastCalledWith("unavailable");
  await vi.advanceTimersByTimeAsync(60000);
  await stream.connect();
  expect(createSocket).toHaveBeenCalledTimes(2);
  stream.dispose();
});

it("disposes sockets created asynchronously and cancels pending reconnects", async () => {
  vi.useFakeTimers();
  const current = socket();
  let resolve: (value: WebSocket) => void = () => undefined;
  const onOpen = vi.fn();
  const createSocket = vi.fn(
    () =>
      new Promise<WebSocket>((done) => {
        resolve = done;
      }),
  );
  const stream = createNotificationStream({ createSocket, onOpen, onMessage: vi.fn() });
  const connecting = stream.connect();
  stream.dispose();
  resolve(current);
  await connecting;
  expect(current.close).toHaveBeenCalledOnce();
  expect(onOpen).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(60000);
  expect(createSocket).toHaveBeenCalledOnce();

  const connected = socket();
  const createConnectedSocket = vi.fn(() => connected);
  const retrying = createNotificationStream({
    createSocket: createConnectedSocket,
    onOpen,
    onMessage: vi.fn(),
  });
  await retrying.connect();
  connected.onclose?.(new CloseEvent("close", { code: 1006 }));
  retrying.dispose();
  await vi.advanceTimersByTimeAsync(60000);
  expect(createConnectedSocket).toHaveBeenCalledOnce();
});
