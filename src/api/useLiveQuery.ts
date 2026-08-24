import { useEffect, useRef, useState } from 'react';
import { subscribeToChanges } from './events';

// dexie-react-hooksのuseLiveQueryと同じ使い方ができる置き換えフック。
// 依存配列が変わったとき、およびサーバーから変更通知(SSE)を受け取ったときに再取得する。
export function useLiveQuery<T>(queryFn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  const queryRef = useRef(queryFn);
  queryRef.current = queryFn;

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      Promise.resolve(queryRef.current())
        .then((result) => {
          if (!cancelled) setValue(result);
        })
        .catch((err) => {
          console.error('useLiveQuery error:', err);
        });
    };
    run();
    const unsubscribe = subscribeToChanges(run);
    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}
