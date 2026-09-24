'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { rateStore } from '@/lib/client';

export function useRateLimit() {
  const state = useSyncExternalStore(rateStore.subscribe, rateStore.get, rateStore.get);
  const [now, setNow] = useState(() => Date.now());
  const waitingS = Math.max(0, Math.ceil(((state.waitingUntil ?? 0) - now) / 1000));

  useEffect(() => {
    if (!state.waitingUntil || state.waitingUntil < Date.now()) return;
    const until = state.waitingUntil;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= until) clearInterval(id);
    }, 250);
    return () => clearInterval(id);
  }, [state.waitingUntil]);

  return { ...state, waitingS };
}

export function RateLimitBadge() {
  const { waitingS } = useRateLimit();
  if (!waitingS) return null;
  return (
    <div
      className="rounded-md border border-warn/50 bg-warn/10 px-2 py-1 font-mono text-xs text-warn"
      title="AI Gateway returned 429; requests resume after its retry-after delay"
    >
      rate limited, resuming in {waitingS}s
    </div>
  );
}
