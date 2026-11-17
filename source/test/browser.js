const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');
const file = 'file://' + path.resolve(__dirname, '../dist/index.html');
const out = path.resolve(__dirname, '../shots'); fs.mkdirSync(out, { recursive: true });

async function checkButtons(page, label) {
  return page.evaluate((label) => {
    const vw = innerWidth, vh = innerHeight, probs = [];
    const vis = [...document.querySelectorAll('button')].filter(b => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && b.offsetParent !== null; });
    const rects = vis.map(b => ({ b, r: b.getBoundingClientRect(), t: (b.textContent || b.getAttribute('aria-label')).trim().slice(0, 12) }));
    rects.forEach(({ r, t }) => { if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) probs.push(label + ' 화면 밖: ' + t); });
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i].r, b = rects[j].r;
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) probs.push(label + ' 겹침: ' + rects[i].t + ' / ' + rects[j].t);
    }
    const minSize = Math.min(...rects.map(x => Math.min(x.r.width, x.r.height)));
    return { probs, count: rects.length, minSize: Math.round(minSize) };
  }, label);
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const sizes = [['tablet-1024x768', 1024, 768, true], ['tablet-1280x800', 1280, 800, true], ['phone-844x390', 844, 390, true], ['phone-portrait-390x844', 390, 844, true]];
  const report = []; let fail = 0;
  for (const [name, w, h, touch] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: false, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(String(e)));
    await page.goto(file); await page.waitForTimeout(400);
    const portrait = h > w;
    if (portrait) {
      const rot = await page.isVisible('#rotate');
      report.push(`${name}: 가로 안내 표시=${rot}`); if (!rot) fail++;
      await page.screenshot({ path: `${out}/${name}-rotate.png` });
      await page.click('#rotate-ok');
    }
    const shots = [];
    async function shot(tag) { await page.waitForTimeout(250); await page.screenshot({ path: `${out}/${name}-${tag}.png` }); const c = await checkButtons(page, name + '/' + tag); shots.push(`${tag}(버튼 ${c.count}개, 최소 ${c.minSize}px)`); c.probs.forEach(p => { report.push('  ⚠ ' + p); fail++; }); }
    await shot('1-title');
    await page.click('#btn-new'); await shot('2-name');
    await page.click('#name-ok'); await page.click('[data-mon="zzi"]'); await shot('3-pick');
    await page.click('#pick-ok'); await page.waitForTimeout(400); await shot('4-town-dialog');
    for (let i = 0; i < 8 && await page.isVisible('#dialog'); i++) { await page.click('#dialog'); }
    // 실제 버튼으로 이동: 위로 눌러서 덧셈 필드로
    await page.evaluate(() => MM.goto('town', 11, 3, 'up'));
    for (let i = 0; i < 3; i++) { await page.click('#dpad .up'); await page.waitForTimeout(260); }
    await page.waitForTimeout(700);
    const mapId = await page.evaluate(() => MM.map().id);
    if (mapId !== 'fadd') { report.push(`  ⚠ ${name}: 방향 버튼 이동 실패 (${mapId})`); fail++; }
    await shot('5-field');
    await page.evaluate(() => { MM.startWild('add', 1); });
    await page.waitForTimeout(300); await shot('6-battle-intro');
    await page.click('#qmsg'); await page.waitForTimeout(1300);
    await shot('7-battle-question');
    // 오답 → 힌트 열기
    const wrongQ = await page.evaluate(() => MM.battle().problem.text);
    await page.click('[data-k="9"]'); await page.click('[data-k="9"]'); await page.click('[data-k="ok"]');
    // 정답 공개 → 공격 → 새 문제까지 메시지를 눌러 넘김
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(400);
      if (await page.evaluate(() => MM.waitingMsg())) await page.click('#qmsg');
      else if (await page.evaluate(() => !MM.qLocked())) break;
    }
    await page.waitForTimeout(300);
    const hpA = await page.evaluate(() => MM.battle().ally.hp);
    if (hpA !== 25) { report.push(`  ⚠ ${name}: 오답 후 HP ${hpA}`); fail++; }
    const newQ = await page.evaluate(() => MM.battle().problem.text);
    if (newQ === wrongQ) { report.push(`  ⚠ ${name}: 오답 후 문제가 바뀌지 않음`); fail++; }
    await shot('8-battle-hint');
    const ans = await page.evaluate(() => MM.battle().problem.answer);
    await page.click('#hint-x');
    for (const ch of String(ans)) await page.click(`[data-k="${ch}"]`);
    await page.click('[data-k="ok"]'); await page.waitForTimeout(500); await shot('9-battle-attack');
    await page.waitForTimeout(2000);
    await page.click('#act-run'); await page.waitForTimeout(300); await page.click('#qmsg'); await page.waitForTimeout(300);
    // 체육관 문장제
    await page.evaluate(() => { MM.state().fields.div.wins = 5; MM.state().fields.div.open = 3; MM.startBoss('gym', 'div', 3); });
    await page.waitForTimeout(300); await page.click('#qmsg'); await page.waitForTimeout(1300); await shot('10-gym-word');
    await page.evaluate(() => { MM.speed = 0; });
    // 최종 보스
    await page.evaluate(() => { MM.startBoss('final', null, 3); });
    await page.waitForTimeout(100); await page.click('#qmsg'); await page.waitForTimeout(200); await page.evaluate(() => { MM.speed = 1; }); await shot('11-final');
    await page.evaluate(() => { MM.speed = 0; });
    for (let i = 0; i < 80 && await page.evaluate(() => MM.battleActive()); i++) {
      if (await page.evaluate(() => MM.waitingMsg())) await page.click('#qmsg');
      else if (!(await page.evaluate(() => MM.qLocked()))) { await page.click('[data-k="1"]'); await page.click('[data-k="ok"]'); }
      await page.waitForTimeout(40);
    }
    const lostTo = await page.evaluate(() => MM.map().id + ':' + MM.state().x + ',' + MM.state().y);
    if (lostTo !== 'town:18,14') { report.push('  ⚠ 최종 보스 패배 후 위치 ' + lostTo); fail++; }
    await page.evaluate(() => { MM.speed = 1; });
    // 메뉴, 저장
    await page.evaluate(() => { MM.goto('fdiv', 14, 18, 'up'); });
    await page.click('#menubtn'); await shot('12-menu');
    await page.click('#m-save'); await shot('13-save');
    await page.click('#save-close');
    // 교사용
    await page.click('#menubtn'); await page.click('#m-title'); await page.click('#btn-teacher'); await shot('14-teacher');
    // 건물 안
    await page.click('#set-back'); await page.click('#btn-resume'); await page.evaluate(() => MM.goto('ifdiv3', 6, 4, 'up')); await shot('15-gym-inside');
    report.push(`${name}: 스크린샷 ${shots.length}장 / ${shots.join(', ')}`);
    report.push(`${name}: 콘솔 오류 ${errs.length}건` + (errs.length ? ' → ' + errs.join(' | ') : ''));
    fail += errs.length;
    await ctx.close();
  }
  // Apps Script와 비슷한 샌드박스 iframe 안에서 실행
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(String(e))); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const src = fs.readFileSync(path.resolve(__dirname, '../dist/index.html'), 'utf8');
  await page.setContent(`<html><body style="margin:0"><iframe id="f" sandbox="allow-scripts allow-forms allow-popups allow-modals" style="border:0;width:100vw;height:100vh"></iframe></body></html>`);
  await page.evaluate(s => { document.getElementById('f').srcdoc = s; }, src);
  await page.waitForTimeout(800);
  const fr = page.frames()[1];
  await fr.click('#btn-new'); await fr.click('#name-ok'); await fr.click('[data-mon="mul"]'); await fr.click('#pick-ok'); await page.waitForTimeout(300);
  const ok = await fr.evaluate(() => MM.state() && MM.state().mon);
  await fr.evaluate(() => { for (let i = 0; i < 5; i++) MM.advance(); });
  await fr.click('#menubtn'); await fr.click('#m-save'); await fr.click('#save-copy'); await page.waitForTimeout(300);
  const msg = await fr.textContent('#save-msg');
  report.push(`샌드박스 iframe: 게임 시작=${ok}, 복사 버튼 안내="${msg}", 오류 ${errs.length}건` + (errs.length ? ' → ' + errs.join(' | ') : ''));
  fail += errs.length; if (ok !== 'mul') fail++;
  await page.screenshot({ path: `${out}/iframe-save.png` });
  await browser.close();
  console.log(report.join('\n'));
  console.log('FAIL_COUNT=' + fail);
})().catch(e => { console.error(e); process.exit(1); });
