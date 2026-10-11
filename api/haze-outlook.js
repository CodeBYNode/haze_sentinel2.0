import { createHazeOutlookHandler } from '../server/lib/haze-outlook-api.mjs';
import { getCache } from '@vercel/functions';

export default createHazeOutlookHandler({ cache: getCache() });
