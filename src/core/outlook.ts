export type OutlookWindow = { date: string; start: string; end: string; label: string; resolution: 'day'; timeZone: string };
export type HazeOutlook = {
  status: 'estimated' | 'unavailable'; trend: 'easing' | 'worsening' | 'mixed' | 'steady' | 'unknown';
  summary: string; confidence: 'low' | 'none'; reason: string | null;
  generatedAt: string; observedAt: string | null; station: string | null;
  source: string; latestForecastDay: string | null; timeZone: string;
  alleviation: { expected: boolean | null; timeframe: OutlookWindow | null };
  anotherWave: { expected: boolean | null; timeframe: OutlookWindow | null };
  coverage: { from: string; through: string; forecastDays: string[] } | null;
  daily: { day: string; averageIndex: number }[];
  method: { name: string; relativeChange: number; minimumIndexChange: number; maximumHorizonDays: number;
    pollutant: string | null; baseline: { value: number; source: string; day: string } | null };
  limitations: string[];
};
