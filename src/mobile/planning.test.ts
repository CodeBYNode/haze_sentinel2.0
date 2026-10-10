import { describe, expect, it } from 'vitest';
import { affectedPlans, applyProposals, initialPlans, proposeChanges, severity, severityNames, TODAY, type Plan } from '../ui/model';
import { replyTo } from './planning';

const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
describe('mobile planning', () => {
  it('uses Malaysian API category boundaries', () => {
    expect([50, 51, 100, 101, 200, 201, 300, 301].map(n => severityNames[severity(n)])).toEqual(['Good', 'Moderate', 'Moderate', 'Unhealthy', 'Unhealthy', 'Very unhealthy', 'Very unhealthy', 'Hazardous']);
  });
  it('does not flag past or fixed activities for automatic movement', () => {
    const past: Plan = { ...initialPlans[2], id: 'past', time: '09:00' };
    const fixed: Plan = { ...initialPlans[2], id: 'fixed', fixed: true };
    expect(affectedPlans([past, fixed, initialPlans[2]]).map(p => p.id)).toEqual(['run']);
  });
  it('finds lower-API windows and prevents overlapping proposals', () => {
    const proposals = proposeChanges(initialPlans);
    expect(proposals).toHaveLength(2);
    expect(proposals.map(p => p.time)).toEqual(['19:00', '20:00']);
    const next = applyProposals(initialPlans, proposals);
    for (const proposed of proposals) {
      expect(proposed.api).toBeLessThanOrEqual(100);
      const moved = next.find(p => p.id === proposed.id)!;
      expect(next.filter(p => p.id !== moved.id && p.date === moved.date && minutes(moved.time) < minutes(p.time) + p.duration && minutes(p.time) < minutes(moved.time) + moved.duration)).toEqual([]);
    }
    expect(next.find(p => p.id === 'class')).toEqual(initialPlans.find(p => p.id === 'class'));
  });
  it('works around existing evening commitments', () => {
    const fixed: Plan = { ...initialPlans[1], id: 'evening-class', time: '19:00', duration: 120 };
    const proposals = proposeChanges([...initialPlans, fixed]);
    expect(proposals.some(p => p.date === TODAY && p.time < '21:00')).toBe(false);
  });
  it('scopes a request to one activity while respecting the rest of the calendar', () => {
    const proposals = proposeChanges(initialPlans, false, ['run']);
    expect(proposals.map(p => p.id)).toEqual(['run']);
    const reply = replyTo('Find a better time', initialPlans, 'Kuala Lumpur', 'cycle');
    expect(reply.proposals?.map(p => p.id)).toEqual(['cycle']);
  });
  it('preserves activity times for an indoor alternative without claiming measured indoor air', () => {
    const proposals = proposeChanges(initialPlans, true);
    expect(proposals.every(p => !p.outdoor && p.time === initialPlans.find(a => a.id === p.id)?.time)).toBe(true);
    expect(proposals[0].reason).toContain('unknown');
  });
  it('never applies an AI proposal to a newly fixed commitment', () => {
    const proposals = proposeChanges(initialPlans);
    const plans = initialPlans.map(p => p.id === 'run' ? { ...p, fixed: true } : p);
    expect(applyProposals(plans, proposals).find(p => p.id === 'run')).toEqual(plans.find(p => p.id === 'run'));
  });
  it('does not claim that news reporting generated the sample prediction', () => {
    expect(replyTo('What news is this prediction based on?', initialPlans, 'Kuala Lumpur').text).toContain('illustrative');
    expect(replyTo('May I go jogging now?', initialPlans, 'Kuala Lumpur').text).toContain('isn’t a live observation');
  });
});
