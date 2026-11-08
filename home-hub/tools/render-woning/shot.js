const { chromium } = require('playwright');
(async () => {
  const qs = process.argv[2] || ''; const out = process.argv[3] || 'r.png';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +(process.env.VW||1200), height: +(process.env.VH||1380) } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('http://127.0.0.1:8790/render/index.html?' + qs);
  await p.waitForFunction(() => window.DONE, null, { timeout: 120000 });
  await p.screenshot({ path: out, omitBackground: true });
  console.log(JSON.stringify(await p.evaluate(() => window.PROJ)), errs);
  await b.close();
})();
