# 💔 It's Not You, It's the Paperwork

File a breakup or divorce the formal way: sign a funny mock-legal agreement, send a secret link, and let the other person accept (with a signature) or reject (with a reply). Both people keep a permanent history.

## How it works
1. **A** registers, fills the request and **signs first**. The server stores the signature and a SHA-256 document hash and returns a secret invite link (`/r/<token>`).
2. **B** opens the link, reads the document, and must **register or log in** to respond.
3. B **accepts** (draws or uploads a signature) or **rejects** (quick or custom reply). The first logged-in user to respond claims the request in one atomic transaction. Nobody else can answer it, and A cannot answer their own.
4. A gets a **notification**. Both see it in **History**; only they can open the full document.
```

