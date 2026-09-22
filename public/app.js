const $=s=>document.querySelector(s),app=$('#app');let me=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>t?new Date(t.replace(' ','T')+'Z').toLocaleString():'';
const api=async(u,m='GET',b)=>{const r=await fetch('/api'+u,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||'Something went wrong');return j};
const go=h=>{if(location.pathname!=='/')location.href='/#'+h;else location.hash=h};
const CL=["Custody of the shared Netflix account shall be decided by a coin toss.","All unfinished Ludo games are hereby declared void.","Photos on each other's phones shall be reviewed within 30 days.","Neither party shall like the other's Instagram posts for 90 days.","The last samosa is to be treated as a gift, not property."];
const REPLIES=["I'm not interested.","Let's talk first.","Are you serious right now?","Nice try. Request denied."];

function pad(cv){const x=cv.getContext('2d');let dr=false,dirty=false;
 const clear=()=>{x.fillStyle='#fff';x.fillRect(0,0,cv.width,cv.height);x.lineWidth=2.5;x.lineCap='round';x.strokeStyle='#111';dirty=false};clear();
 const p=e=>{const r=cv.getBoundingClientRect();return[(e.clientX-r.left)*cv.width/r.width,(e.clientY-r.top)*cv.height/r.height]};
 cv.onpointerdown=e=>{dr=dirty=true;cv.setPointerCapture(e.pointerId);const[a,b]=p(e);x.beginPath();x.moveTo(a,b);x.lineTo(a+.1,b);x.stroke()};
 cv.onpointermove=e=>{if(!dr)return;const[a,b]=p(e);x.lineTo(a,b);x.stroke()};cv.onpointerup=cv.onpointercancel=()=>dr=false;
 return{clear,empty:()=>!dirty,data:()=>cv.toDataURL('image/jpeg',.6),load(f){if(!f||!/^image\/(png|jpe?g)$/.test(f.type)||f.size>1e6)return alert('PNG/JPG under 1 MB only.');
  const im=new Image();im.onload=()=>{clear();const s=Math.min(cv.width/im.width,cv.height/im.height);x.drawImage(im,(cv.width-im.width*s)/2,(cv.height-im.height*s)/2,im.width*s,im.height*s);dirty=true};im.src=URL.createObjectURL(f)}}}
const padHTML=id=>`<canvas id="${id}" width="360" height="120"></canvas><div class="row"><button type="button" class="sec" data-c="${id}">Clear</button><label style="margin:0;padding:10px 16px;border:1px solid var(--line);border-radius:8px;cursor:pointer">Upload image<input type="file" accept="image/png,image/jpeg" data-u="${id}" hidden></label></div>`;
const wire=id=>{const p=pad($('#'+id));$(`[data-c=${id}]`).onclick=p.clear;$(`[data-u=${id}]`).onchange=e=>p.load(e.target.files[0]);return p};

const sig=(n,s,t)=>`<div>${/^data:image\/(png|jpeg);base64,/.test(s||'')?`<img alt="signature" src="${s}">`:''}<b>${esc(n)}</b><br><small>${fmt(t)}</small></div>`;
const docHTML=r=>{const x=r.response,st=r.status;return `<div class="doc">${st==='accepted'||st==='rejected'?`<div class="stamp ${st==='accepted'?'a':'r'}">${st.toUpperCase()}</div>`:''}
<h2>${r.type==='divorce'?'Decree of Divorce':'Official Breakup Agreement'}</h2><div class="c">(Not legally binding. Obviously.)</div>
<p>Between <b>${esc(r.sender_name)}</b> ("the Filer") and <b>${esc(r.recipient_name||'the Recipient')}</b>, effective <b>${esc(r.effective_date||'immediately')}</b>.</p>
<p><b>Grounds:</b> ${esc(r.reason)}</p><ol>${r.clauses.map(c=>`<li>${esc(c)}</li>`).join('')}</ol>
<div class="sigs">${sig(r.sender_name,r.sender_sig,r.created_at)}${x?(x.decision==='accepted'?sig(x.name,x.signature,x.signed_at):`<div><b>${esc(x.name)}</b><br><i>Declined:</i> "${esc(x.reply)}"<br><small>${fmt(x.signed_at)}</small></div>`):'<div><small>Awaiting Recipient</small></div>'}</div>
<div class="hash">Document hash (SHA-256): ${esc(r.hash)}</div></div>`};

