export type BookingDetails = {
  total: number;
  deposit: number;
  refund: 'unknown' | 'nonrefundable' | 'refundable';
  changeFee: number | null;
  indoorCost: number | null;
  relocationFee: number | null;
  cancelFee: number | null;
  cancelBalance: 'unknown' | 'waived' | 'due';
  reference: string;
  terms: string;
  deadline: string;
  forecastLocation: string;
  forecastStationId: string;
  indoorConfirmed: boolean;
  currentIndoorConfirmed: boolean;
  alternativeConfirmed: boolean;
  alternativeDate: string;
  alternativeTime: string;
  depositTransfers: boolean;
  rescheduleDepositTransfers: boolean;
  operatingCost: number;
  expectedIncome: number;
};

export type SpendingEvent = {
  id: string; date: string; time: string; duration: number; location: string;
  outdoor: boolean; fixed: boolean; kind: string; booking: BookingDetails;
};
export type EventForecast = {
  risk: 'low' | 'moderate' | 'high' | 'unknown';
  index: number | null;
  period: string[];
  station: string | null;
  stationUrl: string | null;
  source: string;
  observedAt: string | null;
  forecastUpdatedAt: string | null;
  checkedAt: string;
  reason: string;
};
export type SpendingOption = {
  id: 'proceed' | 'relocate' | 'reschedule' | 'cancel';
  cost: number | null;
  feasible: boolean;
  reason: string;
  breakdown: Array<{ label: string; amount: number }>;
  incomeAtRisk: number;
};
export type SpendingAssessment = {
  id: string;
  status: 'scheduled';
  upcoming: boolean;
  needsAttention: boolean;
  forecast: EventForecast;
  alternativeForecast: EventForecast | null;
  options: SpendingOption[];
  cheapest: SpendingOption['id'] | null;
};
export type SpendingsResponse = {
  checkedAt: string;
  horizonEnd: string;
  assessments: SpendingAssessment[];
  summary: {
    bookingValueAtRisk: number; depositsAtRisk: number; operatingCostsAtRisk: number;
    incomeAtRisk: number; attentionCount: number; unknownCount: number; upcomingCount: number;
  };
};
