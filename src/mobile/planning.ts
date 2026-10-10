import { affectedPlans, forecast, locations, proposeChanges, severity, severityNames, type Plan, type Proposal } from '../ui/model';

export function replyTo(text: string, plans: Plan[], city: string, scope?: string): { text: string; proposals?: Proposal[] } {
  const q = text.toLowerCase();
  const reading = locations.find(l => l.name === city) || locations[0];
  if (/class|lecture|fixed/.test(q) && /move|reschedul|change/.test(q) && !/keep|unchanged|outdoor|except/.test(q)) return { text: 'Fixed commitments stay in place when I suggest changes. You can edit a class directly from Schedule if you decide to move it.' };
  if (/reschedul|replan|move|better time|find.*time|indoor|budget|cheaper/.test(q)) {
    const affected = affectedPlans(plans).filter(p => !scope || p.id === scope);
    if (!affected.length) return { text: 'There are no upcoming, movable outdoor activities above API 100 in this demo selection. You can add or edit an activity in Schedule.' };
    const proposals = proposeChanges(plans, /indoor/.test(q), scope ? [scope] : undefined);
    if (!proposals.length) return { text: 'I couldn’t find a lower-API window without overlapping your existing commitments in the available demo forecast. Try an indoor alternative or edit an activity yourself.' };
    return { text: /indoor/.test(q) ? 'Here’s an indoor alternative at your original time. Choose a suitable venue before confirming; indoor air quality, cost, and availability haven’t been verified.' : `I found ${proposals.length === 1 ? 'a lower-API window' : 'lower-API windows'} in the sample outlook without overlapping your other plans. ${proposals.length < affected.length ? 'Some activities have no suitable window in the available forecast. ' : ''}Review the changes below. Fixed commitments stay unchanged.`, proposals };
  }
  if (/health|asthma|precaution|safe|mask/.test(q)) return { text: 'I can help compare the demo readings and your schedule, but can’t assess personal health or guarantee outdoor safety. Check current official air-quality and health guidance. You can ask me for an indoor alternative.' };
  if (/source|news|prediction|arriv|relief/.test(q)) return { text: 'Today’s arrival and relief times are illustrative, calculated from the demo hourly API curve. Open the haze outlook card on Today to see linked background reporting, publication dates, and connection status. Live news retrieval isn’t connected.' };
  if (/jog|run|cycl|walk|outdoor/.test(q)) return { text: `The demo reading for ${city} is API ${reading.api} (${severityNames[severity(reading.api)]}). This isn’t a live observation, so I can’t determine whether heading out now is suitable for you. I can compare lower-API times for your scheduled activities. Try “Find better times for my outdoor plans.”` };
  if (/haze|forecast|air|today|weather/.test(q)) { const peak = Math.max(...forecast.map(f => f.api + reading.offset)); return { text: `The illustrative API for ${city} is ${reading.api} at 12 PM MYT on 10 October 2026. The sample outlook peaks at ${peak} around 4 PM. You can explore each hour on Today or ask me to replan affected outdoor activities. Live conditions and news aren’t connected.` }; }
  return { text: 'I can help explain the demo air-quality outlook or compare times for your outdoor plans. Try “Find better times for my outdoor plans” or “What does today’s haze outlook mean?”' };
}
