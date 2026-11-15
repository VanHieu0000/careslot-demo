(function () {
  const CS = (window.CS = window.CS || { heroP: 0, resetP: 0 });
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) document.documentElement.classList.add('reduced');

  function toast(msg) {
    const t = $('#toast'); $('#toastMsg').textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 3200);
  }
  window.csToast = toast;

  // ---------- smooth scroll (silky, like walking into a calm room) ----------
  const hasGsap = window.gsap && window.ScrollTrigger;
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  let lenis = null;
  if (window.Lenis && !reduced) {
    lenis = new Lenis({ duration: 1.25, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    if (hasGsap) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
  }
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href'); if (id.length < 2) return; const el = $(id); if (!el) return;
    e.preventDefault(); lenis ? lenis.scrollTo(el, { offset: id === '#top' ? 0 : -60 }) : el.scrollIntoView({ behavior: 'smooth' });
  }));

  // ---------- nav ----------
  const nav = $('#nav');
  function navState() {
    const hero = $('.hero'); const y = scrollY;
    const heroLit = CS.heroP > .12; const inHero = y < hero.offsetHeight - innerHeight * .5;
    const reset = $('#reset'); const rr = reset.getBoundingClientRect();
    const inReset = rr.top < 60 && rr.bottom > 60;
    nav.classList.toggle('is-dark', (inHero && !heroLit) || inReset);
    nav.classList.toggle('is-solid', !inHero && !inReset);
  }

  // ---------- HERO: scroll = time passing as the room gets ready ----------
  const steps = [
    { at: 0, time: '07:52', label: 'Lights off' },
    { at: .14, time: '07:58', label: 'Lights on' },
    { at: .4, time: '08:20', label: 'Room set up' },
    { at: .6, time: '09:25', label: 'Doctor arriving' },
    { at: .74, time: '09:30', label: 'Your slot - confirmed' }
  ];
  const heroEl = $('.hero'), prog = $$('#heroProg span');
  function heroUI(p) {
    CS.heroP = p;
    let s = steps[0]; steps.forEach(x => { if (p >= x.at) s = x; });
    $('#heroTime').textContent = s.time; $('#heroStep').textContent = s.label;
    heroEl.classList.toggle('is-lit', p > .12);
    $('#scrollHint').style.opacity = p > .03 ? 0 : 1;
    prog.forEach((el, i) => el.classList.toggle('on', p >= [0, .14, .4, .74][i]));
  }
  if (hasGsap) {
    ScrollTrigger.create({ trigger: heroEl, start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: st => { heroUI(st.progress); navState(); } });
    gsap.from('.hero h1, .hero-sub, .hero-cta, .hero-clock', { y: 40, opacity: 0, duration: 1.6, ease: 'expo.out', stagger: .12, delay: .2 });
  }
  heroUI(0);

  // ---------- statement: words light up like lamps ----------
  const st = $('#statement');
  st.innerHTML = st.textContent.split(' ').map(w => `<span class="w">${w}</span>`).join(' ');
  const words = $$('.w', st);
  if (hasGsap && !reduced) {
    ScrollTrigger.create({ trigger: st, start: 'top 80%', end: 'bottom 45%', scrub: true, onUpdate: s => {
      const n = s.progress * words.length; words.forEach((w, i) => (w.style.opacity = i < n ? 1 : .14));
    } });
  } else words.forEach(w => (w.style.opacity = 1));

  // ---------- generic reveals + parallax ----------
  if (hasGsap && !reduced) {
    $$('[data-reveal]').forEach(el => gsap.to(el, { opacity: 1, y: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } }));
    $$('.parallax img').forEach(img => gsap.fromTo(img, { yPercent: -6 }, { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }));
    $$('.band').forEach((b, i) => gsap.from(b, { scaleX: 0, duration: 1.6, ease: 'expo.out', delay: i * .2, scrollTrigger: { trigger: '#track', start: 'top 85%' } }));
  } else $$('[data-reveal]').forEach(el => { el.style.opacity = 1; el.style.transform = 'none'; });

  // ---------- videos play only when on screen ----------
  const vio = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting) { v.play().catch(() => {}); } else v.pause(); }), { threshold: .2 });
  $$('video[data-autoplay]').forEach(v => vio.observe(v));

  // ---------- 01 BOOK ----------
  const DOCS = [
    { id: 'rao', name: 'Dr. Ananya Rao', spec: 'Physiotherapy', color: '#2F7A74', room: 'Room 2' },
    { id: 'mehta', name: 'Dr. Karan Mehta', spec: 'Sports medicine', color: '#FF7A59', room: 'Room 4' },
    { id: 'iqbal', name: 'Dr. Sana Iqbal', spec: 'General physician', color: '#1C5A57', room: 'Room 1' }
  ];
  const SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '14:00', '14:30', '15:00', '16:00', '16:30', '17:00'];
  const days = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const B = { doc: 'rao', day: 0, slot: null };
  const initials = n => n.replace('Dr. ', '').split(' ').map(x => x[0]).join('');
  const taken = (doc, day, i) => ((doc.length * 7 + day * 5 + i * 3) % 5 === 0) || ((day + i) % 7 === 3);

  function renderBook() {
    $('#docList').innerHTML = DOCS.map(d => `<button class="doc ${B.doc === d.id ? 'on' : ''}" data-doc="${d.id}"><span class="avatar" style="background:${d.color}">${initials(d.name)}</span><span><strong>${d.name}</strong><small>${d.spec}</small></span></button>`).join('');
    $('#dayList').innerHTML = days.map((d, i) => `<button class="day ${B.day === i ? 'on' : ''}" data-day="${i}"><small>${d.toLocaleDateString('en-IN', { weekday: 'short' })}</small><b>${d.getDate()}</b></button>`).join('');
    $('#slotList').innerHTML = SLOTS.map((s, i) => `<button class="slot ${B.slot === s ? 'on' : ''}" data-slot="${s}" ${taken(B.doc, B.day, i) ? 'disabled' : ''}>${s}</button>`).join('');
    const doc = DOCS.find(d => d.id === B.doc), tk = $('#ticket');
    $('#tkDoc').textContent = doc.name; $('#tkRoom').textContent = doc.room;
    $('#tkDay').textContent = days[B.day].toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    $('#tkTime').textContent = B.slot || '00:00'; $('#tkTime').classList.toggle('empty', !B.slot);
    tk.classList.toggle('held', !!B.slot);
    $('#tkStatus').innerHTML = B.slot ? '<i></i>Held for you - confirm to lock it' : '<i></i>Choose a time';
    $('#tkConfirm').disabled = !B.slot;
  }
  $('#book').addEventListener('click', e => {
    const d = e.target.closest('[data-doc]'), dy = e.target.closest('[data-day]'), s = e.target.closest('[data-slot]');
    if (d) { B.doc = d.dataset.doc; B.slot = null; }
    else if (dy) { B.day = +dy.dataset.day; B.slot = null; }
    else if (s && !s.disabled) { B.slot = s.dataset.slot; if (hasGsap) gsap.fromTo('#tkTime', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .8, ease: 'expo.out' }); }
    else return;
    renderBook();
  });
  $('#tkConfirm').addEventListener('click', () => {
    const doc = DOCS.find(d => d.id === B.doc);
    $('#tkStatus').innerHTML = '<i style="background:#A9DCCD"></i>Confirmed - room will be ready';
    $('#ticket').classList.remove('held'); $('#tkConfirm').disabled = true;
    toast(`Confirmed: ${doc.name}, ${B.slot}. Email sent to you.`);
  });
  renderBook();

  // ---------- 02 DOCTOR windows ----------
  let auto = true;
  const REQS = [
    { n: 'Priya S.', t: '10:30', inWin: true, c: '#FF7A59' },
    { n: 'Rahul M.', t: '13:30', inWin: false, c: '#2F7A74' },
    { n: 'Neha K.', t: '16:30', inWin: true, c: '#1C5A57' }
  ];
  const reqState = REQS.map(() => null);
  function renderReqs() {
    $('#reqs').innerHTML = REQS.map((r, i) => {
      const s = reqState[i] || (auto && r.inWin ? 'auto' : 'wait');
      const pill = s === 'auto' ? '<span class="pill auto">Auto-accepted</span>' : s === 'ok' ? '<span class="pill auto">Accepted</span>' : s === 'no' ? '<span class="pill no">Declined</span>' : '<span class="pill wait">Waiting for you</span>';
      const acts = s === 'wait' ? `<span class="acts"><button data-acc="${i}" aria-label="Accept">&#10003;</button><button data-dec="${i}" aria-label="Decline">&times;</button></span>` : '';
      return `<div class="req"><span class="avatar" style="background:${r.c}">${r.n[0]}</span><span class="who"><b>${r.n}</b><small>Today ${r.t} - ${r.inWin ? 'inside window' : 'outside window'}</small></span>${pill}${acts}</div>`;
    }).join('');
  }
  $('#reqs').addEventListener('click', e => {
    const a = e.target.closest('[data-acc]'), d = e.target.closest('[data-dec]');
    if (a) { reqState[+a.dataset.acc] = 'ok'; toast(`Accepted. ${REQS[+a.dataset.acc].n} gets an email now.`); }
    if (d) { reqState[+d.dataset.dec] = 'no'; toast(`Declined. ${REQS[+d.dataset.dec].n} is offered other slots.`); }
    renderReqs();
  });
  $('#autoSwitch').addEventListener('click', e => {
    auto = !auto; e.currentTarget.classList.toggle('on', auto); e.currentTarget.setAttribute('aria-pressed', auto);
    REQS.forEach((r, i) => { if (r.inWin && (reqState[i] === null)) reqState[i] = null; });
    renderReqs();
  });
  renderReqs();
  if (hasGsap) gsap.from('#reqs', { opacity: 0, y: 20, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '#reqs', start: 'top 90%' } });

  // ---------- 03 RESET: scroll drives the cleaning sweep ----------
  const items = $$('#taskList li');
  function resetUI(r) {
    CS.resetP = r;
    items.forEach((li, i) => { const on = r > .26 + i * .13; li.classList.toggle('done', on); li.querySelector('i').textContent = on ? '✓' : ''; });
    const ok = r > .8; const ts = $('#taskState'); ts.classList.toggle('ok', ok);
    ts.textContent = ok ? 'Room 2 ready - next visit 10:30' : r > .2 ? 'Cleaning in progress...' : 'Visit ended 10:15 - waiting for reset';
  }
  if (hasGsap) ScrollTrigger.create({ trigger: '#resetPin', start: 'top top', end: 'bottom bottom', scrub: true, onUpdate: s => { resetUI(s.progress); navState(); } });
  resetUI(0);

  // ---------- 04 ADMIN ----------
  const ROWS = [
    ['Priya Sharma', 'Dr. Ananya Rao', '10:30', 'Vikram', 'Confirmed'],
    ['Rahul Mehra', 'Dr. Karan Mehta', '11:00', 'Anjali', 'Pending'],
    ['Neha Kapoor', 'Dr. Sana Iqbal', '11:30', 'Imran', 'Completed'],
    ['Arjun Nair', 'Dr. Ananya Rao', '12:00', 'Vikram', 'Confirmed'],
    ['Sneha Joshi', 'Dr. Karan Mehta', '14:00', 'Rohit', 'Cancelled'],
    ['Kabir Singh', 'Dr. Sana Iqbal', '14:30', 'Imran', 'Confirmed'],
    ['Meera Das', 'Dr. Ananya Rao', '16:00', 'Anjali', 'Pending']
  ];
  const FILTERS = ['All', 'Confirmed', 'Pending', 'Completed', 'Cancelled'];
  let filt = 'All';
  function renderAdmin() {
    $('#chips').innerHTML = FILTERS.map(f => `<button class="chip ${filt === f ? 'on' : ''}" data-f="${f}">${f}</button>`).join('');
    $('#rows').innerHTML = ROWS.filter(r => filt === 'All' || r[4] === filt).map((r, i) => `<tr class="fade-in" style="animation-delay:${i * 50}ms"><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><span class="tag ${r[4]}">${r[4]}</span></td></tr>`).join('');
  }
  $('#chips').addEventListener('click', e => { const c = e.target.closest('[data-f]'); if (!c) return; filt = c.dataset.f; renderAdmin(); });
  $('#exportBtn').addEventListener('click', () => {
    const data = [['Customer', 'Doctor', 'Time', 'Trainer', 'Status'], ...ROWS.filter(r => filt === 'All' || r[4] === filt)];
    const csv = data.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `appointments-${filt.toLowerCase()}.csv`; a.click();
    toast(`Exported ${data.length - 1} appointments to CSV`);
  });
  renderAdmin();
  $$('[data-count]').forEach(el => {
    const end = +el.dataset.count, suf = el.dataset.suffix || '';
    const run = () => { if (!hasGsap) { el.textContent = end + suf; return; } const o = { v: 0 }; gsap.to(o, { v: end, duration: 2, ease: 'expo.out', onUpdate: () => (el.textContent = Math.round(o.v) + suf) }); };
    new IntersectionObserver(([e], ob) => { if (e.isIntersecting) { run(); ob.disconnect(); } }, { threshold: .6 }).observe(el);
  });

  addEventListener('scroll', navState, { passive: true }); navState();
  addEventListener('load', () => hasGsap && ScrollTrigger.refresh());
})();
