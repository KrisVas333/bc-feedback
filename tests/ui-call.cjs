// Headless UI test: docs/skambutis.html (the call page) + the third QR on qr.html.
// Part A (real SDK from cdn.jsdelivr.net): loads, SDK import resolves, both buttons present, no horizontal scroll at 390 / 820 / 1280.
// Part B (mocked session, no ElevenLabs call): Vaikų ratas starts MUTED, hold-to-talk unmutes only while held (pointer, touch, spacebar),
// dynamic variables passed, goodbye line ends the call; Mentorius = open mic, no hold button.
// Serve docs first: python3 -m http.server 8766 -d docs (PORT env overrides).
const { chromium } = require('/Users/kris/mkk/node_modules/playwright-core');
const BASE = 'http://localhost:' + (process.env.PORT || 8766);
const Q = `?p=vr&l=9&vieta=${encodeURIComponent('Šiaurės licėjus')}&data=2020-02-02&t=1&k=12`;
const MOCK = () => {
  window.__log = { starts: [], mute: [], ended: 0 };
  window.__BC_MOCK_SDK = { Conversation: { startSession: async (o) => {
    window.__log.starts.push({ agentId: o.agentId, dyn: o.dynamicVariables, conn: o.connectionType });
    const c = { setMicMuted: (m) => window.__log.mute.push(m), endSession: async () => { window.__log.ended++; o.onDisconnect && o.onDisconnect({ reason: 'user' }); }, getId: () => 'mock' };
    o.onConversationCreated && o.onConversationCreated(c);
    window.__mockOpts = o;
    setTimeout(() => { o.onConnect({ conversationId: 'mock' }); o.onModeChange({ mode: 'speaking' }); }, 50);
    return c;
  } } };
};
(async () => {
  const b = await chromium.launch();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const noHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // ---------- A: real SDK ----------
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1180 }], ['desktop', { width: 1280, height: 800 }]]) {
    const p = await b.newPage({ viewport: vp });
    const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    const t0 = Date.now();
    const r = await p.goto(BASE + '/skambutis.html' + Q);
    ok(r.status() === 200, `${name}: page 200`);
    await p.waitForFunction(() => window.__bc && window.__bc.sdk !== 'loading', null, { timeout: 20000 }).catch(() => {});
    const sdk = await p.evaluate(() => window.__bc.sdk);
    ok(sdk === 'ok', `${name}: @elevenlabs/client ESM import resolved (${sdk}, ${Date.now() - t0} ms)`);
    ok(await p.isVisible('#go-m') && await p.isVisible('#go-r'), `${name}: both call buttons visible`);
    ok(!(await p.isDisabled('#go-m')) && !(await p.isDisabled('#go-r')), `${name}: both buttons enabled after SDK load`);
    ok((await p.textContent('#go-m')).includes('Skambinti · Mentorius') && (await p.textContent('#go-r')).includes('Skambinti · Vaikų ratas'), `${name}: button labels`);
    ok((await p.textContent('#lesson')).includes('L9') && (await p.textContent('#lesson')).includes('12 vaikų'), `${name}: URL params shown (L9 · 12 vaikų)`);
    ok((await p.textContent('footer')).includes('AI · eksperimentinis · gali klysti · garsas nesaugomas'), `${name}: footer disclaimer`);
    ok(await noHScroll(p), `${name}: no horizontal scroll`);
    const bh = (await p.locator('#go-r').boundingBox()).height;
    ok(bh >= 64, `${name}: call button tall enough (${Math.round(bh)} px)`);
    ok(errs.length === 0, `${name}: no console errors ${errs.slice(0, 2).join(' | ')}`);
    await p.screenshot({ path: __dirname + `/ui-call-${name}.png`, fullPage: true });
    await p.close();
  }

  // ---------- B: mocked session ----------
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const p = await ctx.newPage();
  await p.addInitScript(MOCK);
  await p.goto(BASE + '/skambutis.html' + Q);
  await p.waitForFunction(() => window.__bc.sdk === 'ok');
  await p.click('#go-r');
  await p.waitForFunction(() => window.__bc.state === 'connected');
  let L = await p.evaluate(() => window.__log);
  ok(L.starts[0].agentId === 'agent_6501m3p8yeamedq9err079bkgdcx', 'ratas: Vaikų ratas agent id used');
  ok(L.starts[0].dyn.pradzia === 'Devinta pamoka, Šiaurės licėjus, dvylika vaikų, teisingai?', `ratas: pradzia = ${L.starts[0].dyn.pradzia}`);
  ok(L.starts[0].dyn.vaiku_sk === '12' && L.starts[0].dyn.pamoka === '9' && L.starts[0].dyn.bandymas === 'taip' && L.starts[0].dyn.data === '2020-02-02', 'ratas: dynamic vars pamoka/vaiku_sk/data/bandymas');
  ok(L.mute.length > 0 && L.mute.every((m) => m === true), `ratas: mic muted by default (${JSON.stringify(L.mute)})`);
  ok(await p.evaluate(() => window.__bc.muted) === true, 'ratas: state muted before any press');
  ok(await p.isVisible('#ptt') && await p.isVisible('#hint'), 'ratas: hold button + hint visible');
  ok((await p.textContent('#hint')).includes('Laikyk, kai perduodi vaikų atsakymus. Vaikai kalba tau, ne telefonui.'), 'ratas: hint text exact');
  ok((await p.locator('#ptt').boundingBox()).height >= 200, `ratas: hold button is huge (${Math.round((await p.locator('#ptt').boundingBox()).height)} px)`);
  ok(await noHScroll(p), 'ratas in-call: no horizontal scroll at 390');
  await p.evaluate(() => window.__mockOpts.onModeChange({ mode: 'listening' }));
  ok((await p.textContent('#stxt')).includes('Mikrofonas išjungtas'), 'ratas: status says mic off while not held');
  // mouse hold
  const box = await p.locator('#ptt').boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.down();
  ok(await p.evaluate(() => window.__bc.muted) === false && await p.getAttribute('#ptt', 'aria-pressed') === 'true', 'ratas: mouse down -> UNMUTED, pressed');
  ok((await p.textContent('#stxt')).includes('Kraist klauso'), 'ratas: status Kraist klauso while held');
  await p.screenshot({ path: __dirname + '/ui-call-ratas-held.png' });
  await p.mouse.up();
  ok(await p.evaluate(() => window.__bc.muted) === true && await p.getAttribute('#ptt', 'aria-pressed') === 'false', 'ratas: mouse up -> MUTED again');
  // touch (pointer events from a touch device)
  await p.dispatchEvent('#ptt', 'pointerdown', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  ok(await p.evaluate(() => window.__bc.muted) === false, 'ratas: touch down -> UNMUTED');
  await p.dispatchEvent('#ptt', 'pointerup', { pointerId: 7, pointerType: 'touch', isPrimary: true });
  ok(await p.evaluate(() => window.__bc.muted) === true, 'ratas: touch up -> MUTED');
  await p.dispatchEvent('#ptt', 'pointerdown', { pointerId: 8, pointerType: 'touch' });
  await p.dispatchEvent('#ptt', 'pointercancel', { pointerId: 8, pointerType: 'touch' });
  ok(await p.evaluate(() => window.__bc.muted) === true, 'ratas: touch cancel (finger slides off) -> MUTED');
  // spacebar
  await p.keyboard.down('Space');
  ok(await p.evaluate(() => window.__bc.muted) === false, 'ratas: Space down -> UNMUTED');
  await p.keyboard.up('Space');
  ok(await p.evaluate(() => window.__bc.muted) === true, 'ratas: Space up -> MUTED');
  // goodbye ends the call after it is spoken
  await p.evaluate(() => { window.__mockOpts.onModeChange({ mode: 'speaking' }); window.__mockOpts.onMessage({ source: 'ai', message: "Ačiū, komanda! Mentoriau, ačiū, perduosiu Kris'ui ir Gabrieliui." }); window.__mockOpts.onModeChange({ mode: 'listening' }); });
  await p.waitForFunction(() => window.__bc.state === 'ended', null, { timeout: 5000 }).catch(() => {});
  L = await p.evaluate(() => window.__log);
  ok(L.ended === 1 && await p.isVisible('#after'), 'ratas: goodbye line -> call ended, thank-you screen');
  await p.close();

  // mentor: open mic, no hold button, Baigti ends
  const m = await ctx.newPage();
  await m.addInitScript(MOCK);
  await m.goto(BASE + '/skambutis.html' + Q);
  await m.waitForFunction(() => window.__bc.sdk === 'ok');
  await m.click('#go-m');
  await m.waitForFunction(() => window.__bc.state === 'connected');
  L = await m.evaluate(() => window.__log);
  ok(L.starts[0].agentId === 'agent_9001m3hecdmbf7d9njsf8933pe97', 'mentor: VR mentor agent id used');
  ok(L.starts[0].dyn.pradzia === 'Devinta pamoka, Šiaurės licėjus, teisingai? Ir kiek vaikų buvo?', `mentor: pradzia = ${L.starts[0].dyn.pradzia}`);
  ok(!L.mute.includes(true), 'mentor: mic never muted (open mic)');
  ok(!(await m.isVisible('#ptt')), 'mentor: no hold button');
  ok((await m.textContent('#stxt')).includes('Kraist kalba'), 'mentor: status Kraist kalba');
  ok(/^0:0\d$/.test(await m.textContent('#timer')), 'mentor: timer running');
  await m.click('#end');
  L = await m.evaluate(() => window.__log);
  ok(L.ended === 1 && await m.isVisible('#after'), 'mentor: Baigti ends the session');
  await m.close();

  // missing params -> inputs, jr hides Vaikų ratas
  const e = await ctx.newPage(); await e.addInitScript(MOCK);
  await e.goto(BASE + '/skambutis.html');
  ok(await e.isVisible('#l') && await e.isVisible('#v') && await e.isVisible('#k'), 'no params: pamoka/vieta/vaikų sk. inputs shown');
  await e.fill('#l', '3'); await e.fill('#v', 'Test mokykla'); await e.fill('#k', '21');
  await e.waitForFunction(() => window.__bc.sdk === 'ok');
  await e.click('#go-r'); await e.waitForFunction(() => window.__bc.state === 'connected');
  L = await e.evaluate(() => window.__log);
  ok(L.starts[0].dyn.pradzia === 'Trečia pamoka, Test mokykla, dvidešimt vienas vaikas, teisingai?', `inputs: pradzia = ${L.starts[0].dyn.pradzia}`);
  await e.goto(BASE + '/skambutis.html?p=jr&l=2');
  ok(!(await e.isVisible('#go-r')) && await e.isVisible('#go-m'), 'jr: Vaikų ratas hidden, mentor button stays');
  await e.close();

  // qr.html: third QR
  const qp = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await qp.goto(BASE + '/qr.html');
  await qp.fill('#l', '9');
  const us = await qp.getAttribute('#us', 'href');
  ok(us && us.includes('/skambutis.html?p=vr&l=9') && (await qp.locator('#qs canvas, #qs img').count()) > 0, `qr: third QR -> ${us}`);
  await qp.screenshot({ path: __dirname + '/ui-call-qr.png', fullPage: true });
  await b.close();
  console.log(`\n${pass}/${pass + fail} passed`);
  process.exit(fail ? 1 : 0);
})();
