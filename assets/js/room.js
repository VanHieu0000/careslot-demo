// CareSlot 3D room. One room, two moments:
//  - hero:  the room wakes up and gets ready for your visit (scroll builds it)
//  - reset: after the visit, a cleaning sweep returns everything to its place
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const CS = (window.CS = window.CS || { heroP: 0, resetP: 0 });
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const ease = t => 1 - Math.pow(1 - t, 3);
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

const C = {
  night: new THREE.Color('#0A1C1B'), paper: new THREE.Color('#EAF2EF'),
  mint: '#CFEDE4', mint3: '#A9DCCD', teal: '#0E3B3A', teal3: '#2F7A74', coral: '#FF7A59', white: '#FBFCFC'
};

function mat(color, o = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .62, metalness: .02, ...o }); }
function rbox(w, h, d, r, m) { const g = new RoundedBoxGeometry(w, h, d, 4, r); const me = new THREE.Mesh(g, m); me.castShadow = me.receiveShadow = true; return me; }
function cyl(rt, rb, h, m, seg = 24) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.castShadow = me.receiveShadow = true; return me; }

function panelTexture() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288;
  const ctx = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  let last = '';
  function draw(top, big, bg, fg) {
    const key = top + big + bg + (window.CS && window.CS.fontsReady ? 1 : 0); if (key === last) return; last = key;
    ctx.fillStyle = bg; ctx.fillRect(0, 0, 512, 288);
    ctx.fillStyle = fg; ctx.font = '600 26px Inter, Arial'; ctx.fillText(top, 34, 62);
    ctx.font = '400 112px "Instrument Serif", Georgia, serif'; ctx.fillText(big, 30, 196);
    ctx.globalAlpha = .5; ctx.fillRect(34, 230, 444, 3); ctx.globalAlpha = 1;
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

function buildRoom(scene) {
  const R = { parts: {} };
  // floor + walls
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), mat('#E6EEEB', { roughness: .9 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const wallM = mat(C.mint, { roughness: .95 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(8.4, 3.8, .12), wallM); back.position.set(0, 1.9, -3.06); back.receiveShadow = true; scene.add(back);
  const left = new THREE.Mesh(new THREE.BoxGeometry(.12, 3.8, 6.2), wallM); left.position.set(-4.2, 1.9, -0.04); left.receiveShadow = true; scene.add(left);
  const skirt = mat('#BFE3D7');
  const sb = new THREE.Mesh(new THREE.BoxGeometry(8.4, .14, .03), skirt); sb.position.set(0, .07, -2.99); scene.add(sb);
  // window light on left wall
  const wc = document.createElement('canvas'); wc.width = 440; wc.height = 320; const wx = wc.getContext('2d');
  const sky = wx.createLinearGradient(0, 0, 0, 320); sky.addColorStop(0, '#CFE8F5'); sky.addColorStop(.7, '#F4FAFC'); sky.addColorStop(1, '#E3F1EC');
  wx.fillStyle = sky; wx.fillRect(0, 0, 440, 320);
  wx.fillStyle = 'rgba(120,170,150,.35)'; for (let i = 0; i < 6; i++) { wx.beginPath(); wx.ellipse(40 + i * 70, 300, 60, 40 + (i % 3) * 14, 0, 0, Math.PI * 2); wx.fill(); }
  wx.fillStyle = '#FFFFFF'; wx.fillRect(0, 0, 440, 14); wx.fillRect(0, 306, 440, 14); wx.fillRect(0, 0, 14, 320); wx.fillRect(426, 0, 14, 320); wx.fillRect(213, 0, 14, 320);
  wx.fillStyle = 'rgba(255,255,255,.55)'; for (let y = 24; y < 150; y += 12) wx.fillRect(14, y, 412, 4);
  const wtex = new THREE.CanvasTexture(wc); wtex.colorSpace = THREE.SRGBColorSpace;
  const winM = new THREE.MeshBasicMaterial({ map: wtex, transparent: true, opacity: 0, toneMapped: false });
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), winM); win.rotation.y = Math.PI / 2; win.position.set(-4.13, 2.05, -0.6); scene.add(win);
  R.winM = winM;

  // bed
  const bed = new THREE.Group();
  const frameM = mat('#F3F6F5'); const cushionM = mat(C.teal3, { roughness: .55 }); const legM = mat('#9FB4AF', { metalness: .5, roughness: .35 });
  const frame = rbox(2.5, .26, 1, .06, frameM); frame.position.y = .62; bed.add(frame);
  [[-1.1, -.38], [1.1, -.38], [-1.1, .38], [1.1, .38]].forEach(([x, z]) => { const l = cyl(.04, .04, .5, legM, 12); l.position.set(x, .25, z); bed.add(l); });
  const cushion = rbox(2.4, .2, .94, .09, cushionM); cushion.position.y = .84; bed.add(cushion);
  const sheet = rbox(1.7, .025, .96, .012, mat('#FFFFFF', { roughness: .8 })); sheet.position.set(.32, .955, 0); bed.add(sheet);
  const pillow = rbox(.5, .14, .78, .07, mat(C.white, { roughness: .9 })); pillow.position.set(-.92, 1.0, 0); bed.add(pillow);
  bed.position.set(-.2, 0, -1.35); scene.add(bed);
  R.parts.bed = bed; R.parts.pillow = pillow; R.parts.sheet = sheet;

  // hanging light above bed
  const hang = new THREE.Group();
  const hangM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0, roughness: .3 });
  const bar = rbox(1.9, .06, .42, .03, hangM); hang.add(bar);
  const cableM = new THREE.MeshBasicMaterial({ color: '#7e9692' });
  [-.8, .8].forEach(x => { const c = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, 1.4, 4), cableM); c.position.set(x, .7, 0); hang.add(c); });
  hang.position.set(-.2, 3.05, -1.35); scene.add(hang);
  const hangLight = new THREE.PointLight('#ffffff', 0, 6, 1.6); hangLight.position.set(-.2, 2.7, -1.35); scene.add(hangLight);
  R.parts.hang = hang; R.hangM = hangM; R.hangLight = hangLight;

  // exam lamp
  const lamp = new THREE.Group(); const metal = mat('#DCE6E3', { metalness: .4, roughness: .3 });
  const lbase = cyl(.26, .3, .05, metal); lbase.position.y = .025; lamp.add(lbase);
  const pole = cyl(.025, .025, 1.7, metal, 10); pole.position.y = .87; lamp.add(pole);
  const arm = new THREE.Group(); arm.position.y = 1.72; lamp.add(arm);
  const armBar = cyl(.02, .02, .95, metal, 10); armBar.rotation.z = Math.PI / 2; armBar.position.x = -.47; arm.add(armBar);
  const headM = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#FFE9D6', emissiveIntensity: 0, roughness: .3 });
  const head = cyl(.07, .2, .2, headM); head.position.set(-.95, -.08, 0); arm.add(head);
  const lampLight = new THREE.SpotLight('#FFE3CC', 0, 5, .7, .6, 1.4); lampLight.position.set(-.95, -.15, 0); arm.add(lampLight);
  lampLight.target.position.set(-1.2, -2, 0); arm.add(lampLight.target);
  lamp.position.set(1.75, 0, -1.9); scene.add(lamp);
  R.parts.lamp = lamp; R.parts.arm = arm; R.headM = headM; R.lampLight = lampLight;

  // cart
  const cart = new THREE.Group(); const cartM = mat('#F6F8F7'); const postM = mat('#AFC2BE', { metalness: .5, roughness: .3 });
  [.32, .78].forEach(y => { const s = rbox(.84, .05, .52, .02, cartM); s.position.y = y; cart.add(s); });
  [[-.38, -.22], [.38, -.22], [-.38, .22], [.38, .22]].forEach(([x, z]) => { const p = cyl(.015, .015, .78, postM, 8); p.position.set(x, .41, z); cart.add(p); const w = new THREE.Mesh(new THREE.SphereGeometry(.035, 10, 8), postM); w.position.set(x, .035, z); cart.add(w); });
  const bottles = [];
  [[C.coral, -.25], [C.mint3, -.05], ['#ffffff', .15]].forEach(([c, x], i) => { const b = cyl(.06, .06, .22 + i * .04, mat(c, { roughness: .4 }), 16); b.position.set(x, .92 + i * .02, 0); cart.add(b); bottles.push(b); });
  const tray = rbox(.3, .03, .22, .01, mat('#DCE6E3', { metalness: .3 })); tray.position.set(.3, .82, .05); cart.add(tray);
  cart.position.set(-2.55, 0, -1.7); scene.add(cart);
  R.parts.cart = cart; R.parts.bottles = bottles;

  // stool
  const stool = new THREE.Group();
  const seat = cyl(.27, .27, .09, mat(C.teal3)); seat.position.y = .58; stool.add(seat);
  const sp = cyl(.03, .03, .5, postM, 10); sp.position.y = .3; stool.add(sp);
  const sbase = cyl(.24, .26, .04, postM); sbase.position.y = .03; stool.add(sbase);
  stool.position.set(1.25, 0, .15); scene.add(stool); R.parts.stool = stool;

  // plant
  const plant = new THREE.Group();
  const pot = cyl(.22, .17, .42, mat('#F2EEE8')); pot.position.y = .21; plant.add(pot);
  const leafM = mat('#3F8B6F', { roughness: .7 });
  for (let i = 0; i < 9; i++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(.16, 12, 10), leafM); const a = i / 9 * Math.PI * 2; lf.scale.set(.6, 1.7, .35); lf.position.set(Math.cos(a) * .16, .72 + (i % 3) * .14, Math.sin(a) * .16); lf.rotation.set(Math.sin(a) * .5, a, Math.cos(a) * .5); lf.castShadow = true; plant.add(lf); }
  plant.position.set(-3.55, 0, -2.45); scene.add(plant); R.parts.plant = plant;

  // folding screen (like the real exam room)
  const screen = new THREE.Group(); const scM = mat('#FFFFFF', { roughness: .9, transparent: true, opacity: .92, side: THREE.DoubleSide });
  [0, 1].forEach(i => { const pnl = new THREE.Mesh(new THREE.PlaneGeometry(.9, 1.7), scM); pnl.position.set(i * .82, 1.0, i * .32); pnl.rotation.y = -.38 + i * .76; pnl.castShadow = true; screen.add(pnl); });
  screen.position.set(2.6, 0, -.4); screen.rotation.y = -.9; scene.add(screen); R.parts.screen = screen;

  // slot screen on the back wall
  const pt = panelTexture(); R.panel = pt;
  const panelM = new THREE.MeshBasicMaterial({ map: pt.tex, transparent: true, opacity: 0, toneMapped: false });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .9), panelM); panel.position.set(-.2, 2.05, -2.99); scene.add(panel);
  R.panelM = panelM; R.parts.panel = panel;

  // lights
  R.hemi = new THREE.HemisphereLight('#ffffff', '#CFE7DF', 0); scene.add(R.hemi);
  R.sun = new THREE.DirectionalLight('#FFF6EC', 0); R.sun.position.set(-6, 8, 5); R.sun.castShadow = true;
  R.sun.shadow.mapSize.set(1024, 1024); Object.assign(R.sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 }); R.sun.shadow.bias = -.0005; R.sun.shadow.radius = 4;
  scene.add(R.sun);

  // remember clean transforms
  R.clean = {};
  for (const [k, o] of Object.entries(R.parts)) if (!Array.isArray(o)) R.clean[k] = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() };
  return R;
}

