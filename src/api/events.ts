// サーバーからのSSE(Server-Sent Events)を購読し、他の端末でのデータ変更を検知する。

type Listener = () => void;

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function connect() {
  if (source) return;
  source = new EventSource('/api/events');
  source.onmessage = (ev) => {
    if (ev.data === 'changed') {
      listeners.forEach((l) => l());
    }
  };
  source.onerror = () => {
    source?.close();
    source = null;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 2000);
  };
}

export function subscribeToChanges(listener: Listener): () => void {
  connect();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
