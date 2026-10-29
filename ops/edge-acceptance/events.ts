// Pinned runtime native shutdown evidence; log no request/response/credential data.
const manager=new globalThis.EventManager();
for await(const data of manager){
 if(data?.event_type==='Shutdown')console.log('EDGE_SHUTDOWN:'+JSON.stringify({type:data.event_type,event:data.event,metadata:data.metadata}));
}
