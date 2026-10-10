import type { AQReading } from '../core/types';
/** Provider adapter seam: no provider, endpoint, or thresholds are assumed. */
export interface AirQualityProvider { getCurrent(location: string, signal?: AbortSignal): Promise<AQReading> }
export class UnconfiguredProvider implements AirQualityProvider { async getCurrent(): Promise<AQReading> { throw new Error('Air-quality API is not configured yet.'); } }
/** Clearly labelled fixture for interface prototyping only. */
export class DemoProvider implements AirQualityProvider {
 async getCurrent(location: string): Promise<AQReading> { await new Promise(r=>setTimeout(r,450)); return {aqi:42,category:'Moderate',scale:'Demo only',pm25:12.4,pm10:21,location,observedAt:new Date().toISOString(),source:'Sample fixture',demo:true}; }
}
