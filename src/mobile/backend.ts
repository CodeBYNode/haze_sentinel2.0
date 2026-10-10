import type { AQReading, Profile } from '../core/types';
import type { StationOption } from '../services/airQuality';
import type { UserProfile } from '../ui/model';

export function backendProfile(profile: UserProfile, station?: StationOption | null): Profile {
  const healthCodes: Record<string, string> = { Asthma: 'asthma', 'Respiratory sensitivity': 'lung', 'Heart condition': 'heart' };
  return {
    ageGroup: 'prefer', health: profile.conditions.flatMap(c => healthCodes[c] ? [healthCodes[c]] : []),
    other: '', location: profile.location, language: 'en', guest: true,
    ...(station?.name === profile.location ? { stationId: String(station.stationId), locationCoords: station.coordinates || undefined } : {}),
  };
}

export function waqiTone(value?: number | null) {
  return value == null ? '' : value <= 50 ? 'safe' : value <= 100 ? 'mild' : value <= 150 ? 'sensitive' : value <= 200 ? 'moderate' : value <= 300 ? 'severe' : 'hazardous';
}

export function observationState(value?: string | null, now = Date.now()) {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return 'Observation time unavailable';
  if (time > now + 5 * 60000) return 'Check provider timestamp';
  return now - time > 2 * 60 * 60000 ? 'Outdated observation' : 'Provider observation';
}

export function timestamp(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Unavailable';
  return new Intl.DateTimeFormat('en-MY', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(value)) + ' MYT';
}

export function forecastDays(reading: AQReading | null) {
  const rows = Object.entries(reading?.forecast || {}).flatMap(([pollutant, days]) =>
    ['pm25', 'pm10', 'o3', 'uvi'].includes(pollutant) && Array.isArray(days)
      ? days.filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.day) && [day.avg, day.min, day.max].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)).map(day => ({ ...day, pollutant }))
      : []);
  return rows.sort((a, b) => a.day.localeCompare(b.day) || a.pollutant.localeCompare(b.pollutant));
}

export function isPlanningRequest(text: string) {
  return /reschedul|replan|(?:move|change|find|better|indoor).*(?:plan|schedule|activit|time|venue)|(?:plan|schedule).*(?:move|change|indoor)/i.test(text);
}

export function backendHistory(messages: { role: 'user' | 'assistant'; text: string; mode?: 'live' | 'demo'; location?: string; error?: boolean }[], location: string) {
  return messages.filter(m => !m.error && m.mode !== 'demo' && (!m.location || m.location === location)).slice(-12).map(m => ({ role: m.role, content: m.text }));
}

export function todayInMalaysia(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
