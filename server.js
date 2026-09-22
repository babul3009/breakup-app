const express = require('express'), Database = require('better-sqlite3'), bcrypt = require('bcryptjs'),
  jwt = require('jsonwebtoken'), crypto = require('crypto'), cookieParser = require('cookie-parser'),
  rateLimit = require('express-rate-limit'), helmet = require('helmet'), path = require('path');

if (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET || '').length < 32) { console.error('FATAL: set JWT_SECRET (32+ chars) in production'); process.exit(1); }
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const db = new Database(process.env.DB_FILE || 'data.db');
db.pragma('journal_mode=WAL'); db.pragma('foreign_keys=ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS requests(id INTEGER PRIMARY KEY, sender_id INTEGER NOT NULL REFERENCES users(id), recipient_id INTEGER REFERENCES users(id),
  token TEXT UNIQUE NOT NULL, type TEXT NOT NULL, reason TEXT NOT NULL, clauses TEXT NOT NULL, effective_date TEXT, sender_sig TEXT NOT NULL,
  sender_ip TEXT, doc_hash TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS responses(id INTEGER PRIMARY KEY, request_id INTEGER UNIQUE NOT NULL REFERENCES requests(id), decision TEXT NOT NULL,
  reply TEXT, signature TEXT, ip TEXT, signed_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), request_id INTEGER, message TEXT,
  is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'blob:'], objectSrc: ["'none'"], frameAncestors: ["'none'"], baseUri: ["'self'"], formAction: ["'self'"],
  upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null } } }));
app.use(express.json({ limit: '600kb' }), cookieParser());
app.use('/api', rateLimit({ windowMs: 60e3, max: 120 }), (q, s, n) => {
  s.set('Cache-Control', 'no-store');
  if (!['GET', 'HEAD'].includes(q.method)) { // CSRF defence: SameSite cookie + same-origin check
    try { const o = q.get('origin'); if (o && new URL(o).host !== q.get('host')) return s.status(403).json({ error: 'Bad origin' }) }
    catch { return s.status(403).json({ error: 'Bad origin' }) }
  }
  n();
});
const lim = rateLimit({ windowMs: 15 * 60e3, max: 20, message: { error: 'Too many attempts. Try again later.' } });
const DUMMY = bcrypt.hashSync('dummy-password', 12);
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const okSig = s => { // real PNG/JPEG only, checked by magic bytes
  if (typeof s !== 'string' || s.length > 400000) return false;
  const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(s); if (!m) return false;
  const b = Buffer.from(m[2].slice(0, 16), 'base64');
  return m[1] === 'png' ? b[0] === 0x89 && b[1] === 0x50 : b[0] === 0xff && b[1] === 0xd8;
};
const wrap = f => (q, s, n) => { try { f(q, s, n) } catch (e) { console.error(e); s.status(500).json({ error: 'Server error' }) } };
const auth = (q, s, n) => { try { const id = jwt.verify(q.cookies.t, SECRET).id; if (!db.prepare("SELECT 1 FROM users WHERE id=? AND password_hash!='!'").get(id)) throw 0; q.uid = id; n() } catch { s.status(401).json({ error: 'Login required' }) } };
const setCookie = (s, id) => s.cookie('t', jwt.sign({ id }, SECRET, { expiresIn: '7d' }),
  { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 6048e5 });

// ---------- Auth ----------
app.post('/api/register', lim, wrap((q, s) => {
  const { name, email, password } = q.body;
  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 72)
    return s.status(400).json({ error: 'Name, valid email and 8+ character password required' });
  const em = email.toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(em)) return s.status(409).json({ error: 'Email already registered' });
  const id = db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name.trim().slice(0, 40), em, bcrypt.hashSync(password, 12)).lastInsertRowid;
  setCookie(s, id); s.json({ ok: true });
}));
app.post('/api/login', lim, wrap((q, s) => {
  const { email, password } = q.body;
  const u = typeof email === 'string' ? db.prepare('SELECT * FROM users WHERE email=?').get(email.toLowerCase()) : null;
  const okPw = bcrypt.compareSync(typeof password === 'string' ? password : '', u ? u.password_hash : DUMMY); // no user-enumeration timing
  if (!u || !okPw) return s.status(401).json({ error: 'Wrong email or password' });
  setCookie(s, u.id); s.json({ ok: true });
}));
app.post('/api/logout', (q, s) => { s.clearCookie('t'); s.json({ ok: true }) });
app.get('/api/me', wrap((q, s) => {
  try { const u = db.prepare('SELECT id,name,email FROM users WHERE id=?').get(jwt.verify(q.cookies.t, SECRET).id); s.json({ user: u || null }) }
  catch { s.json({ user: null }) }
}));

app.delete('/api/me', auth, wrap((q, s) => { // privacy: anonymise account, keep the other party's signed copy intact
  db.prepare("UPDATE requests SET status='withdrawn' WHERE sender_id=? AND status='pending'").run(q.uid);
  db.prepare("UPDATE users SET name='Deleted user', email='deleted-'||id||'@invalid', password_hash='!' WHERE id=?").run(q.uid);
  db.prepare('DELETE FROM notifications WHERE user_id=?').run(q.uid);
  s.clearCookie('t'); s.json({ ok: true });
}));

// ---------- Requests ----------
const SEL = `SELECT r.*, us.name sname, ur.name rname FROM requests r JOIN users us ON us.id=r.sender_id LEFT JOIN users ur ON ur.id=r.recipient_id`;
const shape = r => ({ type: r.type, reason: r.reason, clauses: JSON.parse(r.clauses), effective_date: r.effective_date,
  sender_name: r.sname, sender_sig: r.sender_sig, created_at: r.created_at, status: r.status, hash: r.doc_hash });

