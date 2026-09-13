const http=require("http");
const fs=require("fs");
const path=require("path");
const PORT=process.env.PORT||8321;
const HTML=path.join(__dirname,"index.html");
const UA="Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
function stripHtml(t){
  return t.replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi,"\n")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/[ \t]{2,}/g," ")
    .replace(/\n{3,}/g,"\n\n").trim();
}
function isNowcoderUrl(url){
  try{
    const h=new URL(String(url||"")).hostname.toLowerCase();
    return h==="nowcoder.com"||h.endsWith(".nowcoder.com");
  }catch(e){return false}
}
function parseNowcoderId(url){ const m=String(url||"").match(/discuss\/(\d+)/); return m?m[1]:null }
function send(res,obj){res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(obj))}
function loadLLM(){try{return JSON.parse(fs.readFileSync(path.join(__dirname,"llm.json"),"utf8"))}catch(e){return null}}
/* Origin 校验：本服务能花用户的 LLM Key，绝不能让浏览器里任意网页（CORS *）静默调用。
   只放行无 Origin（curl/同源 GET）、file://（离线打开 index.html，Origin 为 "null"）、本机回环来源。 */
const LOOPBACK=/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i;
function checkOrigin(req){
  const o=String(req.headers.origin||"");
  if(!o||o==="null")return true;
  try{return LOOPBACK.test(o)}catch(e){return false}
}
const MAX_BODY=100*1024;
const server=http.createServer(async(req,res)=>{
  const origin=String(req.headers.origin||"");
  const originOk=checkOrigin(req);
  if(originOk&&origin){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin")}
  if(req.method==="OPTIONS"){res.statusCode=originOk?204:403;if(originOk)res.setHeader("Access-Control-Allow-Headers","Content-Type");res.end();return}
  if(!originOk){res.statusCode=403;send(res,{ok:false,msg:"Origin 校验失败：仅允许本机页面调用本服务"});return}
  const u=new URL(req.url,"http://x");
  if(u.pathname==="/"){res.setHeader("Content-Type","text/html; charset=utf-8");fs.createReadStream(HTML).pipe(res);return}
  if(u.pathname==="/api/ping"){send(res,{ok:true});return}
  if(u.pathname==="/api/fetch_nowcoder"){
    const url=u.searchParams.get("url")||"";
    if(!isNowcoderUrl(url)){send(res,{ok:false,msg:"只支持牛客链接"});return}
    const id=parseNowcoderId(url);
    if(!id){send(res,{ok:false,msg:"只支持 discuss 链接。exam 页在登录态抓不到、feed 页不 SSR——这是实测结论，请直接复制粘贴面经原文。"});return}
    try{
      const r=await fetch("https://m.nowcoder.com/discuss/"+id,{headers:{"User-Agent":UA},signal:AbortSignal.timeout(10000)});
      const html=await r.text();
      const text=stripHtml(html);
      if(text.length<200){send(res,{ok:false,msg:"抓到的正文太短（可能需登录或页面改版），请直接复制粘贴面经原文。"});return}
      send(res,{ok:true,text:text});
    }catch(e){send(res,{ok:false,msg:/timeout|abort/i.test(e&&e.message)?"抓取超时（10 秒），请稍后重试或直接复制粘贴面经原文。":"抓取失败："+e.message})}
    return;
  }
  if(u.pathname==="/api/ai"&&req.method==="POST"){
    let body="";
    req.on("data",c=>{
      body+=c;
      if(body.length>MAX_BODY){send(res,{ok:false,msg:"请求体过大（上限 100KB）"});req.destroy()}
    });
    req.on("end",async()=>{
      const cfg=loadLLM();
      if(!cfg||!cfg.key){send(res,{ok:false,msg:'未配置 LLM。在本目录新建 llm.json，内容：{"baseURL":"https://api.deepseek.com","key":"sk-你的Key","model":"deepseek-chat"}，保存后无需重启。'});return}
      try{
        const data=JSON.parse(body||"{}");
        if(!data.prompt){send(res,{ok:false,msg:"缺少 prompt"});return}
        const r=await fetch((cfg.baseURL||"https://api.deepseek.com").replace(/\/$/,"")+"/chat/completions",{
          method:"POST",
          headers:{"Content-Type":"application/json","Authorization":"Bearer "+cfg.key},
          body:JSON.stringify({model:cfg.model||"deepseek-chat",messages:[{role:"system",content:data.system||""},{role:"user",content:data.prompt||""}]})
        });
        const j=await r.json();
        if(j.choices&&j.choices[0])send(res,{ok:true,text:j.choices[0].message.content});
        else send(res,{ok:false,msg:"LLM 返回异常："+JSON.stringify(j).slice(0,300)});
      }catch(e){send(res,{ok:false,msg:"LLM 调用失败："+e.message})}
    });
    return;
  }
  res.statusCode=404;send(res,{ok:false,msg:"not found"});
});
module.exports={stripHtml,isNowcoderUrl,parseNowcoderId,loadLLM,checkOrigin,MAX_BODY,PORT};

if(require.main===module){
  server.on("error",function(e){
    if(e.code==="EADDRINUSE"){
      console.log("端口 "+PORT+" 已在运行中，直接打开 http://127.0.0.1:"+PORT+" 即可（无需重复启动）。");
      process.exit(0);
    }
    throw e;
  });
  server.listen(PORT,"127.0.0.1",function(){
    console.log("Pipeline server: http://127.0.0.1:"+PORT);
    console.log("AI polish: create llm.json next to this file (see README). Key stays on your machine.");
  });
}
