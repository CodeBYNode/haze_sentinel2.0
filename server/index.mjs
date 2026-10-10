import {createServer} from 'node:http';
import {WaqiService} from './lib/waqi.mjs';
import {createAirQualityHandler} from './lib/air-quality.mjs';
import {createLocationSearchHandler} from './lib/locations.mjs';
import {NewsDataService} from './lib/newsdata.mjs';
import {createChatHandler} from './lib/chat.mjs';
import {handleSpendings} from './spendings.mjs';
const port=Number(process.env.API_PORT||8787),waqi=new WaqiService(),news=new NewsDataService();
const handleAirQuality=createAirQualityHandler({waqi});
const handleHazeOutlook=createAirQualityHandler({waqi,includeOutlook:true});
const handleLocationSearch=createLocationSearchHandler({waqi});
const handleChat=createChatHandler({waqi,news});
const handleTomorrow=createChatHandler({waqi,news,tomorrow:true});
const positiveNumber=(raw,fallback)=>Number.isFinite(Number(raw))&&Number(raw)>0?Number(raw):fallback;
const hazeRefreshIntervalMinutes=positiveNumber(process.env.HAZE_REFRESH_INTERVAL_MINUTES,10);
const newsRefreshIntervalHours=positiveNumber(process.env.NEWS_REFRESH_INTERVAL_HOURS,3);
const json=(res,status,payload)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(payload))};
const jsonBody=async req=>{let raw='';for await(const part of req){raw+=part;if(raw.length>160000)throw new Error('body-limit')}return JSON.parse(raw||'{}')};
const server=createServer(async(req,res)=>{
 try{
 let url;try{url=new URL(req.url||'/','http://'+(req.headers.host||'localhost'))}catch{return json(res,400,{error:'Invalid request URL.'})}
 if(req.method==='POST'&&url.pathname==='/api/spendings/assess')return await handleSpendings(req,res,{waqi,jsonBody,json});
 if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,waqiConfigured:Boolean(process.env.WAQI_API_TOKEN?.trim()),newsConfigured:Boolean(process.env.NEWSDATA_API_KEY?.trim()),openRouterConfigured:Boolean(process.env.OPENROUTER_API_KEY?.trim()&&process.env.OPENROUTER_MODEL?.trim())});
 if(req.method==='GET'&&url.pathname==='/api/config')return json(res,200,{hazeRefreshIntervalMinutes,newsRefreshIntervalHours});
 if(req.method==='GET'&&url.pathname==='/api/news')return json(res,200,await news.get());
 if(url.pathname==='/api/locations/search')return await handleLocationSearch(req,res);
 if(url.pathname==='/api/air-quality')return await handleAirQuality(req,res);
 if(url.pathname==='/api/haze-outlook')return await handleHazeOutlook(req,res);
 if(url.pathname==='/api/chat')return await handleChat(req,res);
 if(url.pathname==='/api/assessment/tomorrow')return await handleTomorrow(req,res);
 return json(res,404,{error:'API route not found.'})
 }catch{
  if(!res.headersSent)return json(res,500,{error:'HazeAI encountered an unexpected server error. Please retry.'});
  res.destroy();
 }
});
server.listen(port,'127.0.0.1',()=>process.stdout.write('HazeAI API listening on 127.0.0.1:'+port+'\n'));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
