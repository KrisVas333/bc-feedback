// Headless UI test v2: kids VR 7-screen flow (phone 390 · Quest 1280x720 · tablet 820) + Jr 4 faces + QR page.
// Serve docs first: python3 -m http.server 8766 -d docs (PORT env overrides). Rows are sent to the real endpoint with t=1 (test rows).
const { chromium } = require('/Users/kris/mkk/node_modules/playwright-core');
const BASE = 'http://localhost:' + (process.env.PORT || 8766);
const DAY = '2020-02-02'; // fake test date, keeps test aggregates apart
(async () => {
  const b = await chromium.launch();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  const TAP_MIN = 44;
  for (const [name, vp] of [['phone', {width: 390, height: 844}], ['quest', {width: 1280, height: 720}], ['tablet', {width: 820, height: 1180}]]) {
    const p = await b.newPage({viewport: vp});
    const sent = [], resp = [], audio = [];
    p.on('request', r => { if (r.url().includes('feedback-vaikai') && r.method() === 'POST') sent.push(r.postData()); if (r.url().includes('/audio/vr/')) audio.push(r.url().split('/').pop()); });
    p.on('response', r => { if (r.url().includes('feedback-vaikai') && r.request().method() === 'POST') resp.push(r.status()); });
    await p.goto(BASE + `/?p=vr&l=1&t=1&vieta=${encodeURIComponent('Šiaurės licėjus')}&data=${DAY}`);
    await p.click('#go');
    const titles = [];
    let minTap = 1e9, overflow = false;
    // screen 1: 1-10 scale
    await p.waitForSelector('.scale .opt');
    titles.push(await p.locator('h1').innerText());
    ok(await p.locator('.scale .opt').count() === 10, `${name}: screen 1 has 10 scale buttons`);
    const measure = async () => {
      for (const bb of await p.locator('.opt').evaluateAll(els => els.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; })))
        minTap = Math.min(minTap, bb[0], bb[1]);
      overflow = overflow || await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    };
    await measure();
    await p.locator('.scale .opt').nth(7).click(); // 8/10
    // screens 2-6 + 7 (+ kodel)
    const picks = [2, 0, 0, 0, 0];
    for (let s = 0; s < 5; s++) {
      await p.waitForFunction(n => document.querySelector('.dots i:nth-child(' + n + ')')?.classList.contains('on'), s + 1);
      await p.waitForSelector('.grid:not(.scale) .opt');
      titles.push(await p.locator('h1').innerText()); await measure();
      if (s === 2) ok((await p.locator('.opt').allInnerTexts()).some(t => t.includes('Saugiai naudotis VR šalmu')), `${name}: screen 4 shows L1 goals from lessons.json`);
      await p.locator('.opt').nth(picks[s]).click();
    }
    await p.waitForFunction(() => document.querySelector('h1')?.innerText === 'Ar pakviestum draugą?');
    titles.push(await p.locator('h1').innerText()); await measure();
    ok(await p.locator('#back').count() === 1, `${name}: back button present on screen 7`);
    await p.locator('.opt').nth(0).click(); // taip
    await p.waitForFunction(() => document.querySelector('h1')?.innerText === 'Kodėl?');
    await measure();
    await p.locator('.opt').nth(1).click(); // ismokau
    await p.waitForSelector('text=Ačiū!');
    for (let w = 0; w < 40 && !resp.length; w++) await p.waitForTimeout(200); // wait up to 8 s for the server reply
    ok(titles.length === 7, `${name}: 7 question screens (${titles.join(' | ')})`);
    ok(sent.length === 1, `${name}: 1 POST sent`);
    ok(resp[0] === 200, `${name}: server 200 (${resp[0]})`);
    const body = JSON.parse(sent[0] || '{}');
    const r = body.r || {};
    ok(body.v === 2 && body.l === '1' && body.vieta === 'Šiaurės licėjus' && body.data === DAY && body.t === 1, `${name}: lesson/vieta/data/t from QR params`);
    ok(r.ivertinimas === 8 && r.smagiausia === 'komanda' && r.nepatiko === 'nieko' && r.ismoko === 'saugus_salmas' && r.panaudos === 'seimai' && r.daugiau === 'vr' && r.rekomenduotu === 'taip' && r.kodel === 'ismokau', `${name}: 8 enum answers ${JSON.stringify(r)}`);
    const keys = Object.keys(body).concat(Object.keys(r));
    ok(keys.every(k => ['v','p','l','t','vieta','data','r','ivertinimas','smagiausia','nepatiko','ismoko','panaudos','daugiau','rekomenduotu','kodel'].includes(k)) && Object.values(r).every(v => typeof v === 'number' || /^[a-z0-9_]+$/.test(v)), `${name}: only allow-listed keys, no free text (${keys.join(',')})`);
    ok(!overflow, `${name}: no horizontal scroll on any screen`);
    ok(minTap >= TAP_MIN, `${name}: smallest tap target ${Math.round(minTap)}px >= ${TAP_MIN}`);
    ok(audio.length >= 7, `${name}: question audio requested (${[...new Set(audio)].join(',')})`);
    ok(await p.locator('footer').innerText().then(t => t.includes('Eksperimentinis prototipas')), `${name}: disclaimer visible`);
    ok(await p.waitForSelector('#go', {timeout: 6000}).then(() => true, () => false), `${name}: auto-reset for next child (<= 3.5 s after Ačiū)`);
    await p.click('#go'); await p.waitForSelector('.scale .opt');
    await p.screenshot({path: `/Users/kris/bc-feedback/tests/ui-v2-${name}.png`});
    await p.close();
  }
  // back button restores previous screen and answer
  {
    const p = await b.newPage({viewport: {width: 390, height: 844}});
    await p.route('**/feedback-vaikai', r => r.fulfill({status: 200, body: '{"ok":1}'}));
    await p.goto(BASE + '/?p=vr&l=3&t=1');
    await p.click('#go'); await p.locator('.scale .opt').nth(4).click();
    await p.waitForSelector('#back'); await p.click('#back');
    ok(await p.locator('.scale .opt').count() === 10, 'back: returns to screen 1');
    await p.locator('.scale .opt').nth(2).click(); await p.waitForSelector('.grid:not(.scale) .opt');
    ok((await p.locator('.opt').allInnerTexts()).length === 6, 'back: screen 2 again (6 cards)');
    // lesson 3 is TODO in lessons.json -> generic goals, never "TODO" shown to a child
    for (let i = 0; i < 2; i++) { await p.locator('.opt').nth(0).click(); await p.waitForTimeout(250); }
    const t = (await p.locator('.opt').allInnerTexts()).join(' ');
    ok(!t.includes('TODO') && t.includes('Kažką naujo apie VR'), 'TODO lesson shows generic goals, no "TODO" text');
    await p.close();
  }
  // Jr unchanged: 4 faces, v1 payload
  {
    const p = await b.newPage({viewport: {width: 390, height: 844}});
    const sent = []; p.on('request', r => { if (r.url().includes('feedback-vaikai') && r.method() === 'POST') sent.push(r.postData()); });
    await p.goto(BASE + '/?p=jr&l=4&t=1'); await p.click('#go');
    for (let k = 0; k < 4; k++) { await p.waitForSelector('.opt'); ok(await p.locator('.opt').count() === 4, `jr: screen ${k + 1} has 4 faces`); await p.locator('.opt').nth(2).click(); }
    await p.waitForSelector('text=Ačiū!'); await p.waitForTimeout(2000);
    const body = JSON.parse(sent[0] || '{}');
    ok(body.p === 'jr' && body.a?.length === 4 && !body.v, `jr: v1 payload unchanged ${sent[0]}`);
    await p.close();
  }
  // QR page
  const q = await b.newPage({viewport: {width: 390, height: 1100}});
  await q.goto(BASE + '/qr.html'); await q.waitForTimeout(800);
  const today = await q.inputValue('#d');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(today), `qr: date defaults to today (${today})`);
  ok(await q.locator('#qk canvas, #qk img').count() > 0 && await q.locator('#qm canvas, #qm img').count() > 0, 'qr: both QR codes render');
  await q.fill('#l', '3'); await q.check('#t');
  const uk = await q.locator('#uk').innerText(), um = await q.locator('#um').innerText();
  ok(uk.includes('p=vr') && uk.includes('l=3') && uk.includes('vieta=%C5%A0iaur%C4%97s+lic%C4%97jus') && uk.includes('data=' + today) && uk.includes('t=1'), `qr: kids link carries p,l,vieta,data,t (${uk})`);
  ok(um.includes('agent_9001m3hecdmbf7d9njsf8933pe97') && um.includes('var_pamoka=3') && um.includes('var_vieta=') && um.includes('var_data=' + today) && um.includes('var_bandymas=taip') && um.includes('var_pradzia=Tre%C4%8Dia+pamoka'), `qr: mentor link carries dynamic vars (${um})`);
  await q.selectOption('#v', ''); await q.fill('#vk', 'Licėjus X <b>');
  ok((await q.locator('#uk').innerText()).includes('vieta=Lic%C4%97jus+X+b'), 'qr: "kita" free-text vieta sanitised');
  await q.screenshot({path: '/Users/kris/bc-feedback/tests/ui-v2-qr.png', fullPage: true});
  await q.selectOption('#p', 'jr');
  ok((await q.locator('#um').innerText()).includes('agent_1801') && !(await q.locator('#um').innerText()).includes('var_'), 'qr: Jr link = plain agent link');
  const pk = await b.newPage(); await pk.goto(BASE + '/');
  ok(await pk.locator('text=Kuri programa?').count() === 1, 'picker shown without ?p');
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
})();
