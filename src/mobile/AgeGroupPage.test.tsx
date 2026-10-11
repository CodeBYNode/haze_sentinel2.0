import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AgeGroupPage } from './AgeGroupPage';
import { Profile } from './Account';
import { defaultProfile } from '../ui/model';
describe('Profile age-group page', () => {
  it('offers four optional radio choices and defaults to undisclosed', () => {
    const html = renderToStaticMarkup(<AgeGroupPage onSave={() => {}} onBack={() => {}}/>);
    expect((html.match(/type="radio"/g) || []).length).toBe(4);
    expect(html).toContain('Under 18'); expect(html).toContain('18–64'); expect(html).toContain('65+');
    expect(html.match(/<input[^>]*value="prefer"[^>]*>/)?.[0]).toContain('checked=""'); expect(html).toContain('Save age group');
    expect(html).toContain('Back to Profile');
  });
  it('shows extra caution for sensitive ages rather than a health score', () => {
    const html = renderToStaticMarkup(<AgeGroupPage value="65-plus" onSave={() => {}} onBack={() => {}}/>);
    expect(html).toContain('More cautious haze guidance'); expect(html.match(/<input[^>]*value="65-plus"[^>]*>/)?.[0]).toContain('checked=""');
    expect(html).toContain('not your measured AQI or overall health');
  });
  it('shows the saved selection in Profile', () => {
    const html = renderToStaticMarkup(<Profile profile={{ ...defaultProfile, ageGroup: 'under-18' }} onSave={() => {}} onNavigate={() => {}} notify={() => {}} onReplay={() => {}} onLocation={() => {}}/>);
    expect(html).toContain('Age group'); expect(html).toContain('Under 18');
  });
});
