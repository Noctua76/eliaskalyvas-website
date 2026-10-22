import { createNyraHandler, assignmentPayload, seal, unseal, safeUrl, validateArticle } from './api.mjs';
import { PROMPT_VERSION } from './instructions.mjs';
import { MODELS, PRICE_DATE, usageCost, stageEstimate } from './costs.mjs';
import { proposeTopics } from './proposals.mjs';
const fail = code => { throw new Error(code); };
const terminal = new Set(['done','selection','paused','error']);
export function publicWork(work, steps = []) {
  const clean = value => Array.isArray(value) ? value.map(clean) : value && typeof value==='object' ? Object.fromEntries(Object.entries(value).filter(([k])=>!['ticket','owner_id'].includes(k)).map(([k,v])=>[k,clean(v)])) : value;
  const result = clean(work);
  result.steps = steps;
  const nextStage=['paused','error'].includes(work.state.stage)?work.state.resume_stage:work.state.stage;
  result.next_estimate = !nextStage||['done','selection'].includes(nextStage) ? 0 : stageEstimate(work.model,nextStage,work.state);
  result.price_date = PRICE_DATE;
  return result;
}
function settings(b) {
  const model = b.model || 'gpt-6.1-sol', budget = Number(b.budget);
  if(!MODELS[model]) fail('INVALID_MODEL');
  if(!Number.isFinite(budget)||budget<.10||budget>100) fail('INVALID_BUDGET');
  if(typeof b.auto_repairs!=='boolean') fail('INVALID_FIELDS');
  return {model,budget,auto_repairs:b.auto_repairs};
}
export function advanceState(state, stage, data, autoRepairs) {
  const s=structuredClone(state);
  if(stage==='proposals') { s.proposals=data; s.stage='selection'; }
  if(stage==='research') { delete s.previous_article; s.research=data; s.stage='evidence'; }
  if(stage==='evidence') { s.research={...s.research,...data}; s.stage='draft'; }
  if(stage==='draft') {
    s.drafts.push({...data,research:s.research,automatic_review:null,repair_cycles:s.cycle,review_history:[],article:{...data.article,status:'needs_revision'}});
    delete s.previous_article;
    s.stage='review';
  }
  if(stage==='review') {
    const d=s.drafts.at(-1); d.automatic_review=data; d.review_history=[...(s.reviews||[]),data];
    d.article.status=data.passed?'pending_review':'needs_revision';
    s.reviews=d.review_history;
    if(data.passed||s.cycle>=2) s.stage='done';
    else {
      s.feedback=[data.research_questions,data.revision_instructions,...data.issues].filter(Boolean).join('\n').slice(0,5000);
      s.research_focus=[data.research_questions,data.revision_instructions,...data.issues].filter(Boolean).join('\n').slice(0,3000);
      s.previous_article=d.article;
      s.cycle++;
      s.stage=data.needs_research?'research':'draft';
      if(!autoRepairs) {s.resume_stage=s.stage;s.stage='paused';}
    }
  }
  return s;
}
export function createWorkspaceHandler({ db,env,fetcher=fetch,sourceFetcher=fetch,now=Date.now }) {
  const core = createNyraHandler({db,env,fetcher,sourceFetcher,now});
  const checked = async promise => {const r=await promise;if(r.error) fail('STORAGE_UNAVAILABLE');return r.data;};
  const getWork = async(id,owner)=> {if(!/^[\da-f-]{36}$/.test(id)) fail('NOT_FOUND');const w=await checked(db.from('nyra_work').select('*').eq('id',id).eq('owner_id',owner).maybeSingle());if(!w)fail('NOT_FOUND');return w;};
  const withSteps = async w => publicWork(w,await checked(db.from('nyra_steps').select('*').eq('work_id',w.id).order('seq')));
  return async req => {
    // Reuse established origin, Auth.getUser, allowlist and MFA checks for every route.
    const authUrl=new URL(req.url);authUrl.pathname=authUrl.pathname.replace(/\/nyra-api.*$/,'/nyra-api/status');
    const authResponse=await core(new Request(authUrl,{method:req.method==='OPTIONS'?'OPTIONS':'GET',headers:req.headers,signal:req.signal}));
    if(req.method==='OPTIONS'||!authResponse.ok) return authResponse;
    const headers=new Headers(authResponse.headers);
    const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try {
      const path=new URL(req.url).pathname.replace(/^.*\/nyra-api/,'').replace(/\/$/,'');
      if(path==='/status'&&req.method==='GET') return reply({...await authResponse.json(),prompt_version:PROMPT_VERSION,model:'gpt-6.1-sol',models:MODELS,price_date:PRICE_DATE,persistence:'database',budget_control:'estimated_preflight',publishing:false});
      const {data:user}=await db.auth.getUser(req.headers.get('authorization').slice(7));
      if(!user?.user?.id) fail('UNAUTHORIZED');const owner=user.user.id;
      let b={};
      if(req.method==='POST') {const text=await req.text();if(new TextEncoder().encode(text).length>(path==='/import'?2000000:16000))fail('PAYLOAD_TOO_LARGE');try{b=JSON.parse(text);}catch{fail('INVALID_JSON');}}
      if(path==='/import'&&req.method==='POST') {
        const entries=b.export?.drafts;
        if(!Array.isArray(entries)||!entries.length||entries.length>30)fail('INVALID_FIELDS');
        const drafts=entries.map((d,i)=>{
          const assignment=assignmentPayload(d.assignment);
          const sources=(d.sources||[]).map(s=>({url:safeUrl(s.url),title:typeof s.title==='string'?s.title.slice(0,500):'',access:'imported_reference'})).filter(s=>s.url).slice(0,60);
          const article=validateArticle({...d.article,paragraphs:(d.article?.paragraphs||[]).map(p=>({...p,evidence_ids:[]}))},sources,assignment.format);
          return {assignment,article:{...article,status:'needs_revision'},sources,automatic_review:null,repair_cycles:0,run:{id:crypto.randomUUID(),model:typeof d.run?.model==='string'?d.run.model.slice(0,100):'imported',prompt_version:'imported',created_at:new Date(now()).toISOString()},research:{assignment,report:typeof d.research?.report==='string'?d.research.report.slice(0,25000):'',annotations:[],source_records:[]}};
        });
        const assignment=drafts.at(-1).assignment;
        const row=await checked(db.from('nyra_work').insert({owner_id:owner,title:assignment.topic+' / import',kind:'article',...settings(b),state:{assignment,stage:'done',imported:true,cycle:0,drafts,reviews:[]}}).select('*').single());
        return reply(await withSteps(row));
      }
      if(path==='/work'&&req.method==='GET') {
        const rows=await checked(db.from('nyra_work').select('id,title,kind,model,budget,spent,seq,active_seq,created_at,updated_at').eq('owner_id',owner).order('created_at',{ascending:false}).limit(100));
        return reply({work:rows});
      }
      if(path==='/work'&&req.method==='POST') {
        const config=settings(b), kind=b.kind==='topics'?'topics':'article';
        let assignment;
        let approval=null;
        if(b.selected_from) {
          const p=await getWork(b.selected_from,owner),index=b.selected_index;
          if(p.kind!=='topics'||!Number.isInteger(index)||!p.state.proposals?.topics[index])fail('INVALID_SELECTION');
          const t=p.state.proposals.topics[index];
          assignment=assignmentPayload({topic:t.title,direction:[t.central_question,t.provisional_thesis,t.original_angle,t.counterargument,...t.source_urls].join('\n').slice(0,2000),language:p.state.assignment.language,format:t.format});
          approval={proposal_work_id:p.id,index,approved_at:new Date(now()).toISOString()};
        } else assignment=assignmentPayload(kind==='topics'?{topic:'Current topic proposals',direction:b.direction||'',language:b.language,format:'signal'}:b);
        const state={assignment,approval,stage:kind==='topics'?'proposals':'research',cycle:0,drafts:[],reviews:[]};
        const row=await checked(db.from('nyra_work').insert({owner_id:owner,title:kind==='topics'?'3 θέματα / Topic proposals':assignment.topic,kind,...config,state}).select('*').single());
        return reply(await withSteps(row));
      }
      const match=path.match(/^\/work\/([\da-f-]+)(?:\/(step|settings|recover|revision))?$/);
      if(!match)fail('NOT_FOUND');let work=await getWork(match[1],owner);
      if(req.method==='GET'&&!match[2])return reply(await withSteps(work));
      if(req.method!=='POST')fail('NOT_FOUND');
      if(match[2]==='revision') {
        if(work.active_seq!==null)fail('WORK_BUSY');
        if(work.state.imported)fail('IMPORTED_RESEARCH_REQUIRES_NEW_ASSIGNMENT');
        const index=b.version===-1?work.state.drafts.length-1:b.version;
        const previous=work.state.drafts[index];
        if(!previous||typeof b.revision_note!=='string'||!b.revision_note.trim()||b.revision_note.length>3000)fail('INVALID_FIELDS');
        const state={assignment:work.state.assignment,approval:work.state.approval,revision_of:{id:work.id,version:index},stage:'draft',cycle:0,drafts:[],reviews:[],research:previous.research,previous_article:previous.article,revision_note:b.revision_note.trim()};
        const row=await checked(db.from('nyra_work').insert({owner_id:owner,title:work.title+' / revision',kind:'article',model:work.model,budget:work.budget,auto_repairs:work.auto_repairs,state}).select('*').single());
        return reply(await withSteps(row));
      }
      if(match[2]==='settings') {
        if(b.resume===true&&!['paused','error'].includes(work.state.stage))fail('WORK_PAUSED_OR_DONE');
        const config=settings(b);
        if(b.revision_note!==undefined) fail('INVALID_FIELDS');
        const ok=await checked(db.rpc('nyra_update_work',{p_id:work.id,p_owner:owner,p_model:config.model,p_budget:config.budget,p_auto:config.auto_repairs,p_resume:b.resume===true}));
        if(!ok)fail('WORK_BUSY_OR_BUDGET_TOO_LOW');
        return reply(await withSteps(await getWork(work.id,owner)));
      }
      if(match[2]==='recover') {
        if(work.active_seq===null||now()-Date.parse(work.updated_at)<5*60000) fail('WORK_BUSY');
        // A crashed provider request may have billed. Keep its reservation and require explicit recovery.
        const state={...work.state,stage:'error',resume_stage:work.state.stage,error:'INTERRUPTED_COST_UNKNOWN'};
        await checked(db.rpc('nyra_finish_step',{p_id:work.id,p_owner:owner,p_seq:work.active_seq,p_state:state,p_cost:null,p_usage:null,p_error:'INTERRUPTED_COST_UNKNOWN'}));
        return reply(await withSteps(await getWork(work.id,owner)));
      }
      if(match[2]!=='step')fail('NOT_FOUND');
      if(b.seq!==work.seq) return reply(await withSteps(work)); // replay after a lost response is read-only
      if(terminal.has(work.state.stage))fail('WORK_PAUSED_OR_DONE');
      if(env.NYRA_ENABLED!=='true'||!env.OPENAI_API_KEY)fail('NYRA_NOT_CONFIGURED');
      const stage=work.state.stage,reserve=stageEstimate(work.model,stage,work.state);
      const begin=await checked(db.rpc('nyra_begin_step',{p_id:work.id,p_owner:owner,p_seq:work.seq,p_stage:stage,p_reserve:reserve}));
      if(begin!=='OK')fail(begin);
      let accounting=null,providerStarted=false,definiteRejection=false,providerResponse;
      const metered=async(url,init)=>{
        providerStarted=true;
        const response=await fetcher(url,init);
        definiteRejection=[400,401,403,429].includes(response.status);
        if(response.ok){providerResponse=await response.clone().json();accounting=usageCost(work.model,providerResponse);}
        return response;
      };
      let state,error=null;
      try {
        const selectedEnv={...env,NYRA_MODEL:work.model};
        let result;
        if(stage==='proposals') {
          const allowed=await checked(db.rpc('website_rate_check',{p_bucket:'nyra-lab:'+owner+':proposals',p_limit:3}));
          if(!allowed)fail('RATE_LIMITED');
          result=await proposeTopics({env:selectedEnv,fetcher:metered,signal:req.signal,assignment:work.state.assignment,now});
        }
        else {
          let ticket;
          if(work.state.research?.ticket) {
            // Renew only a server-persisted, signature-verified packet after owner/MFA authorization.
            const packet=await unseal(work.state.research.ticket,env.OPENAI_API_KEY,owner,0);
            ticket=await seal({...packet,model:work.model,expires_at:now()+30*60000},env.OPENAI_API_KEY);
          }
          const payload=stage==='research'?{...work.state.assignment,research_focus:work.state.research_focus||'',...(ticket?{previous_ticket:ticket}:{})}:stage==='draft'?{ticket,editorial_feedback:work.state.feedback||'',revision_note:work.state.revision_note||'',...(work.state.previous_article?{previous_article:work.state.previous_article}:{})}:stage==='review'?{ticket,article:work.state.drafts.at(-1).article}:{ticket};
          const url=new URL(req.url);url.pathname=url.pathname.replace(/\/nyra-api.*$/,'/nyra-api/'+stage);
          const response=await createNyraHandler({db,env:selectedEnv,fetcher:metered,sourceFetcher,now})(new Request(url,{method:'POST',headers:req.headers,body:JSON.stringify(payload),signal:req.signal}));
          result=await response.json();if(!response.ok)fail(result.error||'SERVICE_UNAVAILABLE');
        }
        state=advanceState(work.state,stage,result,work.auto_repairs);
      } catch(e) {
        const known=['PROVIDER_LIMIT','PROVIDER_TIMEOUT','PROVIDER_ERROR','PROVIDER_UNAVAILABLE','PROVIDER_CONFIGURATION','RATE_LIMITED','MODEL_INCOMPLETE','MODEL_REFUSED','INVALID_PROPOSALS','UNVERIFIED_CITATION','UNVERIFIED_EXCERPT','INVALID_REVIEW','RESEARCH_WITHOUT_SOURCES','RESEARCH_TOO_LARGE','RESEARCH_EXPIRED_OR_INVALID','STORAGE_UNAVAILABLE'];
        error=known.includes(e.message)?e.message:'SERVICE_UNAVAILABLE';
        state={...work.state,stage:'error',resume_stage:stage,error};
      }
      const cost=accounting?.usd??(!providerStarted||definiteRejection?0:null);
      const finished=await checked(db.rpc('nyra_finish_step',{p_id:work.id,p_owner:owner,p_seq:work.seq,p_state:state,p_cost:cost,p_usage:accounting,p_error:error}));
      if(!finished)fail('STORAGE_UNAVAILABLE');
      return reply(await withSteps(await getWork(work.id,owner)));
    } catch(e) {
      const allowed=['IMPORTED_RESEARCH_REQUIRES_NEW_ASSIGNMENT','NYRA_NOT_CONFIGURED','NOT_FOUND','UNAUTHORIZED','INVALID_MODEL','INVALID_BUDGET','INVALID_FIELDS','INVALID_SELECTION','INVALID_JSON','PAYLOAD_TOO_LARGE','STORAGE_UNAVAILABLE','WORK_BUSY','WORK_BUSY_OR_BUDGET_TOO_LOW','BUDGET_EXCEEDED','STALE_STEP','WORK_PAUSED_OR_DONE'];
      const code=allowed.includes(e.message)?e.message:'SERVICE_UNAVAILABLE';
      return reply({error:code},code==='NOT_FOUND'?404:code==='UNAUTHORIZED'?401:code==='BUDGET_EXCEEDED'?409:code==='STORAGE_UNAVAILABLE'||code==='SERVICE_UNAVAILABLE'?503:400);
    }
  };
}
