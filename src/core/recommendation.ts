import type { Activity, AQReading, Assessment, Profile } from './types';

/** Intentionally unconfigured until an authoritative policy and provider scale are supplied. */
export type SafetyPolicy = { maxAgeMinutes?: number; categories: Record<string, 'GO' | 'CAUTION' | 'AVOID'>; highIntensity: Activity[]; vulnerableGroups: string[] };
export const defaultPolicy: SafetyPolicy = { maxAgeMinutes: 120, categories: {}, highIntensity: ['football','jogging','cycling','exercise'], vulnerableGroups: ['under-18','under-5','5-17','65-plus'] };
export function assessOutdoor(reading: AQReading | null, profile: Profile, activity: Activity, now = Date.now(), policy = defaultPolicy): Assessment {
  const limitations: string[] = [];
  if (!reading) return { decision:'UNABLE', reasonCodes:['data-unavailable'], summary:'I can’t confidently assess conditions right now.', rationale:'Air-quality data is unavailable for this location.', alternative:'Try again later or check local official guidance.', limitations:['No air-quality reading'] };
  if (reading.demo) limitations.push('Demo sample, not a live measurement');
  if (!reading.category || !policy.categories[reading.category]) limitations.push('AQI category or safety policy is not configured');
  if (!reading.observedAt || !Number.isFinite(Date.parse(reading.observedAt))) limitations.push('Observation time unavailable');
  else if (now - Date.parse(reading.observedAt) > (policy.maxAgeMinutes ?? 120)*60000) limitations.push('Reading may be out of date');
  if (reading.aqi == null && reading.pm25 == null && reading.pm10 == null) limitations.push('No AQI or particulate measurements');
  if (limitations.length) return { decision:'UNABLE',reasonCodes:limitations.map(()=> 'insufficient-data'),summary:'I can’t confidently determine whether this is a good time to go out.',rationale:'The reading or the safety rules needed to interpret it are incomplete.',alternative:'Check an official local source and consider moving exercise indoors.',reading,limitations };
  const base = policy.categories[reading.category!]!;
  const relevantHealth = ['pregnant','asthma','lung','heart'];
  const sensitive = policy.vulnerableGroups.includes(profile.ageGroup) || profile.health.some(item=>relevantHealth.includes(item)) || Boolean(profile.other.trim());
  let decision = base;
  const reasonCodes = [`category:${reading.category}`];
  if (base === 'GO' && (sensitive || (policy.highIntensity.includes(activity) && reading.aqi! >= 50))) { decision = 'CAUTION'; reasonCodes.push(sensitive?'profile-caution':'intensity-caution'); }
  if (limitations.length) decision = 'CAUTION';
  return { decision,reasonCodes,summary: decision === 'GO' ? 'Conditions look suitable for this activity under the configured guidance.' : decision === 'AVOID' ? 'Consider postponing outdoor activity under the configured guidance.' : 'Take extra care and consider adjusting your plans.',rationale:`${reading.category} conditions${reading.aqi == null?'':` (AQI ${reading.aqi})`} for ${activity}. ${sensitive?'Your disclosed profile suggests taking extra care.':''}`,alternative: decision === 'GO' ? 'Take water and take a break if you feel unwell.' : 'Try an indoor workout or postpone until conditions improve.',reading,limitations };
}
