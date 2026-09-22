const test = require('node:test'), assert = require('node:assert');
process.env.DB_FILE = ':memory:'; process.env.JWT_SECRET = 'test-secret-test-secret-test-secret-1234';
const app = require('../server');
const SIG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA';
let base, srv;
const call = async (path, { cookie, body, method } = {}) => {
  const r = await fetch(base + '/api' + path, { method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(cookie && { cookie }) }, body: body && JSON.stringify(body) });
  const c = r.headers.get('set-cookie');
  return { status: r.status, json: await r.json(), cookie: c && c.split(';')[0] };
};
test.before(() => new Promise(r => { srv = app.listen(0, () => { base = 'http://localhost:' + srv.address().port; r() }) }));
test.after(() => srv.close());

test('sign, claim, respond and privacy rules', async () => {
  const reg = (n) => call('/register', { body: { name: n, email: n + '@x.com', password: 'password1' } });
  const [a, b, c] = [await reg('a'), await reg('b'), await reg('c')];
  assert.equal((await call('/requests', { cookie: a.cookie, body: { type: 'breakup', reason: 'r', clauses: [], signature: 'data:image/png;base64,AAAA' } })).status, 400, 'fake signature rejected');
  const r = await call('/requests', { cookie: a.cookie, body: { type: 'breakup', reason: 'r', clauses: ['c'], signature: SIG } });
  const tok = r.json.link.split('/r/')[1];
  assert.equal((await call(`/invite/${tok}`)).status, 200, 'public preview');
  assert.equal((await call(`/invite/${tok}/accept`, { body: { signature: SIG } })).status, 401, 'login required');
  assert.equal((await call(`/invite/${tok}/accept`, { cookie: a.cookie, body: { signature: SIG } })).status, 403, 'sender cannot respond');
  assert.equal((await call(`/requests/${r.json.id}`, { cookie: c.cookie })).status, 404, 'outsider cannot read');
  assert.equal((await call(`/invite/${tok}/accept`, { cookie: b.cookie, body: { signature: SIG } })).status, 200);
  assert.equal((await call(`/invite/${tok}/reject`, { cookie: c.cookie, body: { reply: 'no' } })).status, 409, 'already decided');
  assert.equal((await call(`/requests/${r.json.id}`, { cookie: a.cookie })).json.status, 'accepted');
  assert.equal((await call('/notifications', { cookie: a.cookie })).json.length, 1);
  assert.equal((await call('/me', { cookie: b.cookie, method: 'DELETE' })).status, 200);
  assert.equal((await call('/requests', { cookie: b.cookie })).status, 401, 'deleted account is locked out');
});
