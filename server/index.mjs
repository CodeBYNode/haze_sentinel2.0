import {createServer} from 'node:http';
import {WaqiService,WaqiError} from './lib/waqi.mjs';
import {NewsDataService} from './lib/newsdata.mjs';
import {assessTomorrow} from './lib/assessment.mjs';
import {chatWithOpenRouter,OpenRouterError} from './lib/openrouter.mjs';
const port=Number(process.env.API_PORT||8787),waqi=new WaqiService(),news=new NewsDataService();
const positiveNumber=(raw,fallback)=>Number.isFinite(Number(raw))&&Number(raw)>0?Number(raw):fallback;
const hazeRefreshIntervalMinutes=positiveNumber(process.env.HAZE_REFRESH_INTERVAL_MINUTES,10);
const newsRefreshIntervalHours=positiveNumber(process.env.NEWS_REFRESH_INTERVAL_HOURS,3);
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload))};
const safeProfile=p=>({ageGroup:['under-5','5-17','18-64','65-plus','prefer'].includes(p?.ageGroup)?p.ageGroup:'prefer',health:Array.isArray(p?.health)?p.health.filter(x=>['pregnant','disability','asthma','lung','heart'].includes(x)):[],otherConsideration:Boolean(String(p?.other||'').trim()),location:String(p?.location||'').slice(0,120)});
const locationFrom=(b,p)=>({stationId:String(b.stationId||''),lat:Number.isFinite(Number(b.lat))?Number(b.lat):undefined,lon:Number.isFinite(Number(b.lon))?Number(b.lon):undefined,location:p.location});
const jsonBody=async req=>{let raw='';for await(const part of req){raw+=part;if(raw.length>160000)throw new Error('body-limit')}return JSON.parse(raw||'{}')};
const server=createServer(async(req,res)=>{
 try{
 let url;try{url=new URL(req.url||'/','http://'+(req.headers.host||'localhost'))}catch{return json(res,400,{error:'Invalid request URL.'})}
 if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,waqiConfigured:Boolean(process.env.WAQI_API_TOKEN?.trim()),newsConfigured:Boolean(process.env.NEWSDATA_API_KEY?.trim()),openRouterConfigured:Boolean(process.env.OPENROUTER_API_KEY?.trim()&&process.env.OPENROUTER_MODEL?.trim())});
 if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{hazeRefreshIntervalMinutes,newsRefreshIntervalHours});
 if(req.method==='GET'&&url.pathname==='/api/news')return json(res,200,await news.get());
 if(req.method==='GET'&&url.pathname==='/api/locations/search'){try{return json(res,200,{locations:await waqi.search(url.searchParams.get('q')||'')})}catch(e){return json(res,e instanceof WaqiError&&e.code==='missing_config'?503:502,{error:e.message,code:e.code||'upstream'})}}
 if(req.method==='GET'&&url.pathname==='/api/air-quality'){try{const reading=await waqi.feed({stationId:url.searchParams.get('stationId')||'',lat:url.searchParams.has('lat')?Number(url.searchParams.get('lat')):undefined,lon:url.searchParams.has('lon')?Number(url.searchParams.get('lon')):undefined,location:url.searchParams.get('location')||''});return json(res,200,{reading})}catch(e){return json(res,e instanceof WaqiError&&e.code==='missing_config'?503:e.code==='not_found'||e.code==='unsupported_location'?404:502,{error:e.message,code:e.code||'upstream'})}}
 if(req.method==='POST'&&(url.pathname==='/api/assessment/tomorrow'||url.pathname==='/api/chat')){
  let body;try{body=await jsonBody(req)}catch{return json(res,400,{error:'Request body must be valid JSON and under 160 KB.'})}
  if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Request body must be a JSON object.'});
  const messages=Array.isArray(body.messages)?body.messages.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string'&&m.content.trim()).slice(-12):[];
  if(!messages.some(m=>m.role==='user'))return json(res,400,{error:'Write a question before sending.'});
  const profile=safeProfile(body.profile),where=locationFrom(body,profile);let reading=null,error=null;
  const newsSnapshot=await news.refreshIfDue();
  try{reading=await waqi.feed(where)}catch(e){if(e instanceof WaqiError)error=e.message;else error='Air-quality service unavailable.'}
  const assessment=assessTomorrow(reading,profile);
  const context={selected_location:profile.location,current_observation:reading?{aqi:reading.aqi,category:reading.category,index_name:reading.indexName,observed_at:reading.observedAt,station:reading.station,pollutants:reading.pollutants,source:reading.source}:null,tomorrow_assessment:assessment,provider_error:error,news:{source:newsSnapshot.source,status:newsSnapshot.status,stale:newsSnapshot.stale,updated_at:newsSnapshot.updatedAt,error:newsSnapshot.error,interpretation_note:'Articles are reports, not verified measurements or official advisories. Syndicated versions are grouped and do not count as independent confirmation.',articles:newsSnapshot.articles.slice(0,8).map(a=>({title:a.title,publisher:a.publisher,published_at:a.publishedAt,description:a.description,url:a.url,sources:a.sources}))},personal_context:{age_group:profile.ageGroup,disclosed_factors:profile.health,other_consideration_disclosed:profile.otherConsideration}};
  if(url.pathname==='/api/assessment/tomorrow'){
   try{const explanation=await chatWithOpenRouter({messages,context,language:body.language});return json(res,200,{assessment,reading,error,explanation})}
   catch(e){return json(res,200,{assessment,reading,error,explanation:null,explanationError:e.message||'AI explanation service unavailable.'})}
  }
  try{const reply=await chatWithOpenRouter({messages,context,language:body.language});return json(res,200,{reply,assessment,reading,dataError:error})}
  catch(e){return json(res,e instanceof OpenRouterError?e.status:502,{error:e.message||'AI service unavailable.'})}
 }
 return json(res,404,{error:'API route not found.'})
 }catch{
  if(!res.headersSent)return json(res,500,{error:'HazeAI encountered an unexpected server error. Please retry.'});
  res.destroy();
 }
});
server.listen(port,'127.0.0.1',()=>process.stdout.write('HazeAI API listening on 127.0.0.1:'+port+'\n'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
