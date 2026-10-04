import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {fixture} from './fixture.mjs';
const {pg}=await fixture();
// Test function permissions/rotation syntax against a test-only Vault API stand-in.
// Hosted Vault encryption itself is explicitly a remaining integration check.
await pg.exec(`create schema vault;create table vault.secrets(id uuid primary key default gen_random_uuid(),name text,secret text);create view vault.decrypted_secrets as select id,name,secret decrypted_secret from vault.secrets;create function vault.create_secret(secret text,name text) returns uuid language plpgsql as $$ declare id uuid;begin insert into vault.secrets(secret,name)values(secret,name)returning secrets.id into id;return id;end $$;create function vault.update_secret(id uuid,secret text)returns void language sql as $$update vault.secrets set secret=$2 where id=$1$$;`);
const migration=(await readFile(new URL('../supabase/migrations/202610040002_calendar_vault.sql',import.meta.url),'utf8')).replace('create extension if not exists supabase_vault with schema vault;','');await pg.exec(migration);
test('calendar token rotation updates one protected secret and grants no anonymous access',async()=>{
 await pg.query('select website_store_calendar_token($1,$2)',['OUTLOOK','test-only-original']);await pg.query('select website_store_calendar_token($1,$2)',['OUTLOOK','test-only-rotated']);assert.equal((await pg.query('select * from vault.secrets')).rows.length,1);const rows=(await pg.query('select * from website_calendar_tokens()')).rows;assert.deepEqual(rows,[{provider:'OUTLOOK',token:'test-only-rotated'}]);
 await pg.exec('set role anon');await assert.rejects(pg.query('select * from website_calendar_tokens()'),/permission denied/);await assert.rejects(pg.query('select * from website_calendar_credentials'),/permission denied/);await pg.exec('reset role');await pg.close();
});
