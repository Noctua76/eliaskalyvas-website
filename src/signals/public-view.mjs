// Browser-safe, lossless projection of an already validated PUBLIC dataset.
// Validation is not authorization; this module never acquires or approves releases.
import {topics} from './model.mjs';
export function publicViews(dataset){
 return dataset.releases.map(r=>({
  id:r.article_id,slug:r.slug,lang:r.locale,status:'published',featured:false,
  title:r.content.title,intro:r.content.summary,format:r.format==='essay'?'Signal Essay':'Signal',
  topics:r.presentation.topic_ids,labels:r.presentation.topic_ids.map(id=>topics[id][r.locale]).join(' · '),
  body:r.content.blocks,sources:r.content.sources,hashtags:r.presentation.hashtags.map(t=>t.slice(1)),
  disclosure:r.identity.disclosure,publishedAt:r.release.first_published_at,updatedAt:r.release.modified_at,
  relatedIds:r.presentation.related_article_ids,
  image:{url:r.presentation.cover.url,alt:r.presentation.cover.alt,width:r.presentation.cover.width,height:r.presentation.cover.height,focus:'center',caption:r.presentation.cover.caption,creator:r.presentation.cover.attribution.creator,license:r.presentation.cover.attribution.license_name,sourceUrl:r.presentation.cover.attribution.source_url,licenseUrl:r.presentation.cover.attribution.license_url},
  social:{title:r.presentation.social_title,description:r.presentation.social_description,canonical:r.canonical_url,image:r.presentation.cover.url},
  translations:Object.fromEntries([[r.locale,r.slug],...r.approved_translation_relations.flatMap(rel=>{
   const other=dataset.releases.find(x=>x.article_id===rel.article_id&&x.variant_id===rel.variant_id&&x.locale===rel.locale);
   return other?[[other.locale,other.slug]]:[];
  })]),
 }));
}
