# Marketplace backend

The Next.js marketplace backend uses a local SQLite file for development and supports hosted libSQL for Vercel. Its seller accounts, listings and PayPal orders are independent of the WordPress marketplace.

## Run

Use Node 24. `npm run dev` serves the application; `npm run build -- --webpack` builds the server application, and `npm start` serves it. The seller workspace is `/account`. Native SQLite stores records and re-encoded photo bytes in `work/backend/marketplace.sqlite`; preserve this database and its WAL when backing up a running instance. Stop the process before copying only the main database file.

The app now requires a Next.js server; static export was removed. On Vercel, use the Next.js framework preset and clear any legacy `out` output-directory override.

Account and draft features run without credentials. PayPal checkout requires sandbox configuration. `MARKETPLACE_DB_PATH` optionally overrides the database location. `APP_ORIGIN` can set the canonical mutation origin when running behind a trusted proxy. Without it, mutations must match the request's protocol and Host. Vercel requires a hosted database and refuses to fall back to local disk. The Turso integration supplies `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The pair `MARKETPLACE_DATABASE_URL` and `MARKETPLACE_DATABASE_TOKEN` can explicitly select a different database.

## Boundaries

- `store.ts`: database initialization and local connection lifecycle. No files or secrets under `public`.
- `service.ts`: authentication, ownership, validation, listing transitions, enquiries and persistence operations. SQL stays server-side and uses bound parameters.
- `app/api/marketplace/[...path]/route.ts`: request size limits, origin checks, HTTP-only session cookies, image validation/re-encoding and error responses.
- `lib/listing-packages.ts`: shared package definitions and server-side fee calculation in integer pence.
- `/account`: registration, login/logout, listing editor, photo management and seller enquiry inbox.

Sessions use random opaque tokens; only token hashes are stored. Passwords use salted scrypt hashes. Email addresses are not verified at this stage. Persistent request counters provide basic local rate limiting, not a substitute for edge abuse protection at launch. Photos accept JPEG, PNG and WebP up to 4 MB and 24 megapixels, strip metadata and are served only to the owner while unpublished.

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
4. Register `/api/marketplace/paypal/webhook` on the same PayPal app for `CHECKOUT.ORDER.APPROVED`, `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED` and `CUSTOMER.DISPUTE.CREATED`. Use the sandbox buyer account to exercise the redirect and webhook, including a buyer who closes the tab after approving payment.
5. Confirm the captured GBP amount, public listing and seller enquiry inbox. Confirm that only one publication email was queued.

## Vercel preview setup

1. Create a hosted libSQL database, such as Turso, for preview testing. Use the Vercel Turso integration or set `MARKETPLACE_DATABASE_URL` to the TLS database URL and `MARKETPLACE_DATABASE_TOKEN` to a database-scoped token with write access. The backend initializes missing schema objects when it first connects.
2. Set `APP_ORIGIN` to the stable preview origin. Register the PayPal sandbox webhook against that origin and configure the matching sandbox credentials for the preview environment. PayPal needs an HTTPS endpoint it can reach.
3. Use an isolated database for production and set its own payment and email configuration. Preview and production must use different credentials and databases.

## Before production

1. Decide whether to migrate any local accounts, listings and images. Import into an empty database using a libSQL-compatible SQLite dump, or start with an empty production database.
2. If existing WordPress inventory will be migrated, establish its seller ownership before import. The existing source catalogue entries retain their existing contact paths.
3. Confirm seller verification, account recovery and listing terms. Checkout replaces orders PayPal reports as voided and reconciles already-approved orders. Refunds, reversals and disputes withdraw affected listings and appear in the operator portal. Operators reconcile any reinstatement after reviewing the PayPal case.
4. After sandbox verification, configure the intended live PayPal merchant and webhook in the hosting project’s server-side environment.

## Verification

`npm run test:backend` checks fee boundaries, invalid inputs, authentication/session expiry, ownership, photos, payment holding state, enquiries and rate limits. Run on an isolated database. Tests cover the local libSQL driver, an existing SQLite file, and mocked PayPal and email responses. Run a sandbox checkout before enabling live payments.
