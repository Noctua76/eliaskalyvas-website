// Reuse the Phase 1 machine-readable asset contract without changing that contract.
import Ajv2020 from 'ajv/dist/2020.js';
import {schemas,isUTC,isPublicHTTPS,canonicalize,ContractError} from './contract.mjs';
const ajv=new Ajv2020({strict:true,coerceTypes:false,useDefaults:false,removeAdditional:false});
ajv.addFormat('nyra-utc',isUTC);ajv.addFormat('nyra-public-https',isPublicHTTPS);ajv.addSchema(schemas.shared);
const check=ajv.getSchema(schemas.shared.$id+'#/$defs/presentation/properties/cover');
export function validateCover(cover){
 canonicalize(cover);
 if(!check(cover))throw new ContractError('INVALID_ASSET_SCHEMA');
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[cover.mime_type];
 if(cover.url!==`https://eliaskalyvas.gr/assets/signals/${cover.sha256}.${ext}`)throw new ContractError('UNCONTROLLED_ASSET');
 if(cover.kind==='editorial_template'?cover.template_id===null||cover.attribution.rights_basis!=='owned':cover.template_id!==null)throw new ContractError('INVALID_TEMPLATE');
 return cover;
}
