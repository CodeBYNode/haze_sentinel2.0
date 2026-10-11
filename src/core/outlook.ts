export type OutlookWindow = { start: string; end: string; label: string; reportedText: string; resolution: 'reported_window'; timeZone: string };
export type OutlookEvidence = { articleId: string; title: string; url: string; publisher: string; publishedAt: string; excerpt: string; timeframe: OutlookWindow | null };
export type OutlookEvent = { expected: true | null; timeframe: OutlookWindow | null; evidence: OutlookEvidence[] };
export type HazeOutlook = {
  status: 'estimated' | 'unavailable'; trend: 'easing' | 'worsening' | 'mixed' | 'unknown';
  summary: string; confidence: 'low' | 'none'; reason: string | null;
  generatedAt: string; source: string; location: string; timeZone: string; updatedAt: string | null; articlesChecked: number;
  alleviation: OutlookEvent; anotherWave: OutlookEvent;
  method: { name: 'reported_haze_trend'; query: string; maximumArticleAgeHours: number };
  limitations: string[];
};