function authForm(el,cb){let reg=false;const draw=()=>{el.innerHTML=`<div class="card"><b>${reg?'Create account':'Log in'}</b>${reg?'<label>Name</label><input id="an" maxlength="40">':''}<label>Email</label><input id="ae" type="email"><label>Password (8+ chars)</label><input id="ap" type="password"><div class="row"><button id="ag">${reg?'Register':'Log in'}</button><button class="sec" id="at">${reg?'I have an account':'Create account'}</button></div><p class="er" id="err"></p></div>`;
 $('#at').onclick=()=>{reg=!reg;draw()};$('#ag').onclick=async()=>{try{await api(reg?'/register':'/login','POST',{name:reg?$('#an').value:undefined,email:$('#ae').value,password:$('#ap').value});cb()}catch(e){$('#err').textContent=e.message}}};draw()}

async function nav(){let n=0;if(me)try{n=(await api('/notifications')).filter(x=>!x.is_read).length}catch{}
 $('#nav').innerHTML=`<b data-go="/">💔 Paperwork</b>${me?`<a data-go="/new">New</a><a data-go="/history">History${n?` 🔔${n}`:''}</a><a id="lo">Log out (${esc(me.name)})</a>`:`<a data-go="/auth">Log in</a>`}`;
 if(me)$('#lo').onclick=async()=>{await api('/logout','POST');location.href='/'}}

function landing(){app.innerHTML=`<section class="hero"><div class="big">💔</div><h1>It's Not You,<br>It's the Paperwork</h1><p class="sub">File your breakup or divorce the formal way: a signed document, a secret link, and a permanent record.</p>
<button style="font-size:18px;padding:14px 28px" data-go="${me?'/new':'/auth'}">File a breakup →</button><p><small>Free · No lawyers · Definitely not legally binding</small></p></section>
<div class="steps"><div class="card"><b>1. Register &amp; file</b><br><small>Pick the reason and funny clauses.</small></div><div class="card"><b>2. Sign first</b><br><small>No signature, no link.</small></div><div class="card"><b>3. Send the link</b><br><small>They must log in to respond.</small></div><div class="card"><b>4. Verdict</b><br><small>Sign to accept or reject with a reply. Both keep history.</small></div></div>`}

function authView(){app.innerHTML=`<h1>Welcome</h1><p class="sub">Log in or create an account.</p><div id="af"></div>`;authForm($('#af'),()=>go('/history'))}

function newView(){app.innerHTML=`<h1>New request</h1><p class="sub">You sign first, then get your invite link.</p><div class="card"><label>Type</label><select id="t"><option value="breakup">Breakup</option><option value="divorce">Divorce</option></select>
<label>Reason</label><textarea id="r" maxlength="300" placeholder="e.g. Irreconcilable differences over pizza toppings"></textarea><label>Effective date</label><input id="e" type="date">
<label>Funny clauses</label>${CL.map((c,i)=>`<label class="cl"><input type="checkbox" class="ck" checked value="${i}"> ${esc(c)}</label>`).join('')}<input id="cx" maxlength="150" placeholder="Add your own clause (optional)">
<label>Your signature</label>${padHTML('p1')}<div class="row"><button id="go">Sign &amp; generate link</button></div><p class="er" id="err"></p></div>`;
 const p=wire('p1');$('#go').onclick=async()=>{if(p.empty())return $('#err').textContent='Please sign first.';
  const c=[...document.querySelectorAll('.ck:checked')].map(k=>CL[k.value]);if($('#cx').value.trim())c.push($('#cx').value.trim());
  try{const r=await api('/requests','POST',{type:$('#t').value,reason:$('#r').value,clauses:c,effective_date:$('#e').value,signature:p.data()});detail(r.id,r.link)}catch(e){$('#err').textContent=e.message}}}

async function history(){const[l,n]=await Promise.all([api('/requests'),api('/notifications')]);
 app.innerHTML=`<h1>History</h1>${n.length?`<div class="card"><b>Notifications</b>${n.slice(0,5).map(x=>`<div class="note ${x.is_read?'':'n'}" data-detail="${x.request_id}">${esc(x.message)}<br><small>${fmt(x.created_at)}</small></div>`).join('')}</div>`:''}
 ${l.length?l.map(r=>`<div class="card item" data-detail="${r.id}"><div><b>${r.type==='divorce'?'Divorce':'Breakup'} ${r.role==='sent'?'→':'←'} ${esc(r.other)}</b><br><small>${r.role} · ${fmt(r.created_at)}</small></div><span class="tag ${r.status}">${r.status}</span></div>`).join(''):'<p class="sub">Nothing here yet.</p>'}<p class="np"><button class="sec" data-del>Delete my account</button></p>`;
 if(n.some(x=>!x.is_read))api('/notifications/read','POST').then(nav)}

