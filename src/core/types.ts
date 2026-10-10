export type Lang = 'en' | 'ms';
export type Decision = 'GO' | 'CAUTION' | 'AVOID' | 'UNABLE';
export type AQReading = { aqi?: number; category?: string; scale?: string; pm25?: number; pm10?: number; location?: string; observedAt?: string; source?: string; demo: boolean };
export type Profile = { ageGroup: string; health: string[]; other: string; location: string; language: Lang; guest: boolean };
export type Activity = 'football' | 'jogging' | 'walking' | 'cycling' | 'exercise' | 'general';
export type Assessment = { decision: Decision; reasonCodes: string[]; summary: string; rationale: string; alternative: string; reading?: AQReading; limitations: string[] };
