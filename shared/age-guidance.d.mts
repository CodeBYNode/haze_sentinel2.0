export type AgeGroup = 'under-18' | '18-64' | '65-plus' | 'prefer';
export const AGE_GROUPS: { value: AgeGroup; label: string; detail: string }[];
export function normalizeAgeGroup(value?: unknown): AgeGroup;
export type AgeSensitivity = { ageGroup: AgeGroup; extraCaution: boolean; label: string; explanation: string };
export function ageSensitivity(value?: unknown): AgeSensitivity;
export function ageActivityGuidance(value: unknown, reading?: { aqi?: number | null; observedAt?: string | null; demo?: boolean } | null, now?: number): AgeSensitivity & { readingAvailable: boolean; advice: string; outdoorSuggestion: string };
