const { chromium } = require('/Users/kris/mkk/node_modules/playwright-core');
(async () => {
  const b = await chromium.launch();
  let pass = 0, fail = 0; const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? 'PASS ' : 'FAIL ') + m); };
  for (const [name, vp] of [['phone', {width: 390, height: 844}], ['quest', {width: 1280, height: 720}], ['tablet', {width: 820, height: 1180}]]) {
    const p = await b.newPage({viewport: vp});
    const sent = [];
    p.on('request', r => { if (r.url().includes('feedback-vaikai') && r.method() === 'POST') sent.push(r.postData()); });
    const resp = [];
    p.on('response', r => { if (r.url().includes('feedback-vaikai') && r.request().method() === 'POST') resp.push(r.status()); });
    await p.goto('http://localhost:8765/?p=' + (name === 'phone' ? 'jr' : 'vr') + '&l=3&t=1');
    await p.click('#go');
    for (let k = 0; k < 4; k++) { await p.waitForSelector('.opt'); await p.locator('.opt').nth((k + 2) % 4).click(); }
    await p.waitForSelector('text=Ačiū!');
    await p.waitForTimeout(2500);
    ok(sent.length === 1, `${name}: 1 POST sent`);
    ok(resp[0] === 200, `${name}: server 200 (${resp[0]})`);
    const body = JSON.parse(sent[0] || '{}');
    ok(body.a && body.a.length === 4 && !JSON.stringify(body).match(/name|vardas|device/i), `${name}: payload 4 answers, no PII keys ${sent[0]}`);
    const sw = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    ok(sw, `${name}: no horizontal scroll`);
    ok(await p.locator('footer').innerText().then(t => t.includes('Eksperimentinis prototipas')), `${name}: disclaimer visible`);
    await p.waitForTimeout(1500);
    ok(await p.locator('#go').count() === 1, `${name}: auto-reset for next child`);
    await p.click('#go'); await p.waitForSelector('.opt');
    await p.screenshot({path: `/Users/kris/bc-feedback/tests/ui-${name}.png`});
    await p.close();
  }
  const q = await b.newPage({viewport: {width: 390, height: 900}});
  await q.goto('http://localhost:8765/qr.html'); await q.waitForTimeout(800);
  ok(await q.locator('#qk canvas, #qk img').count() > 0 && await q.locator('#qm canvas, #qm img').count() > 0, 'qr: both QR codes render');
  ok((await q.locator('#um').innerText()).includes('agent_9001m3hecdmbf7d9njsf8933pe97'), 'qr: VR mentor link');
  await q.selectOption('#p', 'jr'); await q.fill('#l', '4');
  ok((await q.locator('#uk').innerText()).includes('?p=jr&l=4') && (await q.locator('#um').innerText()).includes('agent_1801'), 'qr: switches to Jr + lesson 4');
  await q.screenshot({path: '/Users/kris/bc-feedback/tests/ui-qr.png', fullPage: true});
  const pk = await b.newPage(); await pk.goto('http://localhost:8765/');
  ok(await pk.locator('text=Kuri programa?').count() === 1, 'picker shown without ?p');
  console.log(`\n${pass}/${pass + fail} passed`);
  await b.close();
})();
