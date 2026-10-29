// Private Node worker only. No public route, DB credentials or URL acquisition.
import sharp from 'sharp';
import {hashJSON} from '../contract.mjs';
import {byteHash} from './adapters.mjs';
import {INSPECTOR_VERSION,inspectionReport} from './inspection.mjs';
import {inspectBytesWithRights} from './node-assets.mjs';
import {requireDelivery as need} from './materialize.mjs';
export async function inspectClaimedAsset(packet){
 need(sharp.versions.sharp==='0.34.5'&&sharp.versions.vips==='8.17.3','INSPECTION_VERSION');
 const {upload:u,rights:r,bytes}=packet;
 need(u.inspector_version===INSPECTOR_VERSION&&u.rights_id===r.id&&u.byte_length===bytes.length&&await byteHash(bytes)===u.asset_sha&&hashJSON(r.cover)===u.cover_sha,'INSPECTION_BINDING');
 const approvedAt=new Date(r.approved_at).toISOString();
 const rightsDecision={decision_id:r.id,asset_sha256:u.asset_sha,cover_sha256:u.cover_sha,approved_by:'https://eliaskalyvas.gr/#person',approved_at:approvedAt,kind:r.cover.kind,template_id:r.cover.template_id};
 await inspectBytesWithRights({cover:r.cover,bytes,rightsDecision,now:new Date().toISOString()});
 return inspectionReport(packet);
}
export async function runPrivateAssetInspection({service,tokenSource,operationId}){
 const handle=await service.claim(await tokenSource(),operationId);
 try{const packet=await service.read(await tokenSource(),handle),report=await inspectClaimedAsset(packet);return await service.finish(await tokenSource(),handle,report);}
 catch(error){try{await service.fail(await tokenSource(),handle);}catch{}throw error;}
}
