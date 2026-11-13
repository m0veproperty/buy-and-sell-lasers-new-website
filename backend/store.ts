import {createClient,type Client,type InValue,type Transaction} from '@libsql/client';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const schema=`
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS session_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS listings(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),data TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','awaiting_payment','pending_review','published','sold','withdrawn','expired')),package_id TEXT,fee_pence INTEGER,expires_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS listing_owner ON listings(owner_id);
    CREATE TABLE IF NOT EXISTS photos(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,bytes BLOB NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS photo_listing ON photos(listing_id);
    CREATE TABLE IF NOT EXISTS enquiries(id TEXT PRIMARY KEY,listing_id TEXT NOT NULL REFERENCES listings(id),name TEXT NOT NULL,email TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS enquiry_listing ON enquiries(listing_id);
    CREATE TABLE IF NOT EXISTS contact_messages(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,topic TEXT NOT NULL,message TEXT NOT NULL,created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rate_limits(key TEXT PRIMARY KEY,hits INTEGER NOT NULL,reset_at INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limits(reset_at);
    CREATE TABLE IF NOT EXISTS listing_operators(user_id TEXT PRIMARY KEY REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS portal_access_attempts(
      id INTEGER PRIMARY KEY CHECK(id=1), failures INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_access_sessions(
      session_hash TEXT PRIMARY KEY, pin_version TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS wordpress_inventory_labels(
      product_id INTEGER PRIMARY KEY,
      label TEXT NOT NULL CHECK(label IN ('genuine','demo','unclassified')),
      note TEXT NOT NULL,
      operator_id TEXT NOT NULL REFERENCES users(id),
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS listing_payments(
      listing_id TEXT PRIMARY KEY REFERENCES listings(id),
      request_id TEXT NOT NULL UNIQUE,
      amount_pence INTEGER NOT NULL CHECK(amount_pence > 0),
      paypal_order_id TEXT UNIQUE,
      approval_url TEXT,
      capture_id TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS listing_payment_incidents(
      event_id TEXT NOT NULL,
      capture_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      received_at INTEGER NOT NULL,
      PRIMARY KEY(event_id,capture_id)
    );
    CREATE INDEX IF NOT EXISTS listing_payment_incident_capture ON listing_payment_incidents(capture_id);
    CREATE TABLE IF NOT EXISTS listing_publication_emails(
      listing_id TEXT PRIMARY KEY REFERENCES listings(id),
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at INTEGER,
      provider_id TEXT
    );
`;

export class Queries {
  private readonly executor:Client|Transaction;
  constructor(executor:Client|Transaction){this.executor=executor;}

  async get<T>(sql:string,...args:InValue[]){
    return (await this.executor.execute({sql,args})).rows[0] as T|undefined;
  }

  async all<T>(sql:string,...args:InValue[]){
    return (await this.executor.execute({sql,args})).rows as T[];
  }

  async run(sql:string,...args:InValue[]){
    return (await this.executor.execute({sql,args})).rowsAffected;
  }
}

export class Store extends Queries {
  private readonly client:Client;
  constructor(client:Client){super(client);this.client=client;}

  async write<T>(operation:(queries:Queries)=>Promise<T>){
    const tx=await this.client.transaction('write');
    try{
      const result=await operation(new Queries(tx));
      await tx.commit();
      return result;
    }finally{
      tx.close();
    }
  }

  close(){this.client.close();}
}

async function initialize(client:Client){
  try{
    await client.executeMultiple(schema);
    return new Store(client);
  }catch(error){
    client.close();
    throw error;
  }
}

export async function openStore(filename:string){
  if(filename!==':memory:')mkdirSync(dirname(resolve(filename)),{recursive:true});
  const client=createClient({url:filename===':memory:'?'file::memory:':pathToFileURL(resolve(filename)).href,
    timeout:5000});
  return initialize(client);
}

let database:Promise<Store>|undefined;
export async function getStore(){
  const hasCustomDatabase=process.env.MARKETPLACE_DATABASE_URL||process.env.MARKETPLACE_DATABASE_TOKEN;
  const url=hasCustomDatabase?process.env.MARKETPLACE_DATABASE_URL:process.env.TURSO_DATABASE_URL;
  const authToken=hasCustomDatabase?process.env.MARKETPLACE_DATABASE_TOKEN:process.env.TURSO_AUTH_TOKEN;
  if((process.env.VERCEL||url||authToken)&&(!url||!authToken||!/^(libsql|https):\/\//.test(url))){
    throw new Error('HOSTED_STORAGE_REQUIRED');
  }
  return database??=(url
    ? initialize(createClient({url,authToken}))
    : openStore(process.env.MARKETPLACE_DB_PATH||resolve('work/backend/marketplace.sqlite'))
  ).catch(error=>{database=undefined;throw error;});
}
