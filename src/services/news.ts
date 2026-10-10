export type NewsSource={name:string;id:string|null;url:string|null;publisherUrl:string|null};
export type NewsArticle={id:string;title:string;publisher:string;publisherId:string|null;publisherUrl:string|null;url:string;publishedAt:string|null;publishedAtTimezone:string|null;description:string;imageUrl:string|null;language:string|null;countries:string[];categories:string[];keywords:string[];authors:string[];sources:NewsSource[]};
export type NewsFeed={articles:NewsArticle[];source:string;status:'ready'|'partial'|'stale'|'loading'|'unavailable';stale:boolean;refreshing?:boolean;updatedAt:string|null;error:string|null};

export async function getNews(signal?:AbortSignal):Promise<NewsFeed>{
  const response=await fetch('/api/news',{signal,cache:'no-store'});
  let body:any;
  try{body=await response.json()}catch{throw new Error('The HazeAI news service returned an invalid response.')}
  if(!response.ok)throw new Error(body?.error||'News could not be loaded.');
  if(!Array.isArray(body.articles))throw new Error('The HazeAI news service returned incomplete data.');
  return body as NewsFeed;
}
