import type { HazeOutlook } from '../src/core/outlook';
import type { NewsFeed } from '../src/services/news';
export type OutlookResponse = { outlook: HazeOutlook; news: NewsFeed };
export function outlookLocationKey(location: string): string;
export function isOutlookResponse(value: unknown): value is OutlookResponse;
export function hasUsableOutlook(value: unknown, location: string): value is OutlookResponse & { outlook: HazeOutlook & { status: 'estimated' } };
export function cachedOutlook(value: OutlookResponse, reason?: string, now?: Date): OutlookResponse;
