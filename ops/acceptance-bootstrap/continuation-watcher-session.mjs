// Next-host offline adaptor: a 14-day machine is NOT a 14-day authorization.
// Each watcher session is a fresh <=24h window, bound to one intact host proposal.
// No GitHub API calls, dispatch, service installation, or authority is granted here.
import {validateSession} from './continuation-lifetime.mjs';
const need=(ok,code)=>{if(!ok)throw Error('WATCHER_SESSION_'+code);};
const exactUTC=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&
 Number.isFinite(Date.parse(v))&&new Date(Date.parse(v)).toISOString()===v;
const HEX40=/^[a-f0-9]{40}$/;
export function proposeWatcherSession({lifetime,sessionStartsAt,sessionEndsAt,sourceSHA,now=Date.now}){
 need(exactUTC(sessionStartsAt)&&exactUTC(sessionEndsAt),'UTC_FORMAT');
 need(typeof sourceSHA==='string'&&HEX40.test(sourceSHA),'SOURCE_PIN');
 // This validates proposal digest, one-day maximum, host boundaries, and fresh session.
 validateSession({lifetime,sessionStart:sessionStartsAt,sessionEnd:sessionEndsAt,now});
 need(Date.parse(sessionEndsAt)-now()>=5*60*1000,'MIN_REMAINING_5_MINUTES');
 return Object.freeze({
  schema:'nyra.acceptance.continuation.watcher-session.proposal.v1',
  bootstrapId:lifetime.bootstrapId,
  hostProposalSHA256:lifetime.proposalSHA256,
  callerSHA:sourceSHA,
  windowStartsAt:sessionStartsAt,
  windowEndsAt:sessionEndsAt,
  status:'REQUIRES_FRESH_INDEPENDENT_AUTHORIZATION',
  authorization:false,
  ownerMFAValidated:false,
  dispatchAllowed:false,
  registrationAllowed:false
 });
}
