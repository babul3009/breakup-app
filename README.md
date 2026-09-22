# 💔 It's Not You, It's the Paperwork

File a breakup or divorce the formal way: sign a funny mock-legal agreement, send a secret link, and let the other person accept (with a signature) or reject (with a reply). Both people keep a permanent history.

## How it works
1. **A** registers, fills the request and **signs first**. The server stores the signature and a SHA-256 document hash and returns a secret invite link (`/r/<token>`).
2. **B** opens the link, reads the document, and must **register or log in** to respond.
3. B **accepts** (draws or uploads a signature) or **rejects** (quick or custom reply). The first logged-in user to respond claims the request in one atomic transaction. Nobody else can answer it, and A cannot answer their own.
4. A gets a **notification**. Both see it in **History**; only they can open the full document.

## Run locally
```bash
npm install
JWT_SECRET=$(openssl rand -hex 32) npm start   # http://localhost:3000
npm test
```

## Deploy (Render)
1. Push to GitHub, then create a **Blueprint** on Render from `render.yaml`. It sets `NODE_ENV=production`, generates `JWT_SECRET` and mounts a disk at `/var/data` for the SQLite file.
2. Persistent disks need a paid instance. On a free tier the database resets on every deploy, so use it for demos only.
3. Edit the contact line in `public/legal.html` before going live.

## Security
- Passwords hashed with bcrypt (cost 12), with constant-time login checks and no user enumeration
- JWT in an httpOnly, SameSite=Lax, Secure (production) cookie; deleted accounts are locked out immediately
- CSRF: SameSite cookie plus same-origin check on every state-changing request
- Helmet headers and a strict CSP (`script-src 'self'`, no inline scripts, `frame-ancestors 'none'`)
- Rate limits: 120 requests per minute per IP on the API, and 20 attempts per 15 minutes on register and login
- Signatures validated as real PNG/JPEG by magic bytes with a size cap; all output HTML-escaped
- Invite tokens are 192-bit random; the app refuses to start in production without a strong `JWT_SECRET`
- Account deletion anonymises the user (GDPR-style); the Terms & Privacy page is in `public/legal.html`

**Known limits:** invite tokens are stored in plain text (hash them if you need to defend against a DB leak), there is no email verification or password reset yet, and SQLite suits a single instance only.

## API
| Route | Auth | Purpose |
|---|---|---|
| POST `/api/register`, `/login`, `/logout` | – | Accounts |
| GET / DELETE `/api/me` | user | Current user / delete account |
| POST `/api/requests` | user | File and sign, get the invite link |
| GET `/api/requests`, `/api/requests/:id` | participant | History and full document |
| POST `/api/requests/:id/withdraw` | sender | Cancel while pending |
| GET `/api/invite/:token` | public | Read-only preview |
| POST `/api/invite/:token/accept` or `/reject` | user (not sender) | Claim and respond |
| GET/POST `/api/notifications`, `/read` | user | Notification feed |

## Roadmap
Email verification and notifications, password reset, server-side PDF export, Postgres.

MIT licensed. *Not legally binding. Obviously.*
