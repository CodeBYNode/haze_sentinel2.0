import { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { AGE_GROUPS, ageSensitivity, normalizeAgeGroup, type AgeGroup } from '../../shared/age-guidance.mjs';
import { ExternalLink } from './Kit';

export function AgeGroupPage({ value, onSave, onBack }: { value?: AgeGroup; onSave: (value: AgeGroup) => void; onBack: () => void }) {
  const [selected, setSelected] = useState(normalizeAgeGroup(value));
  const guidance = ageSensitivity(selected);
  return <section className="age-page" aria-label="Age group preferences">
    <button type="button" className="text-button age-back" onClick={onBack}><ArrowLeft size={17}/>Back to Profile</button>
    <header className="profile-heading"><h1>Your age group.</h1><p className="body-copy">Help us tailor haze advice and outdoor activity suggestions. Sharing is optional.</p></header>
    <form onSubmit={event => { event.preventDefault(); onSave(selected); }}>
      <fieldset className="age-options"><legend>Which age group are you in?</legend>{AGE_GROUPS.map(group => <label key={group.value} className={'age-option' + (selected === group.value ? ' selected' : '')}>
        <input type="radio" name="age-group" value={group.value} checked={selected === group.value} onChange={() => setSelected(group.value)}/>
        <span><strong>{group.label}</strong><small>{group.detail}</small></span>
      </label>)}</fieldset>
      <div className="age-explanation" role="status"><strong>{guidance.label}</strong><p>{guidance.explanation}</p></div>
      <p className="fine-print">This adjusts caution, not your measured AQI or overall health. Your choice stays in this session and is shared with the backend assistant when you ask an air-quality question.</p>
      <button className="button primary full" type="submit"><Check size={17}/>Save age group</button>
    </form>
    <ExternalLink href="https://www.airnow.gov/wildfires/be-smoke-ready/">Why age can affect haze sensitivity</ExternalLink>
  </section>;
}
