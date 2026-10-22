import {demoArticles} from './data.mjs';
// Replace this adapter with an approved-publication source in a future task.
// Deliberately no dependency on Admin, Supabase, Nyra Lab or internal draft data.
export function getPublicArticles({lang,preview=false}){
 return preview?demoArticles.filter(a=>a.lang===lang):[];
}
