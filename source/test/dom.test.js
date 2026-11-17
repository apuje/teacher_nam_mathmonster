const test = require('node:test');
const { after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(__dirname + '/../dist/index.html', 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', e => errors.push('jsdomError: ' + e.message));
vc.on('error', e => errors.push('console.error: ' + e));
const dom = new JSDOM(html, {
  runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) { w.HTMLCanvasElement.prototype.getContext = () => null; w.addEventListener('error', e => errors.push('window.error: ' + e.message)); }
});
const w = dom.window, d = w.document, MM = w.MM;
MM.speed = 0;
MM.encounterRate = 0;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => d.querySelector(s);
const click = s => { const e = typeof s === 'string' ? $(s) : s; assert.ok(e, 'element ' + s); e.click(); };
const choiceOpen = () => !!$('#dialog .choices button');
async function until(cond, label, max = 4000) {
  for (let i = 0; i < max; i++) {
    if (cond()) return;
    if (MM.waitingMsg()) MM.msgTap();
    else if (MM.dlgOpen() && !choiceOpen()) MM.advance();
    await sleep(1);
  }
  assert.fail('시간 초과: ' + label + ' | 최근: ' + MM.events.slice(-6).join(' / '));
}
async function fight(max) {
  for (let k = 0; k < max; k++) {
    await until(() => !MM.battleActive() || (!MM.qLocked() && MM.battle().enemy.hp > 0), '차례 대기');
    if (!MM.battleActive()) return;
    await ansCorrect();
  }
}
async function settle(n = 30) { for (let i = 0; i < n; i++) await sleep(1); }
async function waitQuestion() { await until(() => MM.battleActive() && !MM.qLocked(), '문제 대기'); }
async function answer(v, rem) {
  await waitQuestion();
  for (const ch of String(v)) click(`[data-k="${ch}"]`);
  if (rem !== undefined) { click('.slot[data-slot="1"]'); for (const ch of String(rem)) click(`[data-k="${ch}"]`); }
  click('[data-k="ok"]');
  await settle(5);
}
async function ansCorrect() { await waitQuestion(); await answer(MM.battle().problem.answer); }
async function ansWrong() { await waitQuestion(); await answer(MM.battle().problem.answer + 1); }
const st = () => MM.state();
const ev = () => MM.events.join('\n');

test('전체 흐름 (jsdom)', async (t) => {
  await t.test('타이틀 → 이름 → 몬스터 선택 → 마을', async () => {
    assert.strictEqual(MM.scene(), 'title');
    click('#btn-new'); assert.strictEqual(MM.scene(), 'name');
    $('#name-input').value = '가나다라마바사';
    click('#name-ok'); assert.strictEqual(MM.scene(), 'pick');
    assert.ok($('#pick-ok').disabled);
    click('[data-mon="bul"]'); assert.ok(!$('#pick-ok').disabled);
    click('#pick-ok'); await settle();
    assert.strictEqual(MM.scene(), 'map');
    assert.ok(MM.dlgOpen(), '박사 대화');
    await until(() => !MM.dlgOpen(), '대화 끝');
    assert.strictEqual(st().name, '가나다라마'); assert.strictEqual(st().mon, 'bul'); assert.strictEqual(st().map, 'town');
    assert.ok(!$('#hud').classList.contains('hidden') && !$('#pad').classList.contains('hidden'));
  });

  await t.test('출입구별 필드 연결', async () => {
    const cases = [['add', 11, 1, 'up'], ['sub', 22, 7, 'right'], ['mul', 11, 14, 'down'], ['div', 1, 7, 'left']];
    for (const [op, x, y, dir] of cases) {
      MM.goto('town', x, y, dir); assert.ok(MM.tryMove(dir));
      await until(() => MM.map().id === 'f' + op, op + ' 필드 입장');
      await settle();
      assert.deepStrictEqual([st().x, st().y], [22, 28]);
      assert.ok(MM.tryMove('down'));
      await until(() => MM.map().id === 'town', '마을 복귀'); await settle();
    }
  });

  await t.test('구역 잠금', async () => {
    MM.goto('fadd', 22, 16, 'up');
    assert.ok(!MM.tryMove('up'), '닫힌 문');
    assert.ok(MM.dlgOpen()); assert.match($('#dialog .txt').textContent, /닫혀/);
    await until(() => !MM.dlgOpen(), '문지기 대화');
    assert.deepStrictEqual([st().x, st().y], [22, 16]);
  });

  await t.test('전투: 정답 시 공격 모션 후 적 HP 감소', async () => {
    MM.events.length = 0;
    MM.startWild('add', 1);
    await waitQuestion();
    assert.strictEqual(MM.scene(), 'battle');
    const p = MM.battle().problem;
    assert.ok(p.a <= 9 && p.b <= 9);
    await answer(p.answer);
    await until(() => /hp:enemy:20/.test(ev()), '적 HP 20');
    const e = ev(); assert.ok(e.indexOf('anim:ally-attack') < e.indexOf('hp:enemy:20'));
    assert.strictEqual($('#e-num').textContent, '20 / 30');
  });

  await t.test('전투: 오답 시 정답 공개, 아군 HP 감소, 새 문제, 방어, 힌트 자동', async () => {
    await waitQuestion();
    MM.events.length = 0;
    const before = MM.battle().problem;
    await answer(before.answer + 1);
    await until(() => /hp:ally:\d+/.test(ev()), '아군 HP 감소');
    const e = ev(); assert.ok(e.indexOf('anim:enemy-attack') < e.indexOf('hp:ally:'));
    assert.ok(st().hp >= 17 && st().hp <= 20, '오답 피해 5~8: ' + st().hp);
    assert.ok(e.indexOf('정답은 ' + before.answer) >= 0, '정답 공개');
    await waitQuestion();
    assert.ok(MM.battle().problem !== before, '새 문제로 바뀜');
    assert.ok(!$('#hint').classList.contains('hidden'), '오답 후 힌트 자동');
    click('#act-guard'); assert.ok(MM.battle().guard);
    const h1 = st().hp;
    await ansWrong();
    await until(() => st().hp < h1, '방어 중 피해');
    assert.ok(h1 - st().hp >= 3 && h1 - st().hp <= 4, '방어 시 피해 3~4: ' + (h1 - st().hp));
    const h2 = st().hp;
    await ansWrong();
    await until(() => st().hp < h2, '세 번째 오답');
    assert.ok(h2 - st().hp >= 5 && h2 - st().hp <= 8, '오답 피해 5~8');
  });

  await t.test('몬스터 3마리 격파 → 2단계 구역 개방', async () => {
    await fight(6);
    await until(() => !MM.battleActive(), '첫 승리');
    assert.strictEqual(st().fields.add.wins, 1);
    for (let i = 0; i < 2; i++) {
      MM.startWild('add', 1);
      await fight(3);
      await until(() => !MM.battleActive(), '승리 ' + (i + 2));
    }
    assert.strictEqual(st().fields.add.wins, 3); assert.strictEqual(st().fields.add.open, 2);
    assert.match(ev(), /2단계 구역 문이 열렸어요/);
    MM.goto('fadd', 22, 16, 'up');
    assert.ok(MM.tryMove('up')); await settle();
    assert.deepStrictEqual([st().x, st().y], [22, 15]);
  });

  await t.test('도망가기', async () => {
    MM.startWild('sub', 1); await waitQuestion();
    click('#act-run');
    await until(() => !MM.battleActive(), '도망');
    assert.strictEqual(st().fields.sub.wins, 0);
  });

  await t.test('식당 회복과 NPC 대화', async () => {
    st().hp = 4;
    MM.goto('fadd', 28, 19, 'up');
    assert.ok(MM.tryMove('up'));
    await until(() => MM.map().id === 'ifadd0', '식당 입장'); await settle();
    assert.strictEqual(st().hp, 25);
    MM.goto('ifadd0', 6, 5, 'up'); MM.interact();
    assert.ok(MM.dlgOpen()); assert.match($('#dialog .who').textContent, /셰프/);
    await until(() => !MM.dlgOpen(), '셰프 대화');
    MM.goto('fadd', 14, 24, 'down'); MM.interact();
    assert.match($('#dialog .txt').textContent, /덧셈/);
    await until(() => !MM.dlgOpen(), '하린 대화');
  });

  await t.test('체육관: 단계 선택, 패배 시 필드 입구, 승리 시 뱃지', async () => {
    st().fields.mul.wins = 2;
    MM.goto('ifmul3', 6, 3, 'up'); MM.interact();
    assert.match($('#dialog .txt').textContent + MM.events.join(''), /./);
    await until(() => !MM.dlgOpen(), '3마리 안내');
    assert.ok(!MM.battleActive());
    st().fields.mul.wins = 3;
    MM.interact();
    await until(() => choiceOpen(), '단계 선택');
    assert.match($('#dialog .txt').textContent, /몇 단계/);
    assert.strictEqual(d.querySelectorAll('#dialog .choices button').length, 4);
    click('#dialog .choices button[data-choice="1"]');
    await waitQuestion();
    let p = MM.battle().problem;
    assert.ok(p.word && p.level === 2 && digits(p.a) === 2, '2단계 문장제');
    assert.strictEqual(MM.battle().ally.hp, 3);
    for (let i = 0; i < 3; i++) await ansWrong();
    await until(() => !MM.battleActive(), '패배');
    assert.strictEqual(MM.map().id, 'fmul'); assert.deepStrictEqual([st().x, st().y], [22, 28]);
    assert.strictEqual(st().fields.mul.wins, 0); assert.strictEqual(st().fields.mul.badge, 0);
    st().fields.mul.wins = 3;
    MM.goto('ifmul3', 6, 3, 'up'); MM.interact();
    await until(() => choiceOpen(), '단계 선택 2');
    click('#dialog .choices button[data-choice="0"]');
    await waitQuestion();
    assert.strictEqual(MM.battle().problem.level, 1);
    await ansWrong(); // 한 번 틀려도
    for (let i = 0; i < 3; i++) await ansCorrect();
    await until(() => !MM.battleActive(), '체육관 승리');
    assert.strictEqual(st().fields.mul.badge, 1);
    assert.strictEqual(d.querySelectorAll('#hud-badges .badge.on').length, 1);
  });
  function digits(n) { return String(n).length; }

  await t.test('나눗셈 3단계 몫·나머지 입력', async () => {
    st().fields.div.open = 3;
    MM.startWild('div', 3); await waitQuestion();
    const p = MM.battle().problem; assert.ok(p.twoPart);
    assert.strictEqual(d.querySelectorAll('#ans .slot').length, 2);
    await answer(p.answer, p.rem);
    await until(() => /hp:enemy:20/.test(ev()), '나머지 정답');
    click('#act-run'); await until(() => !MM.battleActive(), '도망');
  });

  await t.test('최종 보스 잠금 → 해금 → 엔딩', async () => {
    MM.goto('town', 18, 14, 'up');
    assert.ok(!MM.tryMove('up')); assert.match($('#dialog .txt').textContent, /잠겨/);
    await until(() => !MM.dlgOpen(), '잠김 안내');
    ['add', 'sub', 'div'].forEach(op => { st().fields[op].badge = 1; });
    assert.ok(MM.tryMove('up'));
    await until(() => MM.map().id === 'itown3', '전당 입장'); await settle();
    MM.goto('itown3', 6, 3, 'up'); MM.interact();
    await until(() => choiceOpen(), '도전 선택');
    click('#dialog .choices button[data-choice="0"]');
    await waitQuestion();
    const p = MM.battle().problem; assert.ok(p.mixed && p.text.includes('('));
    assert.strictEqual(MM.battle().enemy.hp, 5);
    for (let i = 0; i < 5; i++) await ansCorrect();
    await until(() => MM.scene() === 'ending', '엔딩');
    click('#end-ok'); assert.strictEqual(MM.scene(), 'title');
    assert.ok(!$('#btn-resume').classList.contains('hidden'));
    click('#btn-resume'); await settle(); assert.strictEqual(MM.scene(), 'map');
  });

  await t.test('저장 코드 생성과 이어하기, 잘못된 코드', async () => {
    MM.goto('fsub', 22, 28, 'up');
    click('#menubtn'); assert.ok($('#menu').classList.contains('show'));
    click('#m-save');
    const code = $('#save-code').value; assert.match(code, /^MM1\./);
    click('#save-copy'); await settle();
    click('#save-close');
    const before = JSON.stringify(st());
    click('#menubtn'); click('#m-title');
    click('#btn-load'); $('#load-input').value = 'MM1.잘못된코드'; click('#load-ok');
    assert.match($('#load-err').textContent, /올바른 저장 코드가 아닙니다/);
    assert.strictEqual(MM.scene(), 'load');
    $('#load-input').value = code; click('#load-ok'); await settle();
    assert.strictEqual(MM.scene(), 'map');
    assert.strictEqual(JSON.stringify(st()), before);
  });

  await t.test('교사용 설정: 힌트 항상, 시간제한, 초기화', async () => {
    click('#menubtn'); click('#m-title');
    click('#btn-teacher'); assert.strictEqual(MM.scene(), 'teacher');
    click('[data-set="hintAlways:1"]'); click('[data-set="hpBoost:2"]');
    assert.strictEqual(MM.settings.hintAlways, 1);
    click('#set-back'); click('#btn-resume'); await settle();
    assert.strictEqual(st().hp <= 60, true);
    MM.startWild('mul', 1); await waitQuestion();
    assert.ok(!$('#hint').classList.contains('hidden'), '힌트 항상');
    assert.strictEqual(MM.battle().ally.max, 60);
    click('#act-run'); await until(() => !MM.battleActive(), '도망');
    click('#menubtn'); click('#m-title'); click('#btn-teacher');
    click('#set-reset'); assert.ok($('#confirm').classList.contains('show'));
    click('#cf-yes'); await settle();
    assert.strictEqual(MM.state(), null);
    click('#set-back');
    assert.ok($('#btn-resume').classList.contains('hidden'));
  });

  await t.test('스크립트 오류 없음', () => {
    assert.deepStrictEqual(errors, []);
  });
});
after(() => { try { dom.window.close(); } catch (e) { } });
