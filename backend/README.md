# Local marketplace backend

The Next.js marketplace backend currently runs with local SQLite. Its seller accounts, listings and PayPal orders are independent of the WordPress marketplace.

## Run

Use Node 24. `npm run dev` serves the application; `npm run build -- --webpack` builds the server application, and `npm start` serves it. The seller workspace is `/account`. Native SQLite stores records and re-encoded photo bytes in `work/backend/marketplace.sqlite`; preserve this database and its WAL when backing up a running instance. Stop the process before copying only the main database file.

The app now requires a Next.js server; static export was removed. Before a later Vercel deployment, clear any legacy `out` output-directory override and use the Next.js framework preset.

Account and draft features run without credentials. PayPal checkout requires sandbox configuration. `MARKETPLACE_DB_PATH` optionally overrides the database location. `APP_ORIGIN` can set the canonical mutation origin when running behind a trusted proxy. Without it, mutations must match the request's protocol and Host. Do not use this local adapter on Vercel: `getStore()` deliberately refuses that runtime, since ephemeral disk is not durable account storage.

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
| POST | listings/:id/checkout, listings/:id/capture | Start PayPal checkout and reconcile the seller’s return |
| POST | paypal/webhook | Verify PayPal signatures and process approvals and completed captures |
| GET | operator/listings | Inspect live paid listings and their authenticity flags |
| POST | notifications/retry | Retry up to ten queued publication emails with a bearer secret |
| POST | enquiries/:listingId | Store buyer enquiry for a live listing |
| POST | contact | Store a general contact record (UI still prepares email) |

Saved drafts require at least one photo before submission. The server derives the GBP fee from the asking price. Checkout holds the listing and its quote in place. A verified and matching completed PayPal capture publishes the listing for its package duration in the Next.js shop. In the same transaction the app queues one email to info@buyandselllasers.com and az@wiwy.com. The operator portal flags matching make, model and location and missing service or ownership history for follow-up. No OpenAI credentials are required for this workflow.

## Local operator and PayPal sandbox setup

1. Run the app and create the operator’s account in `/account`. Confirm control of that account before granting access. In the local database, look up its ID with `SELECT id, email FROM users;`, then provision that exact ID with a parameterized `INSERT INTO listing_operators(user_id) VALUES (?);`. Remove the grant with `DELETE FROM listing_operators WHERE user_id=?;`. Sign in and open `/operator`.
2. Set `APP_ORIGIN` to the HTTPS origin used for both the seller’s browser and the PayPal webhook. Point a test HTTPS reverse proxy at the local app. Set `PAYPAL_MODE=sandbox` and provide `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MERCHANT_ID` and `PAYPAL_WEBHOOK_ID` via server-side environment configuration.
3. Configure `RESEND_API_KEY` and `MARKETPLACE_EMAIL_FROM` with a verified sender. PayPal webhook retries can reattempt a queued email after a delivery error. To retry manually, send a bearer token matching `MARKETPLACE_NOTIFICATION_SECRET` to `POST /api/marketplace/notifications/retry`. For sandbox tests, mock email delivery or leave the sender unconfigured to avoid notifying the production recipients.
4. Register `/api/marketplace/paypal/webhook` on the same PayPal app for `CHECKOUT.ORDER.APPROVED` and `PAYMENT.CAPTURE.COMPLETED`. Use the sandbox buyer account to exercise the redirect and webhook, including a buyer who closes the tab after approving payment.
5. Confirm the captured GBP amount, public listing and seller enquiry inbox. Confirm that only one publication email was queued.

## Before production

1. Replace local SQLite with a durable hosted database and migrate any accounts, listings and images that should carry over. The Vercel deployment currently blocks the local persistence adapter.
2. If existing WordPress inventory will be migrated, establish its seller ownership before import. The existing source catalogue entries retain their existing contact paths.
3. Confirm seller verification, account recovery, refund, reversal, dispute and checkout-expiry handling, and the listing terms before accepting live payments. The current checkout retains its original PayPal order for retries, so expired orders require intervention.
4. After sandbox verification, configure the intended live PayPal merchant and webhook in the hosting project’s server-side environment.

## Verification

`npm run test:backend` checks fee boundaries, invalid inputs, authentication/session expiry, ownership, photos, payment holding state, enquiries and rate limits. Run on an isolated database. Payment tests mock PayPal responses. Run a sandbox checkout before enabling live payments.
