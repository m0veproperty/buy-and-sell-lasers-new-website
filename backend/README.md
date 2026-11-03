# Local marketplace backend

This implementation is independent of WordPress, Supabase and Stripe. It is a working local backend, not a production service deployment.

## Run

Use Node 24. `npm run dev` serves the application; `npm run build -- --webpack` builds the server application, and `npm start` serves it. The seller workspace is `/account`. Native SQLite stores records and re-encoded photo bytes in `work/backend/marketplace.sqlite`; preserve this database and its WAL when backing up a running instance. Stop the process before copying only the main database file.

The app now requires a Next.js server; static export was removed. Before a later Vercel deployment, clear any legacy `out` output-directory override and use the Next.js framework preset.

No credentials or external services are required. `MARKETPLACE_DB_PATH` optionally overrides the database location. `APP_ORIGIN` can set the canonical mutation origin when running behind a trusted proxy. Without it, mutations must match the request's protocol and Host. Do not use this local adapter on Vercel: `getStore()` deliberately refuses that runtime, since ephemeral disk is not durable account storage.

## Boundaries

- `store.ts`: database initialization and local connection lifecycle. No files or secrets under `public`.
- `service.ts`: authentication, ownership, validation, listing transitions, enquiries and persistence operations. SQL stays server-side and uses bound parameters.
- `app/api/marketplace/[...path]/route.ts`: request size limits, origin checks, HTTP-only session cookies, image validation/re-encoding and error responses.
- `lib/listing-packages.ts`: shared package definitions and server-side fee calculation in integer pence.
- `/account`: registration, login/logout, listing editor, photo management and seller enquiry inbox.

Sessions use random opaque tokens; only token hashes are stored. Passwords use salted scrypt hashes. Email addresses are not verified at this stage. Persistent request counters provide basic local rate limiting, not a substitute for edge abuse protection at launch. Photos accept JPEG, PNG and WebP, enforce byte/pixel limits, strip metadata and are served only to the owner while unpublished.

## Implemented routes

All paths below start with `/api/marketplace/`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | auth/register, auth/login, auth/logout | Account/session lifecycle |
| GET | account | Current seller, their listings and enquiries |
| GET | listings | Public unexpired published records only |
| POST | listings | Create owned draft |
| PATCH | listings/:id | Update owned draft |
| POST | listings/:id/photos | Upload image bytes; authenticated owner |
| DELETE | listings/:id/photos/:photoId | Remove draft photo |
| GET | photos/:id | Private draft or published photo |
| POST | listings/:id/submit | Validate saved draft and hold for payment |
| POST | listings/:id/draft | Return unpaid submission to draft |
| POST | enquiries/:listingId | Store buyer enquiry for a live listing |
| POST | contact | Store a general contact record (UI still prepares email) |

`draft → awaiting_payment` is the only submission transition currently exposed. There is deliberately no payment-success simulation or public publish endpoint. Submissions require a photo and derive the package from the stored asking price. Editing returns an unpaid submission to draft. Draft-editor changes must be saved before submission. The user-supplied owner, fee or state is never trusted.

The existing six catalogue entries remain source examples without local seller ownership. They are not assigned to fabricated accounts; their current source-site handoff remains until real seller ownership/inventory migration is handled. Public database catalogue APIs and enquiries can be tested with isolated published fixtures, but the production catalogue is not yet sourced from them.

## Final integration work

1. Replace the SQLite persistence boundary with the selected durable hosting adapter and migrate data. No provider is chosen or required now.
2. Connect email verification, password recovery and notifications; add retryable delivery records. The current inbox stores enquiries without claiming an email was sent.
3. Connect the chosen listing payment provider. Create payments from the server-derived quote and persist immutable order records. Verify signed payment events, expected amount/currency and listing ownership; deduplicate events transactionally. Only confirmed payments can advance to review. Reconcile refunds/disputes and listing expiry.
4. Add operator moderation and publication, then wire the public catalogue/product pages to approved database records. Decide operator roles explicitly; sellers must not grant themselves those roles.
5. Confirm package/VAT terms and update operator policies for the final processors. Test real account recovery, payment failures/retries and data migration before production.

## Verification

`npm run test:backend` checks fee boundaries, invalid inputs, authentication/session expiry, ownership, photos, payment holding state, enquiries and rate limits. Run on an isolated database. HTTP smoke evidence and screenshots are in `outputs/` for this work session. Browser registration, saved editor, refresh and payment hold were checked; the photo endpoint was tested over HTTP because the automation extension lacks local file access.
