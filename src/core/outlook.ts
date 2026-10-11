export type OutlookWindow = { start: string; end: string; label: string; reportedText: string | null; resolution: 'reported_window' | 'heuristic_window'; timeZone: string; basis: 'reported' | 'heuristic'; rule: string | null; anchorAt: string };
export type OutlookEvidence = { articleId: string; title: string; url: string; publisher: string; publishedAt: string; excerpt: string; timeframe: OutlookWindow | null };
export type OutlookEvent = { expected: true | null; timeframe: OutlookWindow | null; evidence: OutlookEvidence[]; basis: 'reported' | 'heuristic' | null; rationale: string | null };
export type HazeOutlook = {
  status: 'estimated' | 'unavailable'; trend: 'easing' | 'worsening' | 'mixed' | 'unknown';
  summary: string; confidence: 'low' | 'very_low' | 'none'; reason: string | null;
  generatedAt: string; source: string; location: string; timeZone: string; updatedAt: string | null; articlesChecked: number;
  alleviation: OutlookEvent; anotherWave: OutlookEvent;
  method: { name: 'news_haze_heuristic'; query: string; maximumArticleAgeHours: number;
    heuristicRules: Record<string, { hours: [number, number]; reason: string; priority: number }> };
  limitations: string[];
};
