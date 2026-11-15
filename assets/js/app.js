// CareSlot live demo. Runs fully in the browser with sample data (localStorage).
// In the real build this logic lives on the server (Laravel + MySQL, REST API, bcrypt, real email).
(function () {
  const KEY = 'careslot-demo-v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Math.random().toString(36).slice(2, 9);
  const SLOTS = []; for (let m = 9 * 60; m <= 17 * 60 + 30; m += 30) SLOTS.push(m);
  const hm = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const iso = d => d.toISOString().slice(0, 10);
  const dayAdd = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
  const nice = s => new Date(s + 'T12:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  async function hash(pw, salt) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pw)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }

  let S; // state
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  async function seed() {
    const salt = 'cs';
    const ph = await hash('demo1234', salt);
    const U = (id, role, name, email, extra = {}) => ({ id, role, name, email, phone: '+91 98' + Math.floor(10000000 + Math.random() * 89999999), salt, pass: ph, verified: true, prefs: { reminders: true, doctor: '' }, ...extra });
    S = {
      users: [
        U('c1', 'customer', 'Priya Sharma', 'priya@demo.in'),
        U('c2', 'customer', 'Rahul Mehra', 'rahul@demo.in'),
        U('c3', 'customer', 'Neha Kapoor', 'neha@demo.in'),
        U('d1', 'doctor', 'Dr. Ananya Rao', 'rao@demo.in', { spec: 'Physiotherapy', room: 'Room 2', auto: true, windows: [[600, 750], [960, 1080]] }),
        U('d2', 'doctor', 'Dr. Karan Mehta', 'mehta@demo.in', { spec: 'Sports medicine', room: 'Room 4', auto: true, windows: [[540, 660]] }),
        U('d3', 'doctor', 'Dr. Sana Iqbal', 'iqbal@demo.in', { spec: 'General physician', room: 'Room 1', auto: false, windows: [] }),
        U('t1', 'trainer', 'Vikram Patel', 'vikram@demo.in'),
        U('t2', 'trainer', 'Anjali Verma', 'anjali@demo.in'),
        U('a1', 'admin', 'Clinic Admin', 'admin@demo.in')
      ],
      appts: [
        { id: uid(), c: 'c1', d: 'd1', date: dayAdd(1), t: 630, st: 'Confirmed' },
        { id: uid(), c: 'c2', d: 'd1', date: dayAdd(1), t: 810, st: 'Pending' },
        { id: uid(), c: 'c3', d: 'd2', date: dayAdd(2), t: 570, st: 'Confirmed' },
        { id: uid(), c: 'c2', d: 'd3', date: dayAdd(0), t: 900, st: 'Confirmed' },
        { id: uid(), c: 'c3', d: 'd1', date: dayAdd(-1), t: 600, st: 'Completed' },
        { id: uid(), c: 'c1', d: 'd2', date: dayAdd(3), t: 960, st: 'Cancelled' }
      ],
      tasks: [],
      outbox: [], me: null, view: {}, codes: {}, rr: 0
    };
    const done = S.appts.find(a => a.st === 'Completed');
    S.tasks.push({ id: uid(), a: done.id, tr: 't1', room: 'Room 2', items: checklist().map((t, i) => ({ t, done: i < 2 })), extras: ['Replace resistance bands'], st: 'Open' });
    save();
  }
  const checklist = () => ['Sanitize bed and replace sheet', 'Wipe lamp, cart and handles', 'Restock gloves and gel'];
  const user = id => S.users.find(u => u.id === id);
  const me = () => S.me && user(S.me);

  function mail(to, subject, body) { S.outbox.unshift({ to, subject, body, at: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) }); save(); renderOutbox(); }
  function toast(m) { const t = $('#toast'); $('#toastMsg').textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3000); }

  const busy = (d, date, t, except) => S.appts.some(a => a.d === d && a.date === date && a.t === t && a.id !== except && ['Confirmed', 'Pending'].includes(a.st));
  const inWin = (doc, t) => doc.auto && (doc.windows || []).some(([a, b]) => t >= a && t < b);

  // ---------------- views ----------------
  function render() {
    const u = me();
    $('#who').innerHTML = u ? `<span class="hide-s muted">${esc(u.name)} - ${u.role}</span> <button class="sbtn" data-a="logout">Log out</button>` : `<button class="sbtn" data-a="resetDemo" title="Restore sample data">Reset demo</button>`;
    const app = $('#app');
    if (!u) app.innerHTML = authView();
    else app.innerHTML = { customer: customerView, doctor: doctorView, trainer: trainerView, admin: adminView }[u.role](u);
    const key = (u ? u.role : 'auth') + (S.view.ctab || '') + (S.view.atab || '') + (S.view.auth || '');
    if (key !== render.key && app.firstElementChild) app.firstElementChild.classList.add('reveal');
    render.key = key;
  }

  function authView() {
    const v = S.view.auth || 'in';
    const tabs = `<div class="tabs"><button class="${v === 'in' ? 'on' : ''}" data-a="authTab" data-v="in">Sign in</button><button class="${v === 'up' ? 'on' : ''}" data-a="authTab" data-v="up">Sign up</button><button class="${v === 'forgot' || v === 'newpass' ? 'on' : ''}" data-a="authTab" data-v="forgot">Forgot password</button></div>`;
    let form = '';
    if (v === 'in') form = `<form data-f="signin"><label>Email</label><input name="email" type="email" required autocomplete="username" placeholder="you@example.com"><label>Password</label><input name="pw" type="password" required autocomplete="current-password" placeholder="At least 8 characters"><div class="err" id="err"></div><button class="btn btn-solid mt" style="width:100%;justify-content:center">Sign in</button></form>`;
    if (v === 'up') form = `<form data-f="signup"><label>Full name</label><input name="name" required placeholder="Your name"><label>Email</label><input name="email" type="email" required placeholder="you@example.com"><label>Phone</label><input name="phone" type="tel" placeholder="+91"><label>Password</label><input name="pw" type="password" required minlength="8" placeholder="At least 8 characters"><div class="err" id="err"></div><button class="btn btn-solid mt" style="width:100%;justify-content:center">Create account</button></form>`;
    if (v === 'verify') form = `<form data-f="verify"><p>We sent a 6-digit code to <b>${esc(S.view.pending)}</b>. Open the <a href="#" data-a="outbox" style="text-decoration:underline">email outbox</a> to read it.</p><label>Verification code</label><input name="code" inputmode="numeric" maxlength="6" required placeholder="123456"><div class="err" id="err"></div><button class="btn btn-solid mt" style="width:100%;justify-content:center">Verify email</button></form>`;
    if (v === 'forgot') form = `<form data-f="forgot"><p class="muted">Enter your email and we send a reset code.</p><label>Email</label><input name="email" type="email" required><div class="err" id="err"></div><button class="btn btn-solid mt" style="width:100%;justify-content:center">Send reset code</button></form>`;
    if (v === 'newpass') form = `<form data-f="newpass"><p>Code sent to <b>${esc(S.view.pending)}</b> (see outbox).</p><label>Reset code</label><input name="code" inputmode="numeric" required><label>New password</label><input name="pw" type="password" minlength="8" required><div class="err" id="err"></div><button class="btn btn-solid mt" style="width:100%;justify-content:center">Set new password</button></form>`;
    const acc = [['customer', 'priya@demo.in', 'Customer', 'Book, move, cancel, edit profile'], ['doctor', 'rao@demo.in', 'Doctor', 'Accept requests, set auto windows'], ['trainer', 'vikram@demo.in', 'Trainer / cleaner', 'Reset rooms, extras'], ['admin', 'admin@demo.in', 'Admin', 'Everything + CSV export']];
    return `<section>
      <span class="eyebrow"><i></i>Live demo - sample data</span>
      <h1 class="at" style="margin-top:12px">Welcome back. Your room is <em>ready.</em></h1>
      <div class="grid-auth">
        <div class="pane">${tabs}<div class="mt">${form}</div></div>
        <div class="pane"><h3 class="st">One-tap demo accounts</h3><p class="muted small">Password for all: <b>demo1234</b>. Try each role and watch the email outbox fill up.</p>
          <div class="demo-acc">${acc.map(a => `<button data-a="quick" data-e="${a[1]}"><b>${a[2]}</b><small>${a[3]}</small></button>`).join('')}</div>
          <div class="hint">Tip: book as Customer, accept as Doctor, complete the visit, then open Trainer to see the room reset task arrive.</div>
        </div>
      </div></section>`;
  }

  function slotPicker(docId, date, sel, except) {
    const doc = user(docId);
    return `<div class="slots" style="margin-top:10px">${SLOTS.map(t => `<button class="slot ${sel === t ? 'on' : ''}" data-a="pickSlot" data-t="${t}" ${busy(docId, date, t, except) ? 'disabled' : ''} title="${inWin(doc, t) ? 'Instant confirm' : 'Doctor will confirm'}">${hm(t)}${inWin(doc, t) ? ' <span style="color:var(--teal-3)">&bull;</span>' : ''}</button>`).join('')}</div>`;
  }
  function dayPicker(sel) { return `<div class="days">${[0, 1, 2, 3, 4, 5, 6].map(i => { const d = dayAdd(i); const dt = new Date(d + 'T12:00'); return `<button class="day ${sel === d ? 'on' : ''}" data-a="pickDay" data-d="${d}"><small>${dt.toLocaleDateString('en-IN', { weekday: 'short' })}</small><b>${dt.getDate()}</b></button>`; }).join('')}</div>`; }

  function customerView(u) {
    const tab = S.view.ctab || 'book';
    const docs = S.users.filter(x => x.role === 'doctor');
    const tabs = `<div class="tabs">${[['book', 'Book'], ['mine', 'My appointments'], ['profile', 'Profile']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="ctab" data-v="${k}">${l}</button>`).join('')}</div>`;
    let body = '';
    if (tab === 'book') {
      const B = S.view.b || (S.view.b = { d: u.prefs.doctor || 'd1', date: dayAdd(1), t: null });
      const doc = user(B.d);
      body = `<div class="grid2 mt"><div class="pane"><h3 class="st">1. Choose doctor</h3><div class="docs" style="grid-template-columns:1fr">${docs.map(d => `<button class="doc ${B.d === d.id ? 'on' : ''}" data-a="pickDoc" data-d="${d.id}"><span class="avatar" style="background:var(--teal-3)">${d.name.split(' ')[1][0]}${d.name.split(' ')[2][0]}</span><span><strong>${esc(d.name)}</strong><small>${d.spec} - ${d.room}${d.auto && d.windows.length ? ' - instant slots' : ''}</small></span></button>`).join('')}</div></div>
        <div class="pane"><h3 class="st">2. Pick a time</h3>${dayPicker(B.date)}${slotPicker(B.d, B.date, B.t)}<p class="small muted mt"><span style="color:var(--teal-3)">&bull;</span> = confirmed instantly. Other times wait for the doctor.</p>
        <button class="btn btn-coral mt" data-a="book" ${B.t == null ? 'disabled style="opacity:.4;width:100%;justify-content:center"' : 'style="width:100%;justify-content:center"'}>${B.t == null ? 'Choose a time' : `Book ${hm(B.t)} with ${esc(doc.name)}`}</button></div></div>`;
    }
    if (tab === 'mine') {
      const list = S.appts.filter(a => a.c === u.id).sort((a, b) => (a.date + hm(a.t)).localeCompare(b.date + hm(b.t)));
      const R = S.view.resch;
      body = `<div class="pane mt"><h3 class="st">My appointments</h3><div class="list">${list.length ? list.map(a => {
        const d = user(a.d); const active = ['Confirmed', 'Pending'].includes(a.st);
        const rs = R && R.id === a.id ? `<div style="flex-basis:100%;min-width:0;width:100%">${dayPicker(R.date)}${slotPicker(a.d, R.date, R.t, a.id)}<div class="row mt"><button class="sbtn pri" data-a="doResch" ${R.t == null ? 'disabled' : ''}>Move here</button><button class="sbtn" data-a="cancelResch">Keep current</button></div></div>` : '';
        return `<div class="item"><div class="grow"><b>${nice(a.date)} - ${hm(a.t)}</b><span class="muted small">${esc(d.name)} - ${d.room}</span></div><span class="tag ${a.st === 'Declined' ? 'Cancelled' : a.st}">${a.st}</span>${active ? `<button class="sbtn" data-a="resch" data-id="${a.id}">Reschedule</button><button class="sbtn danger" data-a="cancel" data-id="${a.id}">Cancel</button>` : ''}${rs}</div>`;
      }).join('') : '<div class="empty">No appointments yet. Book your first visit.</div>'}</div></div>`;
    }
    if (tab === 'profile') {
      body = `<form class="pane mt" data-f="profile" style="max-width:640px"><h3 class="st">Profile</h3>
        <label>Full name</label><input name="name" value="${esc(u.name)}" required>
        <div class="grid2"><div><label>Email</label><input value="${esc(u.email)}" disabled></div><div><label>Phone</label><input name="phone" value="${esc(u.phone || '')}"></div></div>
        <label>Preferred doctor</label><select name="doctor"><option value="">No preference</option>${docs.map(d => `<option value="${d.id}" ${u.prefs.doctor === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select>
        <label class="chk"><input type="checkbox" name="reminders" ${u.prefs.reminders ? 'checked' : ''}> Email me a reminder the day before</label>
        <button class="btn btn-solid mt">Save changes</button></form>`;
    }
    return `<section><span class="eyebrow"><i></i>Customer</span><h1 class="at" style="margin:10px 0 20px">Hi ${esc(u.name.split(' ')[0])}, pick a <em>free</em> time.</h1>${tabs}${body}</section>`;
  }

  function doctorView(u) {
    const mine = S.appts.filter(a => a.d === u.id);
    const pend = mine.filter(a => a.st === 'Pending');
    const up = mine.filter(a => a.st === 'Confirmed').sort((a, b) => (a.date + hm(a.t)).localeCompare(b.date + hm(b.t)));
    const trainers = S.users.filter(x => x.role === 'trainer');
    return `<section><span class="eyebrow"><i></i>Doctor - ${u.room}</span><h1 class="at" style="margin:10px 0 20px">${esc(u.name)}. Decide, or let the <em>window</em> decide.</h1>
    <div class="grid2">
      <div class="pane"><h3 class="st">Waiting for you (${pend.length})</h3><div class="list">${pend.length ? pend.map(a => `<div class="item"><div class="grow"><b>${esc(user(a.c).name)}</b><span class="muted small">${nice(a.date)} - ${hm(a.t)}</span></div><button class="sbtn pri" data-a="accept" data-id="${a.id}">Accept</button><button class="sbtn danger" data-a="decline" data-id="${a.id}">Decline</button></div>`).join('') : '<div class="empty">All clear. New requests outside your windows land here.</div>'}</div></div>
      <div class="pane"><div class="row between"><h3 class="st" style="margin:0">Auto-accept windows</h3><button class="switch ${u.auto ? 'on' : ''}" data-a="toggleAuto" aria-label="Toggle auto accept"></button></div>
        <p class="muted small" style="margin-top:6px">Bookings inside these hours are confirmed at once.</p>
        ${(u.windows || []).map((w, i) => `<div class="win"><input type="time" value="${hm(w[0])}" data-a="winEdit" data-i="${i}" data-k="0" step="1800"><span>to</span><input type="time" value="${hm(w[1])}" data-a="winEdit" data-i="${i}" data-k="1" step="1800"><button class="sbtn danger" data-a="winDel" data-i="${i}">&times;</button></div>`).join('') || '<div class="empty" style="margin-top:10px">No windows. Every booking waits for you.</div>'}
        <button class="sbtn mt" data-a="winAdd">+ Add window</button></div>
    </div>
    <div class="pane mt"><h3 class="st">Confirmed visits</h3><p class="muted small">When a visit ends, mark it complete. A trainer/cleaner gets the room reset task. Add extras if you need them.</p><div class="list mt">${up.length ? up.map(a => `<div class="item"><div class="grow"><b>${nice(a.date)} - ${hm(a.t)} - ${esc(user(a.c).name)}</b><span class="muted small">${u.room}</span></div><input placeholder="Extra for cleaner (optional)" id="ex-${a.id}" style="max-width:240px;padding:8px 12px;font-size:14px"><select id="tr-${a.id}" style="max-width:170px;padding:8px 12px;font-size:14px"><option value="">Auto-assign trainer</option>${trainers.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select><button class="sbtn pri" data-a="complete" data-id="${a.id}">Visit done</button></div>`).join('') : '<div class="empty">No confirmed visits yet.</div>'}</div></div></section>`;
  }

  function trainerView(u) {
    const tasks = S.tasks.filter(t => t.tr === u.id).reverse();
    return `<section><span class="eyebrow"><i></i>Trainer &amp; cleaner</span><h1 class="at" style="margin:10px 0 20px">Make it <em>ready</em> again, ${esc(u.name.split(' ')[0])}.</h1>
    <div class="grid2">${tasks.length ? tasks.map(t => { const a = S.appts.find(x => x.id === t.a); const doc = a && user(a.d); const all = t.items.every(i => i.done) && t.extras.every((_, i) => (t.exDone || [])[i]);
      return `<div class="pane"><div class="row between"><span class="eyebrow">${t.room}${a ? ' - after ' + hm(a.t + 30) : ''}</span><span class="tag ${t.st === 'Ready' ? 'Confirmed' : 'Pending'}">${t.st === 'Ready' ? 'Ready' : 'To do'}</span></div>
        <h3 class="st" style="margin-top:10px">Reset ${t.room}</h3>${doc ? `<p class="muted small">Visit with ${esc(doc.name)}${a ? ' on ' + nice(a.date) : ''}</p>` : ''}
        <ul class="check mt">${t.items.map((i, k) => `<li><input type="checkbox" data-a="tick" data-id="${t.id}" data-k="${k}" ${i.done ? 'checked' : ''} ${t.st === 'Ready' ? 'disabled' : ''}> ${esc(i.t)}</li>`).join('')}${t.extras.map((e, k) => `<li><input type="checkbox" data-a="tickEx" data-id="${t.id}" data-k="${k}" ${(t.exDone || [])[k] ? 'checked' : ''} ${t.st === 'Ready' ? 'disabled' : ''}> ${esc(e)} <span class="pill wait" style="margin-left:auto">Extra from doctor</span></li>`).join('')}</ul>
        ${t.st === 'Ready' ? '<p class="mt" style="color:var(--teal-3);font-weight:600">Room marked ready. Thank you.</p>' : `<button class="btn btn-solid mt" data-a="ready" data-id="${t.id}" ${all ? '' : 'disabled style="opacity:.4"'}>Mark room ready</button>`}</div>`; }).join('') : '<div class="empty">No rooms to reset right now. New tasks appear when a doctor finishes a visit.</div>'}</div></section>`;
  }

  function adminView() {
    const tab = S.view.atab || 'appts';
    const F = S.view.f || (S.view.f = { st: 'All', d: '', q: '' });
    const docs = S.users.filter(x => x.role === 'doctor');
    const tabs = `<div class="tabs">${[['appts', 'Appointments'], ['cust', 'Customers'], ['add', 'Add booking']].map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-a="atab" data-v="${k}">${l}</button>`).join('')}</div>`;
    const stats = `<div class="stats mt">${[['Customers', S.users.filter(x => x.role === 'customer').length], ['Upcoming', S.appts.filter(a => ['Confirmed', 'Pending'].includes(a.st)).length], ['Pending', S.appts.filter(a => a.st === 'Pending').length], ['Rooms to reset', S.tasks.filter(t => t.st !== 'Ready').length]].map(([l, v]) => `<div class="stat" style="background:#fff"><small>${l}</small><b>${v}</b></div>`).join('')}</div>`;
    let body = '';
    if (tab === 'appts') {
      const rows = filtered();
      body = `<div class="pane mt"><div class="toolbar" style="margin-top:0"><div class="chips">${['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled', 'Declined'].map(s => `<button class="chip ${F.st === s ? 'on' : ''}" data-a="fst" data-v="${s}">${s}</button>`).join('')}</div><button class="btn btn-solid" data-a="exportA" style="padding:10px 16px;font-size:14px">Export CSV &darr;</button></div>
        <div class="row" style="margin-bottom:12px"><input placeholder="Search customer" value="${esc(F.q)}" data-a="fq" style="max-width:260px;padding:9px 12px;font-size:14px"><select data-a="fd" style="max-width:220px;padding:9px 12px;font-size:14px"><option value="">All doctors</option>${docs.map(d => `<option value="${d.id}" ${F.d === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div>
        <div class="table-wrap"><table><thead><tr><th>Customer</th><th>Doctor</th><th>Date</th><th>Time</th><th>Status</th><th>Change</th></tr></thead><tbody>${rows.map(a => `<tr><td>${esc(user(a.c).name)}</td><td>${esc(user(a.d).name)}</td><td>${nice(a.date)}</td><td>${hm(a.t)}</td><td><span class="tag ${a.st === 'Declined' ? 'Cancelled' : a.st}">${a.st}</span></td><td><select data-a="setSt" data-id="${a.id}" style="padding:6px 8px;font-size:13px;width:auto">${['Confirmed', 'Pending', 'Completed', 'Cancelled', 'Declined'].map(s => `<option ${a.st === s ? 'selected' : ''}>${s}</option>`).join('')}</select></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No matches</td></tr>'}</tbody></table></div></div>`;
    }
    if (tab === 'cust') {
      const cs = S.users.filter(x => x.role === 'customer');
      body = `<div class="pane mt"><div class="row between" style="margin-bottom:12px"><h3 class="st" style="margin:0">Customers</h3><button class="btn btn-solid" data-a="exportC" style="padding:10px 16px;font-size:14px">Export CSV &darr;</button></div><div class="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Verified</th><th>Visits</th></tr></thead><tbody>${cs.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.email)}</td><td>${esc(c.phone || '')}</td><td>${c.verified ? 'Yes' : 'No'}</td><td>${S.appts.filter(a => a.c === c.id).length}</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (tab === 'add') {
      const A = S.view.add || (S.view.add = { c: 'c1', d: 'd1', date: dayAdd(1), t: null });
      body = `<div class="pane mt"><h3 class="st">Add a booking by hand</h3><div class="grid2"><div><label>Customer</label><select data-a="addC">${S.users.filter(x => x.role === 'customer').map(c => `<option value="${c.id}" ${A.c === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div><label>Doctor</label><select data-a="addD">${docs.map(d => `<option value="${d.id}" ${A.d === d.id ? 'selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div></div>${dayPicker(A.date)}${slotPicker(A.d, A.date, A.t)}<button class="btn btn-solid mt" data-a="adminBook" ${A.t == null ? 'disabled style="opacity:.4"' : ''}>Add confirmed booking</button></div>`;
    }
    return `<section><span class="eyebrow"><i></i>Admin</span><h1 class="at" style="margin:10px 0 20px">The whole day, in <em>one room.</em></h1>${tabs}${stats}${body}</section>`;
  }
  function filtered() { const F = S.view.f; return S.appts.filter(a => (F.st === 'All' || a.st === F.st) && (!F.d || a.d === F.d) && (!F.q || user(a.c).name.toLowerCase().includes(F.q.toLowerCase()))).sort((a, b) => (a.date + hm(a.t)).localeCompare(b.date + hm(b.t))); }
  function csv(name, rows) { const s = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + s], { type: 'text/csv' })); a.download = name; a.click(); toast(`Exported ${rows.length - 1} rows`); }

  function renderOutbox() {
    $('#obCount').textContent = S.outbox.length;
    $('#obList').innerHTML = S.outbox.length ? S.outbox.map(m => `<div class="mail"><span class="muted">${m.at} - to ${esc(m.to)}</span><b>${esc(m.subject)}</b><pre>${esc(m.body).replace(/\b(\d{6})\b/g, '<span class="code">$1</span>')}</pre></div>`).join('') : '<div class="empty" style="margin:18px">No emails yet.</div>';
  }

  // ---------------- actions ----------------
  function notifyBooking(a, verb) {
    const c = user(a.c), d = user(a.d);
    mail(c.email, `Appointment ${verb}: ${nice(a.date)} ${hm(a.t)}`, `Hi ${c.name.split(' ')[0]},\n\nYour appointment with ${d.name} (${d.room}) on ${nice(a.date)} at ${hm(a.t)} is ${verb.toLowerCase()}.\nStatus: ${a.st}\n\nCareSlot`);
    mail(d.email, `${c.name}: ${verb.toLowerCase()} ${nice(a.date)} ${hm(a.t)}`, `${c.name} - ${nice(a.date)} ${hm(a.t)}\nStatus: ${a.st}`);
  }

  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-a]'); if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT' && el.type !== 'checkbox') return;
    const a = el.dataset.a, u = me(), id = el.dataset.id;
    const ap = id && S.appts.find(x => x.id === id);
    switch (a) {
      case 'outbox': e.preventDefault(); $('#drawer').classList.add('open'); $('#scrim').classList.add('on'); return;
      case 'closeOutbox': $('#drawer').classList.remove('open'); $('#scrim').classList.remove('on'); return;
      case 'resetDemo': localStorage.removeItem(KEY); await seed(); toast('Demo data restored'); break;
      case 'authTab': S.view.auth = el.dataset.v; break;
      case 'quick': S.me = S.users.find(x => x.email === el.dataset.e).id; S.view = {}; toast('Signed in'); break;
      case 'logout': S.me = null; S.view = {}; break;
      case 'ctab': S.view.ctab = el.dataset.v; S.view.resch = null; break;
      case 'atab': S.view.atab = el.dataset.v; break;
      case 'pickDoc': S.view.b.d = el.dataset.d; S.view.b.t = null; break;
      case 'pickDay': { const tgt = S.view.resch || (u.role === 'admin' ? S.view.add : S.view.b); tgt.date = el.dataset.d; tgt.t = null; break; }
      case 'pickSlot': { const tgt = S.view.resch || (u.role === 'admin' ? S.view.add : S.view.b); tgt.t = +el.dataset.t; break; }
      case 'book': { const B = S.view.b; if (B.t == null || busy(B.d, B.date, B.t)) return; const doc = user(B.d);
        const n = { id: uid(), c: u.id, d: B.d, date: B.date, t: B.t, st: inWin(doc, B.t) ? 'Confirmed' : 'Pending' }; S.appts.push(n); notifyBooking(n, 'booked');
        toast(n.st === 'Confirmed' ? 'Booked and confirmed. Email sent.' : 'Requested. The doctor will confirm soon.'); B.t = null; S.view.ctab = 'mine'; break; }
      case 'resch': S.view.resch = { id, date: ap.date, t: null }; break;
      case 'cancelResch': S.view.resch = null; break;
      case 'doResch': { const R = S.view.resch, x = S.appts.find(y => y.id === R.id); if (R.t == null) return; x.date = R.date; x.t = R.t; x.st = inWin(user(x.d), x.t) ? 'Confirmed' : 'Pending'; notifyBooking(x, 'rescheduled'); S.view.resch = null; toast('Moved. Email sent.'); break; }
      case 'cancel': if (!confirm('Cancel this appointment?')) return; ap.st = 'Cancelled'; notifyBooking(ap, 'cancelled'); toast('Cancelled. The slot is free again.'); break;
      case 'accept': ap.st = 'Confirmed'; notifyBooking(ap, 'confirmed'); toast('Accepted. Customer notified.'); break;
      case 'decline': ap.st = 'Declined'; notifyBooking(ap, 'declined'); toast('Declined. Customer notified.'); break;
      case 'toggleAuto': u.auto = !u.auto; toast(u.auto ? 'Auto-accept on' : 'Auto-accept off'); break;
      case 'winAdd': u.windows.push([840, 900]); break;
      case 'winDel': u.windows.splice(+el.dataset.i, 1); break;
      case 'complete': { const ex = ($('#ex-' + id).value || '').trim(); const trainers = S.users.filter(x => x.role === 'trainer'); const pick = $('#tr-' + id).value || trainers[S.rr++ % trainers.length].id;
        ap.st = 'Completed'; const tr = user(pick);
        S.tasks.push({ id: uid(), a: ap.id, tr: pick, room: u.room, items: checklist().map(t => ({ t, done: false })), extras: ex ? [ex] : [], exDone: [], st: 'Open' });
        mail(tr.email, `Reset ${u.room} now`, `Hi ${tr.name.split(' ')[0]},\n\n${u.name} finished a visit in ${u.room}. Please reset the room.${ex ? '\nExtra from doctor: ' + ex : ''}\n\nCareSlot`);
        toast(`Visit done. ${tr.name} got the reset task.`); break; }
      case 'tick': case 'tickEx': { const t = S.tasks.find(x => x.id === id); const k = +el.dataset.k; if (a === 'tick') t.items[k].done = el.checked; else { t.exDone = t.exDone || []; t.exDone[k] = el.checked; } break; }
      case 'ready': { const t = S.tasks.find(x => x.id === id); t.st = 'Ready'; const ad = S.users.find(x => x.role === 'admin'); mail(ad.email, `${t.room} is ready`, `${u.name} reset ${t.room}. Ready for the next booking.`); toast(`${t.room} is ready for the next visit`); break; }
      case 'fst': S.view.f.st = el.dataset.v; break;
      case 'exportA': csv('appointments.csv', [['Customer', 'Email', 'Doctor', 'Date', 'Time', 'Status'], ...filtered().map(x => [user(x.c).name, user(x.c).email, user(x.d).name, x.date, hm(x.t), x.st])]); return;
      case 'exportC': csv('customers.csv', [['Name', 'Email', 'Phone', 'Verified', 'Visits'], ...S.users.filter(x => x.role === 'customer').map(c => [c.name, c.email, c.phone, c.verified ? 'Yes' : 'No', S.appts.filter(x => x.c === c.id).length])]); return;
      case 'adminBook': { const A = S.view.add; if (A.t == null) return; const n = { id: uid(), c: A.c, d: A.d, date: A.date, t: A.t, st: 'Confirmed' }; S.appts.push(n); notifyBooking(n, 'booked'); A.t = null; S.view.atab = 'appts'; toast('Booking added. Customer emailed.'); break; }
      default: return;
    }
    save(); render();
  });

  document.addEventListener('change', e => {
    const el = e.target, a = el.dataset.a, u = me(); if (!a) return;
    if (a === 'setSt') { const x = S.appts.find(y => y.id === el.dataset.id); x.st = el.value; notifyBooking(x, 'updated'); toast('Updated. Customer emailed.'); }
    else if (a === 'fd') S.view.f.d = el.value;
    else if (a === 'addC') S.view.add.c = el.value;
    else if (a === 'addD') { S.view.add.d = el.value; S.view.add.t = null; }
    else if (a === 'winEdit') { const v = toMin(el.value || '00:00'); u.windows[+el.dataset.i][+el.dataset.k] = v; }
    else return;
    save(); render();
  });
  document.addEventListener('input', e => { if (e.target.dataset.a === 'fq') { S.view.f.q = e.target.value; save(); const pos = e.target.selectionStart; render(); const n = document.querySelector('[data-a="fq"]'); n.focus(); n.setSelectionRange(pos, pos); } });

  document.addEventListener('submit', async e => {
    e.preventDefault(); const f = e.target, fd = Object.fromEntries(new FormData(f)), kind = f.dataset.f; const err = m => { const x = $('#err'); if (x) x.textContent = m; };
    if (kind === 'signin') {
      const u = S.users.find(x => x.email.toLowerCase() === fd.email.trim().toLowerCase());
      if (!u || (await hash(fd.pw, u.salt)) !== u.pass) return err('Email or password is not correct.');
      if (!u.verified) { S.view.auth = 'verify'; S.view.pending = u.email; save(); render(); return; }
      S.me = u.id; S.view = {}; toast('Signed in');
    }
    if (kind === 'signup') {
      if (S.users.some(x => x.email.toLowerCase() === fd.email.trim().toLowerCase())) return err('This email already has an account.');
      if (fd.pw.length < 8) return err('Password needs at least 8 characters.');
      const salt = uid(); const u = { id: uid(), role: 'customer', name: fd.name.trim(), email: fd.email.trim(), phone: fd.phone, salt, pass: await hash(fd.pw, salt), verified: false, prefs: { reminders: true, doctor: '' } };
      S.users.push(u); const code = String(Math.floor(100000 + Math.random() * 900000)); S.codes[u.email] = code;
      mail(u.email, 'Verify your CareSlot email', `Hi ${u.name.split(' ')[0]},\n\nYour verification code is ${code}.\nIt expires in 15 minutes.\n\nCareSlot`);
      S.view.auth = 'verify'; S.view.pending = u.email; toast('Account created. Check the email outbox.');
    }
    if (kind === 'verify') {
      if (S.codes[S.view.pending] !== fd.code.trim()) return err('That code does not match. Check the outbox.');
      const u = S.users.find(x => x.email === S.view.pending); u.verified = true; delete S.codes[u.email];
      mail(u.email, 'Welcome to CareSlot', `Your email is verified. You can book your first visit now.`);
      S.me = u.id; S.view = {}; toast('Email verified. Welcome!');
    }
    if (kind === 'forgot') {
      const u = S.users.find(x => x.email.toLowerCase() === fd.email.trim().toLowerCase());
      const code = String(Math.floor(100000 + Math.random() * 900000));
      if (u) { S.codes['reset:' + u.email] = code; mail(u.email, 'Reset your CareSlot password', `Your password reset code is ${code}.\nIf you did not ask for this, ignore this email.`); }
      S.view.auth = 'newpass'; S.view.pending = fd.email.trim(); toast('If the email exists, a code was sent.');
    }
    if (kind === 'newpass') {
      const u = S.users.find(x => x.email.toLowerCase() === S.view.pending.toLowerCase());
      if (!u || S.codes['reset:' + u.email] !== fd.code.trim()) return err('Code is not correct.');
      if (fd.pw.length < 8) return err('Password needs at least 8 characters.');
      u.salt = uid(); u.pass = await hash(fd.pw, u.salt); delete S.codes['reset:' + u.email];
      mail(u.email, 'Your password was changed', 'Your CareSlot password was just changed.'); S.view.auth = 'in'; toast('Password changed. Sign in now.');
    }
    if (kind === 'profile') {
      const u = me(); u.name = fd.name.trim() || u.name; u.phone = fd.phone; u.prefs.doctor = fd.doctor; u.prefs.reminders = !!fd.reminders;
      mail(u.email, 'Your profile was updated', 'Your CareSlot profile details were changed.'); toast('Profile saved');
    }
    save(); render();
  });

  (async function init() {
    try { S = JSON.parse(localStorage.getItem(KEY)); } catch (e) { S = null; }
    if (!S || !S.users) await seed();
    S.view = S.view || {};
    render(); renderOutbox();
  })();
})();
