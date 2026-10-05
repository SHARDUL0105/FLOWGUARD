// WebSocket client with auto-reconnect. Returns a disposer.
import type { TickMessage } from "./types";
export function connect(onTick: (m: TickMessage) => void) {
  let sock: WebSocket | null = null, stop = false;
  const open = () => {
    try {
      sock = new WebSocket(process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws");
      sock.onmessage = (e) => { try { onTick(JSON.parse(e.data)); } catch { /* ignore bad frame */ } };
      sock.onclose = () => { if (!stop) setTimeout(open, 1000); };
      sock.onerror = () => sock?.close();
    } catch { if (!stop) setTimeout(open, 1500); }
  };
  open();
  return () => { stop = true; sock?.close(); };
}
