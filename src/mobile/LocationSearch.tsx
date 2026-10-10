import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronRight, LocateFixed, MapPin, Search } from 'lucide-react';
import { getCurrentAir, searchStations, type StationOption } from '../services/airQuality';

export function LocationSearch({ location, onSelect, onLocate, locating }: { location: string; onSelect: (station: StationOption) => void; onLocate: () => void; locating: boolean }) {
  const [query, setQuery] = useState('');
  const [stations, setStations] = useState<StationOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [lookingUp, setLookingUp] = useState(false);
  const lookupRequest = useRef<AbortController | null>(null);
  useEffect(() => () => lookupRequest.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    setStations([]); setError(''); setLoading(true);
    const timer = setTimeout(() => {
      void searchStations(query.trim() || location, controller.signal).then(value => { if (!controller.signal.aborted) setStations(value); })
        .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Station search is unavailable.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, location, retry]);
  const lookupCity = async () => {
    if (lookingUp) return;
    const city = query.trim() || location;
    const controller = new AbortController(); lookupRequest.current = controller;
    setLookingUp(true); setError('');
    try {
      const reading = await getCurrentAir({ ageGroup: 'prefer', health: [], other: '', location: city, language: 'en', guest: true }, controller.signal);
      if (!controller.signal.aborted) onSelect({ name: reading.station || city, stationId: reading.stationId || '', coordinates: reading.coordinates?.lat != null && reading.coordinates?.lon != null ? { lat: reading.coordinates.lat, lon: reading.coordinates.lon } : null, aqi: reading.aqi ?? null });
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'City lookup is unavailable.'); }
    finally { if (!controller.signal.aborted) setLookingUp(false); }
  };
  return <><p className="body-copy">Search Malaysian monitoring stations. Device coordinates are sent to the backend to find a station and are kept only for this session.</p>
    <label className="location-search"><Search size={18}/><input aria-label="Search locations" disabled={lookingUp} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a Malaysian city…"/></label>
    <button className="locate-button" disabled={locating} onClick={onLocate}><LocateFixed size={18}/>{locating ? 'Finding a station…' : 'Use device location'}<ArrowRight size={17}/></button>
    {loading && <p className="body-copy" role="status">Searching stations…</p>}
    {error && <div className="live-notice" role="alert"><p>{error}</p><button className="text-button" onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
    <div className="city-options">{stations.map(station => <button key={station.stationId} onClick={() => onSelect(station)}><MapPin size={18}/><span><strong>{station.name}</strong><small>WAQI monitoring station · AQI {station.aqi ?? 'unavailable'}</small></span>{location === station.name ? <Check size={18}/> : <ChevronRight size={17}/>}</button>)}</div>
    {!loading && !stations.length && <><p className="body-copy">Station search returned no matches. You can look up a city’s reading directly.</p><button className="button secondary full" disabled={lookingUp || locating || (query.trim() || location).length < 2} onClick={() => { void lookupCity(); }}>{lookingUp ? 'Looking up city…' : `Use ${query.trim() || location}`}<ArrowRight size={17}/></button></>}
  </>;
}
