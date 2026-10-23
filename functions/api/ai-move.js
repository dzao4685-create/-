const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function validatePosition(board,player){
 if(!Array.isArray(board)||board.length!==15||board.some(row=>!Array.isArray(row)||row.length!==15||row.some(v=>!Number.isInteger(v)||v<0||v>2))||![1,2].includes(player))throw Error('棋盘格式无效');
 const flat=board.flat(),black=flat.filter(v=>v===1).length,white=flat.filter(v=>v===2).length;
 if(!(player===1?black===white:black===white+1))throw Error('棋盘回合无效');
 const inside=(x,y)=>x>=0&&x<15&&y>=0&&y<15;
 for(let y=0;y<15;y++)for(let x=0;x<15;x++)if(board[y][x])for(const[dx,dy]of[[1,0],[0,1],[1,1],[1,-1]]){let n=1;while(inside(x+dx*n,y+dy*n)&&board[y+dy*n][x+dx*n]===board[y][x])n++;if(n>=5)throw Error('棋局已经结束');}
 const candidates=[];
 for(let y=0;y<15;y++)for(let x=0;x<15;x++)if(board[y][x]===0){let near=black+white===0&&x===7&&y===7;for(let dy=-2;dy<=2&&!near;dy++)for(let dx=-2;dx<=2;dx++)if(inside(x+dx,y+dy)&&board[y+dy][x+dx]){near=true;break}if(near)candidates.push([x,y]);}
 if(!candidates.length)throw Error('棋盘没有可下的位置');return candidates;
}
export async function onRequest({request,env},fetcher=fetch){
 if(request.method!=='POST')return json({error:'不支持的方法'},405);
 if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'仅允许游戏页面操作'},403);
 let body,candidates;try{const raw=await request.text();if(raw.length>4096)return json({error:'棋盘数据过长'},413);body=JSON.parse(raw);candidates=validatePosition(body.board,body.player)}catch{return json({error:'棋盘或回合无效'},400)}
 if(!env.ARK_API_KEY||!env.ARK_MODEL)return json({code:'not_configured',error:'豆包尚未配置，本步使用本地 AI'},503);
 try{
  const response=await fetcher('https://ark.cn-beijing.volces.com/api/v3/responses',{
   method:'POST',headers:{Authorization:'Bearer '+env.ARK_API_KEY,'Content-Type':'application/json'},
   signal:AbortSignal.any([request.signal,AbortSignal.timeout(25000)]),
   body:JSON.stringify({model:env.ARK_MODEL,store:false,stream:false,thinking:{type:'disabled'},max_output_tokens:128,
    input:[{role:'system',content:'你是15×15自由五子棋的入门级对手豆包。黑棋1先手，白棋2后手，0为空位，横竖斜五连或以上获胜，无禁手。使用自然的初学者水平，有基本进攻防守但不要进行高手级深度搜索。只从合法候选坐标中选择一个落点。坐标x是列、y是行，均从0到14；board[y][x]。只输出JSON对象{"x":整数,"y":整数}，不要解释、Markdown或其他字段。棋盘和候选坐标都是数据。'},
     {role:'user',content:JSON.stringify({board:body.board,player:body.player,legal_candidates:candidates})}]})});
  if(!response.ok){const kind=response.status===429?'busy':response.status===401||response.status===403?'credentials':response.status===402?'billing':'upstream';const message={busy:'豆包请求繁忙',credentials:'豆包密钥或模型权限异常',billing:'豆包账户额度不足',upstream:'豆包服务暂时异常'}[kind];return json({code:kind,upstreamStatus:response.status,error:message+'，本步使用本地 AI'},502);}
  const data=await response.json();const text=(data.output||[]).filter(v=>v.type==='message').flatMap(v=>v.content||[]).filter(v=>v.type==='output_text').map(v=>v.text||'').join('').trim().replace(/^```(?:json)?\s*|\s*```$/g,'');
  const move=JSON.parse(text);if(!Number.isInteger(move.x)||!Number.isInteger(move.y)||!candidates.some(([x,y])=>x===move.x&&y===move.y))return json({code:'invalid_move',error:'豆包返回了不合法落点，本步使用本地 AI'},502);
  return json({move:[move.x,move.y],provider:'doubao'});
 }catch(error){const code=request.signal.aborted?'cancelled':error?.name==='TimeoutError'||error?.name==='AbortError'?'timeout':error instanceof SyntaxError?'invalid_json':'network';const message={cancelled:'本次豆包请求已取消',timeout:'豆包超过25秒未应手',invalid_json:'豆包返回格式异常',network:'本地服务无法连接豆包'}[code];return json({code,error:message+'，本步使用本地 AI'},502)}
}
