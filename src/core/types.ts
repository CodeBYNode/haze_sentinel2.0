export type Lang = 'en' | 'ms';
export type Decision = 'GO' | 'CAUTION' | 'AVOID' | 'UNABLE';
export type AQReading = { aqi?: number|null; category?: string|null; scale?: string; pm25?: number; pm10?: number; location?: string; station?: string|null; stationUrl?: string|null; stationId?: string; coordinates?: {lat:number|null;lon:number|null}|null; observedAt?: string|null; source?: string; dominantPollutant?: string|null; pollutants?: Record<string,number>; forecast?: Record<string,Array<{day:string;avg:number;min:number;max:number}>>|null; attributions?: Array<{name:string;url:string}>; demo: boolean };
export type Profile = { ageGroup: string; health: string[]; other: string; location: string; language: Lang; guest: boolean; stationId?: string; locationCoords?: {lat:number;lon:number} };
export type Activity = 'football' | 'jogging' | 'walking' | 'cycling' | 'exercise' | 'general';
export type Assessment = { decision: Decision; reasonCodes: string[]; summary: string; rationale: string; alternative: string; reading?: AQReading; limitations: string[] };
