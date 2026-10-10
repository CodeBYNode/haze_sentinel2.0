import { useEffect, useState } from 'react';
import type { Plan } from '../ui/model';
import type { SpendingsResponse } from '../core/spendings';
import { getSpendings } from '../services/spendings';
import { getRefreshIntervals } from '../services/airQuality';

export function useSpendings(plans: Plan[], enabled: boolean) {
  const [result, setResult] = useState<{ key: string; data: SpendingsResponse } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [minutes, setMinutes] = useState(10);
  const key = JSON.stringify(plans);
  useEffect(() => {
    const controller = new AbortController();
    if (enabled) void getRefreshIntervals(controller.signal).then(value => { if (!controller.signal.aborted) setMinutes(value.hazeRefreshIntervalMinutes); });
    return () => controller.abort();
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const snapshot: Plan[] = JSON.parse(key);
    let request: AbortController | undefined;
    const refresh = async () => {
      request?.abort();
      const controller = new AbortController(); request = controller;
      // Clear previous quotes immediately; changed terms or failed refreshes must
      // never leave a stale recommendation available for a different booking.
      setResult(null); setError('');
      if (!snapshot.some(plan => plan.booking)) { setLoading(false); return; }
      setLoading(true);
      try { const data = await getSpendings(snapshot, controller.signal); if (!controller.signal.aborted) setResult({ key, data }); }
      catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Booking assessment is unavailable.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, minutes * 60000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { request?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [key, enabled, revision, minutes]);
  return { data: result?.key === key ? result.data : null, loading, error, refresh: () => setRevision(value => value + 1) };
}
