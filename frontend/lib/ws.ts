// Owner: Shardul. WebSocket client with auto-reconnect.
import type { TickMessage } from "./types";
export function connect(onTick: (m: TickMessage) => void) {
  let sock: WebSocket | null = null, stop = false;
  const open = () => {
    sock = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws");
    sock.onmessage = (e) => onTick(JSON.parse(e.data));
    sock.onclose = () => { if (!stop) setTimeout(open, 1000); };
  };
  open();
  return () => { stop = true; sock?.close(); };
}
