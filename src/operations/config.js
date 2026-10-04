const https=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href.replace(/\/$/,''):'';}catch{return '';}};
export const operationsConfig = {
 apiUrl:https(import.meta.env.VITE_OPERATIONS_API_URL),
 supabaseUrl:https(import.meta.env.VITE_SUPABASE_URL),
 publicKey:import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'',
 turnstileKey:import.meta.env.VITE_TURNSTILE_SITE_KEY||'',
 mentorWebsite:https(import.meta.env.VITE_MY_MENTOR_WEBSITE_URL),
};
export async function request(path,payload,token) {
 if(!operationsConfig.apiUrl)throw new Error('NOT_CONFIGURED');
 const response=await fetch(operationsConfig.apiUrl+path,{method:payload===undefined?'GET':'POST',headers:{Accept:'application/json',...(payload===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:`Bearer ${token}`}:{})},body:payload===undefined?undefined:JSON.stringify(payload),credentials:'omit',signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok||data.error){const e=new Error(data.error||'SERVICE_UNAVAILABLE');e.status=response.status;throw e;}return data;
}
export const bookingPath=(base,lang)=>`${base}${lang==='el'?'gr':'en'}/book/`;
