// Offline atomic replacement plan only. No GitHub API, dispatch or file writes.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const oldPath='.github/workflows/pages.yml',callerPath='.github/workflows/pages-orchestrator.yml';
export async function planPagesCutover({files,approvedPagesSHA256,reusableSHA}){
 const deny=()=>{throw Error('PAGES_CUTOVER_REVIEW_REQUIRED');};
 if(!(files instanceof Map)||!/^[a-f0-9]{40}$/.test(reusableSHA)||!/^[a-f0-9]{64}$/.test(approvedPagesSHA256))deny();
 const old=files.get(oldPath);if(typeof old!=='string'||createHash('sha256').update(old).digest('hex')!==approvedPagesSHA256||files.has(callerPath))deny();
 // Any other existing Pages-capable workflow is another authority, not ignored.
 for(const [path,source]of files)if(path.startsWith('.github/workflows/')&&/\.ya?ml$/.test(path)&&path!==oldPath&&/["']?pages["']?\s*:\s*["']?write\b/.test(source))deny();
 const caller=(await readFile(new URL('pages-orchestrator.yml.proposed',import.meta.url),'utf8'))
  .replaceAll(/(?<=\.yml@)(?:[a-f0-9]{40}|REVIEW_REQUIRED_IMMUTABLE_SHA)/g,reusableSHA);
 const delivery=await readFile(new URL('pages-delivery.yml.proposed',import.meta.url),'utf8'),inspection=await readFile(new URL('nyra-inspection.yml.proposed',import.meta.url),'utf8');
 if(caller.includes('REVIEW_REQUIRED')||!delivery.includes('npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime'))deny();
 return new Map([[oldPath,null],[callerPath,caller],['.github/workflows/pages-delivery.yml',delivery],['.github/workflows/nyra-inspection.yml',inspection]]);
}