app.post('/api/requests', auth, wrap((q, s) => {
  const { type, reason, clauses, effective_date, signature } = q.body;
  if (!['breakup', 'divorce'].includes(type) || !reason?.trim() || !Array.isArray(clauses) || !okSig(signature))
    return s.status(400).json({ error: 'Invalid request. Your signature is required.' });
  const cl = clauses.slice(0, 12).map(c => String(c).slice(0, 150)), r = reason.trim().slice(0, 300), ed = effective_date || '';
  const token = crypto.randomBytes(24).toString('hex');
  const hash = sha(JSON.stringify({ sender: q.uid, type, r, cl, ed, sig: sha(signature), token }));
  const id = db.prepare('INSERT INTO requests(sender_id,token,type,reason,clauses,effective_date,sender_sig,sender_ip,doc_hash) VALUES(?,?,?,?,?,?,?,?,?)')
    .run(q.uid, token, type, r, JSON.stringify(cl), ed, signature, q.ip, hash).lastInsertRowid;
  s.json({ id, link: `${q.protocol}://${q.get('host')}/r/${token}` });
}));

app.get('/api/requests', auth, wrap((q, s) => s.json(db.prepare(`${SEL} WHERE r.sender_id=@u OR r.recipient_id=@u ORDER BY r.id DESC`).all({ u: q.uid })
  .map(r => ({ id: r.id, type: r.type, status: r.status, created_at: r.created_at, role: r.sender_id === q.uid ? 'sent' : 'received',
    other: r.sender_id === q.uid ? (r.rname || 'Not yet claimed') : r.sname })))));

app.get('/api/requests/:id', auth, wrap((q, s) => {
  const r = db.prepare(`${SEL} WHERE r.id=?`).get(q.params.id);
  if (!r || (r.sender_id !== q.uid && r.recipient_id !== q.uid)) return s.status(404).json({ error: 'Not found' });
  const x = db.prepare('SELECT * FROM responses WHERE request_id=?').get(r.id), mine = r.sender_id === q.uid;
  s.json({ ...shape(r), id: r.id, role: mine ? 'sent' : 'received', recipient_name: r.rname, token: mine ? r.token : undefined,
    response: x ? { name: r.rname, decision: x.decision, reply: x.reply, signature: x.signature, signed_at: x.signed_at } : null });
}));

app.post('/api/requests/:id/withdraw', auth, wrap((q, s) => {
  const n = db.prepare(`UPDATE requests SET status='withdrawn' WHERE id=? AND sender_id=? AND status='pending'`).run(q.params.id, q.uid).changes;
  n ? s.json({ ok: true }) : s.status(409).json({ error: 'Cannot withdraw this request' });
}));

app.param('token', (q, s, n, t) => /^[a-f0-9]{48}$/.test(t) ? n() : s.status(404).json({ error: 'Invalid or expired link' }));
// ---------- Invite link (public preview, login-gated response) ----------
app.get('/api/invite/:token', wrap((q, s) => {
  const r = db.prepare(`${SEL} WHERE r.token=?`).get(q.params.token);
  r ? s.json(shape(r)) : s.status(404).json({ error: 'Invalid or expired link' });
}));

const respond = decision => wrap((q, s) => {
  const sig = q.body.signature, reply = (q.body.reply || '').trim().slice(0, 200);
  if (decision === 'accepted' && !okSig(sig)) return s.status(400).json({ error: 'Signature required' });
  if (decision === 'rejected' && !reply) return s.status(400).json({ error: 'Reply required' });
  const tx = db.transaction(() => {
    const r = db.prepare('SELECT * FROM requests WHERE token=?').get(q.params.token);
    if (!r) return [404, 'Not found'];
    if (r.sender_id === q.uid) return [403, 'You cannot respond to your own request'];
    if (r.status !== 'pending') return [409, `This request is already ${r.status}`];
    if (r.recipient_id && r.recipient_id !== q.uid) return [403, 'This request belongs to someone else'];
    db.prepare('UPDATE requests SET recipient_id=?, status=? WHERE id=?').run(q.uid, decision, r.id); // claim + decide atomically
    db.prepare('INSERT INTO responses(request_id,decision,reply,signature,ip) VALUES(?,?,?,?,?)').run(r.id, decision, reply, decision === 'accepted' ? sig : null, q.ip);
    const me = db.prepare('SELECT name FROM users WHERE id=?').get(q.uid).name;
    db.prepare('INSERT INTO notifications(user_id,request_id,message) VALUES(?,?,?)').run(r.sender_id, r.id,
      `${me} ${decision === 'accepted' ? 'accepted and signed' : 'rejected'} your ${r.type} request` + (decision === 'rejected' ? `: "${reply}"` : ''));
    return [200, r.id];
  });
  const [c, v] = tx();
  c === 200 ? s.json({ id: v }) : s.status(c).json({ error: v });
});
app.post('/api/invite/:token/accept', auth, respond('accepted'));
app.post('/api/invite/:token/reject', auth, respond('rejected'));

// ---------- Notifications ----------
app.get('/api/notifications', auth, wrap((q, s) => s.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 20').all(q.uid))));
app.post('/api/notifications/read', auth, wrap((q, s) => { db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(q.uid); s.json({ ok: true }) }));

app.use(express.static(path.join(__dirname, 'public')));
app.get('/r/:t', (q, s) => s.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/healthz', (q, s) => s.json({ ok: true }));
app.use('/api', (q, s) => s.status(404).json({ error: 'Not found' }));
app.use((e, q, s, n) => { const c = e.status >= 400 && e.status < 500 ? e.status : 500; if (c === 500) console.error(e); s.status(c).json({ error: c === 500 ? 'Server error' : 'Bad request' }) });
if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('Running on port ' + (process.env.PORT || 3000)));
module.exports = app;
