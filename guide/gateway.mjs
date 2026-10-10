// Public Appwrite routing only. Gemini credentials stay in the function.
const SDK_URL='https://cdn.jsdelivr.net/npm/appwrite@23.0.0/+esm';
const settings={endpoint:'https://fra.cloud.appwrite.io/v1',project:'6aa55a88003959a536e9',functionId:'6aa5abef002dd368d5cc'};
export function createGateway({sdkProvider=async()=>globalThis.Appwrite||await import(SDK_URL)}={}) {
  let connection;
  async function execute(action,data={}) {
    connection ||= sdkProvider().then(sdk=>new sdk.Functions(new sdk.Client().setEndpoint(settings.endpoint).setProject(settings.project)));
    const functions=await connection;
    const execution=await functions.createExecution({functionId:settings.functionId,body:JSON.stringify({...data,action:`guide:${action}`}),async:false,path:'/',method:'POST'});
    let result;
    try { result=JSON.parse(execution.responseBody||'{}'); } catch { throw Error('guide_unavailable'); }
    if(execution.responseStatusCode<200||execution.responseStatusCode>=300)throw Object.assign(Error(result.error||'guide_unavailable'),{code:execution.responseStatusCode});
    return result;
  }
  return {status:()=>execute('status'),ask:data=>execute('ask',data)};
}

export function readReply(value,cards) {
  if(value?.outcome==='unknown'&&Array.isArray(value.sourceIds)&&!value.sourceIds.length)return null;
  if(!value||!['answer','clarify'].includes(value.outcome)||typeof value.answer!=='string'||!value.answer.trim()||value.answer.length>4000||
    /(?:https?:|www\.|javascript:|data:|\]\s*\()/i.test(value.answer)||!Array.isArray(value.sourceIds)||value.sourceIds.length>5||
    (value.outcome==='answer'&&!value.sourceIds.length)||value.sourceIds.some(id=>!cards.some(c=>c.id===id))||
    (value.followups!==undefined&&(!Array.isArray(value.followups)||value.followups.length>3||value.followups.some(q=>typeof q!=='string'||!q.trim()||q.length>160||/(?:https?:|www\.|javascript:|data:)/i.test(q)))))throw Error('invalid_reply');
  return {remote:value,matches:cards.filter(c=>value.sourceIds.includes(c.id))};
}