async function detail(id,link){const r=await api('/requests/'+id);
 app.innerHTML=`${link?'<h1>Filed ✍️</h1><p class="sub">Send this link to them. They must log in to respond.</p>':''}${r.token&&r.status==='pending'?`<div class="card np"><b>Invite link</b><div class="link" id="lk">${esc(link||location.origin+'/r/'+r.token)}</div><div class="row"><button id="cp">Copy link</button><button class="sec" id="wd">Withdraw</button></div></div>`:''}${docHTML(r)}<div class="row np"><button data-print>Print / Save PDF</button><button class="sec" data-go="/history">History</button></div>`;
 if($('#cp')){$('#cp').onclick=async e=>{await navigator.clipboard.writeText($('#lk').textContent);e.target.textContent='Copied ✓'};$('#wd').onclick=async()=>{if(confirm('Withdraw this request?')){await api(`/requests/${id}/withdraw`,'POST');detail(id)}}}}

async function invite(tok){let r;try{r=await api('/invite/'+tok)}catch(e){return app.innerHTML=`<h1>Oops</h1><p class="sub">${esc(e.message)}</p>`}
 app.innerHTML=`<h1>📜 You've been served</h1><p class="sub">${esc(r.sender_name)} has filed a ${r.type} request.</p>${docHTML(r)}<div id="act"></div>`;const act=$('#act');
 if(r.status!=='pending')return act.innerHTML=`<div class="card">This request is already <b>${r.status}</b>.</div>`;
 if(!me){act.innerHTML='<p class="sub">Log in or register to respond. This link will bring you right back here.</p><div id="af"></div>';return authForm($('#af'),route)}
 act.innerHTML=`<div class="card np"><b>Your response</b><div class="row"><button class="ok" id="acc">Accept</button><button id="rej">Reject</button></div><div id="pane"></div><p class="er" id="err"></p></div>`;
 const send=async(d,b)=>{try{const x=await api(`/invite/${tok}/${d}`,'POST',b);detail(x.id)}catch(e){$('#err').textContent=e.message}};
 $('#acc').onclick=()=>{$('#pane').innerHTML=`<label>Sign here to accept</label>${padHTML('p2')}<div class="row"><button class="ok" id="sg">Sign &amp; accept</button></div>`;const p=wire('p2');$('#sg').onclick=()=>p.empty()?$('#err').textContent='Please sign.':send('accept',{signature:p.data()})};
 $('#rej').onclick=()=>{$('#pane').innerHTML=`<label>Pick a reply or write your own</label><div class="row">${REPLIES.map(x=>`<button class="sec ch">${esc(x)}</button>`).join('')}</div><textarea id="m" maxlength="200" style="margin-top:8px"></textarea><div class="row"><button id="sr">Send rejection</button></div>`;
  document.querySelectorAll('.ch').forEach(b=>b.onclick=()=>$('#m').value=b.textContent);$('#sr').onclick=()=>send('reject',{reply:$('#m').value})}}

async function route(){try{me=(await api('/me')).user}catch{me=null}nav();
 const m=location.pathname.match(/^\/r\/(\w+)/);if(m)return invite(m[1]);
 const h=location.hash.slice(1)||'/';if(h==='/')return landing();if(h==='/auth')return authView();if(!me)return authView();
 if(h==='/new')return newView();if(h==='/history')return history();const d=h.match(/^\/request\/(\d+)/);d?detail(d[1]):landing()}
addEventListener('hashchange',route);route();

document.addEventListener('click',async e=>{const t=e.target.closest('[data-go],[data-detail],[data-print],[data-del]');if(!t)return;const d=t.dataset;
 if('go' in d)go(d.go);else if('detail' in d)detail(d.detail);else if('print' in d)print();
 else if('del' in d&&confirm('Delete your account? Your name and email are removed and pending requests are withdrawn. Signed agreements stay visible to the other party.')){await api('/me','DELETE');location.href='/'}});
addEventListener('unhandledrejection',e=>{app.innerHTML='<h1>Oops</h1><p class="sub">'+esc(e.reason&&e.reason.message||'Something went wrong')+'</p>'});
