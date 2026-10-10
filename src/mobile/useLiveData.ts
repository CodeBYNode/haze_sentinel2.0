import { useEffect, useState } from 'react';
import type { AQReading, Profile } from '../core/types';
import { getCurrentAir, getRefreshIntervals } from '../services/airQuality';
import { getNews, type NewsFeed } from '../services/news';

export function useLiveData(profile: Profile, enabled: boolean) {
  const [reading, setReading] = useState<AQReading | null>(null);
  const [airError, setAirError] = useState('');
  const [airLoading, setAirLoading] = useState(false);
  const [news, setNews] = useState<NewsFeed | null>(null);
  const [newsError, setNewsError] = useState('');
  const [newsLoading, setNewsLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const [newsRevision, setNewsRevision] = useState(0);
  const [intervals, setIntervals] = useState({ hazeRefreshIntervalMinutes: 10, newsRefreshIntervalHours: 3 });

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    void getRefreshIntervals(controller.signal).then(value => { if (!controller.signal.aborted) setIntervals(value); });
    return () => controller.abort();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let request: AbortController | undefined;
    setReading(null);
    const refresh = async () => {
      request?.abort();
      const controller = new AbortController(); request = controller;
      setAirLoading(true); setAirError('');
      try {
        const value = await getCurrentAir(profile, controller.signal);
        if (active && !controller.signal.aborted) setReading(value);
      } catch (error) {
        if (active && !controller.signal.aborted) { setReading(null); setAirError(error instanceof Error ? error.message : 'Air quality is unavailable.'); }
      } finally { if (active && !controller.signal.aborted) setAirLoading(false); }
    };
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, intervals.hazeRefreshIntervalMinutes * 60000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { active = false; request?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [enabled, profile.location, profile.stationId, profile.locationCoords?.lat, profile.locationCoords?.lon, revision, intervals.hazeRefreshIntervalMinutes]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let request: AbortController | undefined;
    const refresh = async () => {
      request?.abort();
      const controller = new AbortController(); request = controller;
      setNewsLoading(true); setNewsError('');
      try { const value = await getNews(controller.signal); if (active && !controller.signal.aborted) setNews(value); }
      catch (error) { if (active && !controller.signal.aborted) setNewsError(error instanceof Error ? error.message : 'News is unavailable.'); }
      finally { if (active && !controller.signal.aborted) setNewsLoading(false); }
    };
    void refresh();
    const visibleRefresh = () => { if (document.visibilityState === 'visible') void refresh(); };
    const timer = window.setInterval(visibleRefresh, Math.min(15, Math.max(5, intervals.newsRefreshIntervalHours * 60)) * 60000);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => { active = false; request?.abort(); window.clearInterval(timer); document.removeEventListener('visibilitychange', visibleRefresh); };
  }, [enabled, newsRevision, intervals.newsRefreshIntervalHours]);

  return { reading, airError, airLoading, news, newsError, newsLoading, refreshAir: () => setRevision(n => n + 1), refreshNews: () => setNewsRevision(n => n + 1) };
}
