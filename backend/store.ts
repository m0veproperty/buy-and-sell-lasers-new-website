import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import {dirname,resolve} from 'node:path';

/** Local adapter. Replace this boundary with durable hosted storage before deployment. */
export function openStore(filename:string) {
  if (filename!==':memory:') mkdirSync(dirname(resolve(filename)),{recursive:true});
  const db=new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
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
    CREATE TABLE IF NOT EXISTS listing_operators(user_id TEXT PRIMARY KEY REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS listing_payments(
      listing_id TEXT PRIMARY KEY REFERENCES listings(id),
      request_id TEXT NOT NULL UNIQUE,
      amount_pence INTEGER NOT NULL CHECK(amount_pence > 0),
      paypal_order_id TEXT UNIQUE,
      approval_url TEXT,
      capture_id TEXT UNIQUE
    );
    CREATE TABLE IF NOT EXISTS listing_publication_emails(
      listing_id TEXT PRIMARY KEY REFERENCES listings(id),
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent_at INTEGER,
      provider_id TEXT
    );
    PRAGMA user_version=2;
  `);
  return db;
}

let database:ReturnType<typeof openStore>|undefined;
export function getStore() {
  // Vercel's ephemeral filesystem cannot safely host account or listing data.
  if(process.env.VERCEL) throw new Error('HOSTED_STORAGE_REQUIRED');
  return database??=openStore(process.env.MARKETPLACE_DB_PATH||resolve('work/backend/marketplace.sqlite'));
}