function place(R, k, dp = [0, 0, 0], dr = [0, 0, 0], s = 1) {
  const o = R.parts[k], c = R.clean[k];
  o.position.set(c.p.x + dp[0], c.p.y + dp[1], c.p.z + dp[2]);
  o.rotation.set(c.r.x + dr[0], c.r.y + dr[1], c.r.z + dr[2]);
  o.scale.copy(c.s).multiplyScalar(Math.max(.0001, s));
}

function makeScene(canvas, mode) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); }
  catch (e) { document.documentElement.classList.add('no-webgl'); return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene(); scene.background = C.night.clone(); scene.fog = new THREE.Fog(C.night.clone(), 11, 24);
  const cam = new THREE.PerspectiveCamera(36, 1, .1, 80);
  const R = buildRoom(scene);
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', e => { mouse.tx = (e.clientX / innerWidth - .5); mouse.ty = (e.clientY / innerHeight - .5); }, { passive: true });

  let sweep, sweepLight, dust, dustM;
  if (mode === 'reset') {
    // the cleaning sweep: a soft vertical sheet of light that walks through the room
    const sm = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uO: { value: 0 }, uC: { value: new THREE.Color(C.mint3) } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'varying vec2 vUv;uniform float uO;uniform vec3 uC;void main(){float x=1.-abs(vUv.x-.5)*2.;x=pow(x,3.);float y=smoothstep(0.,.15,vUv.y)*smoothstep(1.,.7,vUv.y);gl_FragColor=vec4(uC,x*y*uO*.85);}'
    });
    sweep = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 4.2, 1, 1), sm); sweep.rotation.y = Math.PI / 2; sweep.position.y = 2.0; scene.add(sweep);
    sweepLight = new THREE.PointLight(C.mint3, 0, 4.5, 1.2); sweepLight.position.y = 1.4; scene.add(sweepLight);
    // dust in the used room, cleared as the sweep passes
    const N = 520, pos = new Float32Array(N * 3), rnd = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - .5) * 8; pos[i * 3 + 1] = Math.random() * 3.2; pos[i * 3 + 2] = -3 + Math.random() * 5; rnd[i] = Math.random(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aR', new THREE.BufferAttribute(rnd, 1));
    dustM = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uSweep: { value: -10 }, uT: { value: 0 }, uPR: { value: renderer.getPixelRatio() } },
      vertexShader: 'attribute float aR;uniform float uSweep;uniform float uT;uniform float uPR;varying float vA;void main(){vec3 p=position;p.y+=sin(uT*.6+aR*20.)*.08;p.x+=cos(uT*.4+aR*12.)*.06;float cleared=smoothstep(uSweep-.2,uSweep+.6,p.x);vA=cleared*(.35+.65*aR);vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=(4.+aR*7.)*uPR*(6./-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: 'varying float vA;void main(){float d=length(gl_PointCoord-.5);float a=smoothstep(.5,0.,d);gl_FragColor=vec4(1.,.86,.72,a*vA*.7);}'
    });
    dust = new THREE.Points(g, dustM); scene.add(dust);
  }

  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(canvas); size();

  let visible = false; new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { rootMargin: '100px' }).observe(canvas);
  const look = new THREE.Vector3();
  const bgTmp = new THREE.Color();

  function heroFrame(p, t) {
    const L = easeIO(seg(p, .02, .24));
    bgTmp.copy(C.night).lerp(C.paper, L); scene.background.copy(bgTmp); scene.fog.color.copy(bgTmp);
    R.hemi.intensity = .06 + L * 1.05; R.sun.intensity = L * 1.7; R.winM.opacity = L * .9;
    // hanging light drops in first and switches on
    const h = ease(seg(p, .04, .2)); place(R, 'hang', [0, (1 - h) * 2.2, 0]);
    R.hangM.emissiveIntensity = seg(p, .1, .24) * 2.2 + Math.max(0, .4 - L) * (seg(p, .14, .16));
    R.hangLight.intensity = seg(p, .1, .24) * 5;
    // each item arrives in its own time, like staff setting a room
    const b = ease(seg(p, .18, .4)); place(R, 'bed', [0, (1 - b) * -1.4, 0], [0, (1 - b) * .4, 0], .6 + .4 * b);
    const lp = ease(seg(p, .27, .47)); place(R, 'lamp', [(1 - lp) * 1.5, 0, 0], [0, 0, 0], lp);
    R.parts.arm.rotation.y = (1 - lp) * 2.2 + Math.sin(t * .5) * .03;
    const ct = ease(seg(p, .33, .53)); place(R, 'cart', [(1 - ct) * -3.2, 0, 0], [0, (1 - ct) * -.8, 0], ct > .001 ? 1 : 0);
    R.parts.bottles.forEach((bt, i) => { const q = ease(seg(p, .45 + i * .03, .55 + i * .03)); bt.scale.setScalar(Math.max(.0001, q)); });
    const st = ease(seg(p, .38, .56)); place(R, 'stool', [0, (1 - st) * 2.4, 0], [0, (1 - st) * 2, 0], st > .001 ? 1 : 0);
    const pl = ease(seg(p, .42, .6)); place(R, 'plant', [0, 0, 0], [0, (1 - pl) * 1.5, 0], pl);
    const sc = ease(seg(p, .3, .5)); place(R, 'screen', [0, 0, 0], [0, (1 - sc) * 1.2, 0], .2 + .8 * sc);
    const pw = ease(seg(p, .22, .38)); place(R, 'pillow', [0, (1 - pw) * 1.2, 0], [0, 0, 0], pw > .001 ? 1 : 0);
    // lamp warms up, slot panel appears and confirms
    R.headM.emissiveIntensity = seg(p, .5, .62) * 2.4; R.lampLight.intensity = seg(p, .5, .62) * 7;
    const pa = seg(p, .52, .62), cf = seg(p, .7, .8);
    R.panelM.opacity = pa;
    if (cf > .5) R.panel.draw('ROOM 2  -  DR. RAO', '09:30 ok', C.coral, '#ffffff');
    else R.panel.draw('ROOM 2  -  NEXT SLOT', '09:30', '#ffffff', C.teal);
    // camera glides from a wide night view into the ready room
    const k = easeIO(seg(p, 0, 1));
    const portrait = cam.aspect < .9; const far = portrait ? 1.42 : 1; scene.fog.near = portrait ? 15 : 11; scene.fog.far = portrait ? 32 : 24;
    cam.position.set(lerp(8.5, 4.4, k) * far + mouse.x * .6, lerp(6.4, 3.1, k) * (portrait ? 1.25 : 1) - mouse.y * .3, lerp(10, 5.9, k) * far);
    // landscape: room sits right of the headline; portrait: room sits above it
    if (portrait) look.set(lerp(-.3, -.2, k), lerp(-.2, .1, k), lerp(-1.4, -1.2, k));
    else look.set(lerp(-1.9, -2.2, k), lerp(.4, .9, k), lerp(-1.4, -1.0, k));
    cam.lookAt(look);
    cam.fov = portrait ? 44 : 36; cam.updateProjectionMatrix();
  }

  function resetFrame(r, t) {
    // night room after the last visit: dim, disordered, dusty
    const sx = lerp(-5.2, 5.2, easeIO(seg(r, .14, .74)));
    const done = seg(r, .72, .9);
    bgTmp.set('#0A1C1B').lerp(new THREE.Color('#123533'), done); scene.background.copy(bgTmp); scene.fog.color.copy(bgTmp);
    R.hemi.intensity = .28 + done * .3; R.sun.intensity = .25 + done * .3; R.winM.opacity = .06 + done * .12;
    R.hangM.emissiveIntensity = .15 + done * 1.6; R.hangLight.intensity = .6 + done * 2.6;
    R.headM.emissiveIntensity = .3; R.lampLight.intensity = 1.6 + done * 2;
    const f = k => easeIO(clamp((sx - R.clean[k].p.x + .6) / 1.4)); // 0 = messy, 1 = clean once sweep passed
    const m = k => 1 - f(k);
    place(R, 'bed', [0, 0, 0], [0, m('bed') * .08, 0]);
    place(R, 'pillow', [m('bed') * .7, m('bed') * -.05, m('bed') * .3], [m('bed') * .2, m('bed') * .6, m('bed') * .35]);
    place(R, 'sheet', [m('bed') * -.1, 0, m('bed') * .15], [0, m('bed') * .25, 0]);
    place(R, 'cart', [m('cart') * 1.3, 0, m('cart') * .9], [0, m('cart') * .7, 0]);
    place(R, 'stool', [m('stool') * .5, m('stool') * .27, m('stool') * .8], [0, 0, m('stool') * 1.5]);
    place(R, 'lamp', [0, 0, 0], [0, m('lamp') * .5, 0]); R.parts.arm.rotation.y = m('lamp') * 1.6;
    place(R, 'plant', [0, 0, 0], [0, 0, m('plant') * .08]);
    place(R, 'screen', [m('screen') * -.4, 0, m('screen') * .5], [0, m('screen') * .6, 0]);
    place(R, 'hang', [0, 0, 0]);
    R.parts.bottles.forEach((bt, i) => { const q = f('cart'); bt.scale.setScalar(1); bt.position.y = .92 + i * .02; bt.rotation.z = (1 - q) * (i === 1 ? 1.4 : 0); bt.position.x = [-.25, -.05, .15][i] + (1 - q) * (i === 1 ? .1 : 0); });
    // sweep light
    const so = seg(r, .1, .18) * (1 - seg(r, .72, .8));
    sweep.position.x = sx; sweep.material.uniforms.uO.value = so; sweepLight.position.x = sx; sweepLight.intensity = so * 9;
    dustM.uniforms.uSweep.value = sx; dustM.uniforms.uT.value = t;
    // panel
    R.panelM.opacity = 1;
    if (done > .4) R.panel.draw('ROOM 2  -  RESET BY VIKRAM', 'Ready', C.mint3, C.teal);
    else R.panel.draw('ROOM 2  -  VISIT ENDED', '10:15', '#1d4b48', '#ffffff');
    const portrait = cam.aspect < .9; const far = portrait ? 1.45 : 1; scene.fog.near = portrait ? 15 : 11; scene.fog.far = portrait ? 32 : 24;
    const k = easeIO(r);
    cam.position.set((lerp(-2.2, 3.4, k) + (portrait ? 0 : -1.4)) * far + mouse.x * .5, (lerp(3.6, 3.2, k)) * (portrait ? 1.2 : 1) - mouse.y * .3, lerp(6.6, 6.4, k) * far);
    look.set(portrait ? -.2 : -1.3, portrait ? 1.0 : .8, -1.2); cam.lookAt(look);
    cam.fov = portrait ? 46 : 38; cam.updateProjectionMatrix();
  }

  const clock = new THREE.Clock();
  let smooth = 0;
  return function tick() {
    if (!visible) return;
    const t = clock.getElapsedTime();
    mouse.x += (mouse.tx - mouse.x) * .05; mouse.y += (mouse.ty - mouse.y) * .05;
    const target = mode === 'hero' ? CS.heroP : CS.resetP;
    smooth += (target - smooth) * .12;
    if (mode === 'hero') heroFrame(smooth, t); else resetFrame(smooth, t);
    renderer.render(scene, cam);
  };
}

const ticks = [];
const h = document.getElementById('heroCanvas'), r = document.getElementById('resetCanvas');
if (h) { const f = makeScene(h, 'hero'); if (f) ticks.push(f); }
if (r) { const f = makeScene(r, 'reset'); if (f) ticks.push(f); }
document.fonts && document.fonts.ready.then(() => { /* panel text redraws with real fonts */ window.CS.fontsReady = true; });
(function loop() { ticks.forEach(f => f()); requestAnimationFrame(loop); })();
