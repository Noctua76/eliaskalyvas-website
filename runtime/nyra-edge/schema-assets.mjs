// Immutable v1.1 static-asset inventory. This guards the Edge package boundary;
// it does not replace JSON Schema/Ajv validation or provide fallback schemas.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const schemaAssetSHA256=Object.freeze({
 shared:'69e70b78f4ad009f31416f1ea192ed93a4b869a0ae00bc5aba8427d2fd8e7544',
 release:'b7d0314e8b85f7c07922c6b8f85f5270a0592da4bce38305a2779d79d0258c82',
 manifest:'2aa64cedc76473d55041905bcdee1eedeaeb1a32f8d6f4b117cdc101c197ff50',
 event:'7ace3743e10232b38019e2d6659534184f421033a8fcb2bf3d0b93eaf9bd11b3',
 receipt:'f486a88fc6281f76df60f1efc1ae12c7d56a8f808e6a35be0ee1e971f7e13174',
 dataset:'79848acf96be5efe3569774c4bb5ddd33f069d99725997bcfb851123e8484378'
});
export function verifySchemaAssets(){
 for(const [name,expected]of Object.entries(schemaAssetSHA256)){
  const bytes=readFileSync(new URL('../../contracts/nyra-publication/v1.1/'+name+'.schema.json',import.meta.url));
  if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('EDGE_SCHEMA_INTEGRITY:'+name);
 }
}
