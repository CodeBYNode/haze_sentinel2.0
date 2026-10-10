import type { Activity, Assessment, Lang, Profile } from '../core/types';
/** Constrained assistant seam: deterministic decisions stay in the application policy. */
export interface HazeAIService { reply(question:string, activity:Activity, result:Assessment, profile:Profile, language:Lang): Promise<string> }
export class DemoHazeAI implements HazeAIService {
 async reply(_q:string, activity:Activity, result:Assessment, _p:Profile, lang:Lang):Promise<string> {
  await new Promise(r=>setTimeout(r,650));
  if(lang==='ms') return result.decision==='UNABLE' ? 'Saya belum dapat menentukan dengan yakin berdasarkan bacaan dan panduan yang tersedia. Semak sumber rasmi setempat atau cuba lagi nanti.' : `Untuk ${activity}, ${result.summary} ${result.rationale} Alternatif: ${result.alternative}`;
  return result.decision==='UNABLE' ? 'I can’t make a confident recommendation from the available reading and guidance. Check an official local source or try again later.' : `For ${activity}, ${result.summary} ${result.rationale} A safer option: ${result.alternative}`;
 }
}
