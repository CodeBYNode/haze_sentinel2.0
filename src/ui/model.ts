import type { BookingDetails } from '../core/spendings';
export type Page = 'home' | 'schedule' | 'assistant' | 'profile' | 'login' | 'signup';
export type Severity = 'safe' | 'mild' | 'moderate' | 'severe' | 'hazardous';
export type Plan = {
  id: string; title: string; date: string; time: string; duration: number;
  booking?: BookingDetails;
  location: string; outdoor: boolean; api: number; fixed: boolean; kind: 'run' | 'class' | 'coffee' | 'cycle' | 'other';
};
export type Proposal = { id: string; time: string; date: string; location: string; outdoor: boolean; api: number; reason: string };
export type UserProfile = { name: string; email: string; location: string; conditions: string[]; notes: string; alerts: boolean; reminders: boolean; summary: boolean };
export const TODAY = '2026-10-10';
export const TOMORROW = '2026-10-11';
export const SAMPLE_TIME = '12:00 PM MYT';
export const locations = [
  { name: 'Kuala Lumpur', district: 'Klang Valley', api: 86, x: 62, y: 46, offset: 0 },
  { name: 'Petaling Jaya', district: 'Selangor', api: 112, x: 36, y: 57, offset: 26 },
  { name: 'Shah Alam', district: 'Selangor', api: 148, x: 15, y: 48, offset: 62 },
  { name: 'Batu Caves', district: 'Selangor', api: 64, x: 63, y: 18, offset: -22 },
  { name: 'Ampang', district: 'Selangor', api: 78, x: 86, y: 52, offset: -8 },
  { name: 'Subang Jaya', district: 'Selangor', api: 126, x: 29, y: 79, offset: 40 },
];
export const forecast = [
  { time: '12 PM', hour: 12, api: 86 }, { time: '1 PM', hour: 13, api: 112 },
  { time: '2 PM', hour: 14, api: 142 }, { time: '3 PM', hour: 15, api: 168 },
  { time: '4 PM', hour: 16, api: 182 }, { time: '5 PM', hour: 17, api: 164 },
  { time: '6 PM', hour: 18, api: 142 }, { time: '7 PM', hour: 19, api: 88 },
  { time: '8 PM', hour: 20, api: 68 }, { time: '9 PM', hour: 21, api: 54 },
];
export const initialPlans: Plan[] = [
  { id: 'walk', title: 'Morning walk', date: TODAY, time: '07:00', duration: 30, location: 'KLCC Park', outdoor: true, api: 42, fixed: false, kind: 'other' },
  { id: 'class', title: 'Design lecture', date: TODAY, time: '13:00', duration: 90, location: 'Taylor’s University', outdoor: false, api: 112, fixed: true, kind: 'class' },
  { id: 'run', title: 'Afternoon run', date: TODAY, time: '15:00', duration: 60, location: 'KLCC Park', outdoor: true, api: 168, fixed: false, kind: 'run' },
  { id: 'coffee', title: 'Coffee with Mei', date: TODAY, time: '17:00', duration: 60, location: 'VCR, Bangsar', outdoor: false, api: 164, fixed: false, kind: 'coffee' },
  { id: 'cycle', title: 'Evening cycling', date: TODAY, time: '18:00', duration: 60, location: 'Perdana Botanical Gardens', outdoor: true, api: 142, fixed: false, kind: 'cycle' },
  { id: 'study', title: 'Study session', date: TOMORROW, time: '10:00', duration: 120, location: 'Raja Tun Uda Library', outdoor: false, api: 54, fixed: false, kind: 'class' },
];
export const defaultProfile: UserProfile = { name: 'Alex Tan', email: 'alex.tan@example.com', location: 'Kuala Lumpur', conditions: [], notes: '', alerts: true, reminders: true, summary: false };
// Malaysian DOE API bands. These labels describe air quality, not personal safety.
// https://www.doe.gov.my/wp-content/uploads/2021/09/API_Calculation.pdf
export function severity(api: number): Severity { return api <= 50 ? 'safe' : api <= 100 ? 'mild' : api <= 200 ? 'moderate' : api <= 300 ? 'severe' : 'hazardous'; }
export const severityNames: Record<Severity, string> = { safe: 'Good', mild: 'Moderate', moderate: 'Unhealthy', severe: 'Very unhealthy', hazardous: 'Hazardous' };
export function timeLabel(value: string) { const [h, m] = value.split(':').map(Number); return (h % 12 || 12) + ':' + String(m).padStart(2, '0') + (h < 12 ? ' AM' : ' PM'); }
export function dateLabel(value: string, short = false) { return new Date(value + 'T12:00:00+08:00').toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', ...(short ? { day: 'numeric', month: 'short' } : { weekday: 'long', day: 'numeric', month: 'long' }) }); }
export function apiAt(date: string, time: string, location: string) {
  const hour = Number(time.split(':')[0]);
  if (date === TOMORROW && hour < 10) return 42;
  if (date !== TODAY) return 54;
  const offset = locations.find(l => l.name === location)?.offset || 0;
  const value = forecast.find(f => f.hour === hour)?.api ?? (hour < 12 ? 42 : 54);
  return Math.max(18, value + offset);
}
export function affectedPlans(plans: Plan[]) { return plans.filter(p => p.outdoor && !p.fixed && p.api > 100 && (p.date > TODAY || p.date === TODAY && p.time >= '12:00')); }
export function proposeChanges(plans: Plan[], indoor = false, onlyIds?: string[]): Proposal[] {
  const affected = affectedPlans(plans).filter(p => !onlyIds || onlyIds.includes(p.id));
  if (indoor) return affected.map(p => ({ id: p.id, time: p.time, date: p.date, location: 'Indoor alternative — choose a venue', outdoor: false, api: p.api, reason: 'Keep your original time. Indoor air quality and venue availability are unknown.' }));
  const occupied = [...plans];
  const proposed: Proposal[] = [];
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const candidates = [
    ...forecast.filter(f => f.api <= 100 && f.hour > 12).map(f => ({ date: TODAY, time: String(f.hour).padStart(2, '0') + ':00', api: f.api })),
    { date: TOMORROW, time: '08:00', api: 42 },
  ];
  for (const plan of affected) {
    const slot = candidates.find(c => {
      if (c.date < plan.date || minutes(c.time) + plan.duration > (c.date === TODAY ? 22 : 10) * 60) return false;
      const overlaps = (p: { date: string; time: string; duration: number }) => p.date === c.date && minutes(c.time) < minutes(p.time) + p.duration && minutes(p.time) < minutes(c.time) + plan.duration;
      return !occupied.some(p => p.id !== plan.id && overlaps(p));
    });
    if (!slot) continue;
    proposed.push({ id: plan.id, ...slot, location: plan.location, outdoor: true, reason: 'A lower API in the sample outlook, with no calendar overlap. Same location.' });
    occupied.splice(occupied.findIndex(p => p.id === plan.id), 1, { ...plan, ...slot });
  }
  return proposed;
}
export function applyProposals(plans: Plan[], proposals: Proposal[]) {
  return plans.map(p => { const change = proposals.find(c => c.id === p.id); return change && !p.fixed ? { ...p, time: change.time, date: change.date, location: change.location, outdoor: change.outdoor, api: change.api } : p; });
}
