import { describe,expect,it } from 'vitest';
import { assessOutdoor,defaultPolicy } from './recommendation';
import type { AQReading,Profile } from './types';
const profile:Profile={ageGroup:'18-64',health:[],other:'',location:'Kuala Lumpur',language:'en',guest:true};
const current:AQReading={aqi:22,category:'Good',observedAt:new Date().toISOString(),location:'Kuala Lumpur',demo:false};
describe('outdoor recommendations',()=>{
 it('does not infer a decision from an unconfigured category',()=>expect(assessOutdoor(current,profile,'walking').decision).toBe('UNABLE'));
 it('requires a reading',()=>expect(assessOutdoor(null,profile,'football').reasonCodes).toContain('data-unavailable'));
 it('treats stale readings as unable to assess',()=>{const policy={...defaultPolicy,categories:{Good:'GO' as const}};const old={...current,observedAt:new Date(Date.now()-4*3600000).toISOString()};expect(assessOutdoor(old,profile,'walking',Date.now(),policy).decision).toBe('UNABLE')});
 it('uses only configured category decisions',()=>{const policy={...defaultPolicy,categories:{Good:'GO' as const,Moderate:'CAUTION' as const}};expect(assessOutdoor(current,profile,'walking',Date.now(),policy).decision).toBe('GO')});
 it('returns an explicit unable state on provider failure',()=>{const failed=assessOutdoor(null,profile,'walking');expect(failed.decision).toBe('UNABLE');expect(failed.alternative).toBeTruthy()});
});
