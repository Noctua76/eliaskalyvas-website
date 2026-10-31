// Pure server-side fork. Never accepts an approval, research packet or run from
// the caller. Original draft and its immutable publication approvals survive.
import {validateArticle} from './api.mjs';
export function ownerEditedWork(work,input,{id=crypto.randomUUID(),now=Date.now()}={}){
 const need=(v,c)=>{if(!v)throw Error(c);};
 need(work.kind==='article'&&work.active_seq===null&&!work.state.imported,'WORK_BUSY_OR_IMPORTED');
 need(input&&Object.keys(input).sort().join(',')==='content,expected_presentation_revision,expected_run_id,version','INVALID_FIELDS');
 const d=work.state.drafts?.[input.version];
 need(Number.isInteger(input.version)&&input.version===work.state.drafts.length-1&&d&&d.run.id===input.expected_run_id&&d.presentation?.revision===input.expected_presentation_revision,'STALE_EDITORIAL_VERSION');
 const content=input.content;need(content&&Object.keys(content).sort().join(',')==='paragraphs,summary,title','INVALID_FIELDS');
 need(Array.isArray(content.paragraphs)&&content.paragraphs.every(p=>p&&Object.keys(p).sort().join(',')==='evidence_ids,source_urls,text'),'INVALID_FIELDS');
 const article=validateArticle({...structuredClone(d.article),...structuredClone(content)},d.sources,d.assignment.format,d.research?.source_records||[]);
 const draft={...structuredClone(d),article:{...article,status:'needs_revision'},automatic_review:null,review_history:[],repair_cycles:0,presentation:{...structuredClone(d.presentation),revision:0,cover:{...d.presentation.cover,rights_confirmed:false}},run:{...d.run,id,prompt_version:'owner-edit/review-required',created_at:new Date(now).toISOString()}};
 return {owner_id:work.owner_id,title:work.title+' / owner edit',kind:'article',model:work.model,budget:work.budget,auto_repairs:false,state:{assignment:structuredClone(work.state.assignment),approval:work.state.approval??null,revision_of:{id:work.id,version:input.version},stage:'review',cycle:0,drafts:[draft],reviews:[],research:structuredClone(d.research)}};
}
