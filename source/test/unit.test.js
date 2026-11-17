const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
// 배포 파일(dist/index.html) 안의 코드를 그대로 꺼내서 검사
const html = fs.readFileSync(__dirname + '/../dist/index.html', 'utf8');
const coreSrc = /<script id="mm-core">([\s\S]*?)<\/script>/.exec(html)[1];
const sb = { window: {} }; vm.createContext(sb); vm.runInContext(coreSrc, sb);
const C = sb.window.MMCore;
const N = 1000;
const digits = n => String(n).length;

test('덧셈 단계별 범위', () => {
  let carry2 = 0;
  for (let i = 0; i < N; i++) {
    let p = C.genProblem('add', 1); assert.ok(p.a >= 1 && p.a <= 9 && p.b >= 1 && p.b <= 9); assert.strictEqual(p.answer, p.a + p.b);
    p = C.genProblem('add', 2); assert.ok(digits(p.a) === 2 && digits(p.b) === 2); assert.strictEqual(p.answer, p.a + p.b); if ((p.a % 10) + (p.b % 10) >= 10) carry2++;
    p = C.genProblem('add', 3); assert.ok(digits(p.a) >= 3 && digits(p.b) >= 3 && p.a <= 9999); assert.ok(C.hasCarry(p.a, p.b)); assert.strictEqual(p.answer, p.a + p.b);
  }
  assert.ok(carry2 > N * 0.5, '2단계 받아올림 문제가 충분히 나와야 함');
});

test('뺄셈 단계별 범위, 음수 없음, 3단계 0 포함', () => {
  let borrow2 = 0, zero3 = 0, borrow3 = 0;
  for (let i = 0; i < N; i++) {
    let p = C.genProblem('sub', 1); assert.ok(p.a <= 9 && p.b >= 1 && p.answer >= 0); assert.strictEqual(p.answer, p.a - p.b);
    p = C.genProblem('sub', 2); assert.ok(digits(p.a) === 2 && digits(p.b) === 2 && p.answer >= 0); if ((p.a % 10) < (p.b % 10)) borrow2++;
    p = C.genProblem('sub', 3); assert.ok(p.a <= 9999 && p.a >= 100 && p.answer >= 0); assert.strictEqual(p.answer, p.a - p.b);
    if (C.hasZero(p.a)) zero3++; if (C.hasBorrow(p.a, p.b)) borrow3++;
  }
  assert.ok(borrow2 > N * 0.5); assert.ok(zero3 > N * 0.4, '0이 있는 수: ' + zero3); assert.ok(borrow3 > N * 0.7);
});

test('곱셈 단계별 범위', () => {
  for (let i = 0; i < N; i++) {
    let p = C.genProblem('mul', 1); assert.ok(p.a >= 2 && p.a <= 9 && p.b >= 1 && p.b <= 9);
    p = C.genProblem('mul', 2); assert.ok(digits(p.a) === 2 && p.b >= 2 && p.b <= 9);
    p = C.genProblem('mul', 3); assert.ok(digits(p.a) === 3 && p.b >= 2 && p.b <= 9); assert.strictEqual(p.answer, p.a * p.b);
  }
});

test('나눗셈: 1·2단계 나누어떨어짐, 3단계 나머지', () => {
  for (let i = 0; i < N; i++) {
    let p = C.genProblem('div', 1); assert.ok(p.a <= 99 && p.a % p.b === 0 && p.answer === p.a / p.b && !p.twoPart);
    p = C.genProblem('div', 2); assert.ok(p.a <= 999 && p.a % p.b === 0 && p.answer === p.a / p.b);
    p = C.genProblem('div', 3); assert.ok(p.a <= 999 && p.twoPart && p.rem >= 1 && p.rem < p.b);
    assert.strictEqual(p.answer * p.b + p.rem, p.a);
    assert.ok(C.checkAnswer(p, String(p.answer), String(p.rem)));
    assert.ok(!C.checkAnswer(p, String(p.answer), String(p.rem + 1)));
  }
});

test('문장제 문제 정답 검증', () => {
  for (const op of C.OPS) for (let lv = 1; lv <= 3; lv++) for (let i = 0; i < 200; i++) {
    const p = C.genWordProblem(op, lv);
    assert.ok(p.word && p.text.includes(String(p.a)) && p.text.includes(String(p.b)) && p.pic);
    const r = C.evalExpr(p.expr); assert.ok(r.ok);
    assert.strictEqual(Math.floor(r.value), p.answer);
  }
});

test('혼합 계산: 괄호, 정수, 나누어떨어짐', () => {
  for (let i = 0; i < N; i++) {
    const p = C.genMixed();
    assert.ok(p.text.includes('('));
    const r = C.evalExpr(p.text);
    assert.ok(r.ok && r.exact && Number.isInteger(r.value) && r.value >= 0);
    assert.strictEqual(r.value, p.answer);
  }
  assert.strictEqual(C.evalExpr('(23 + 48) × 2 − 15 ÷ 3').value, 137);
  assert.strictEqual(C.evalExpr('84 ÷ (3 + 4) + 12 × 5').value, 72);
});

test('진행 규칙', () => {
  const s = C.newState('지우', 'zzi');
  for (let i = 0; i < 2; i++) { C.recordWin(s, 'add', 1); assert.ok(!C.canChallengeGym(s, 'add')); }
  assert.strictEqual(s.fields.add.open, 1);
  const r = C.recordWin(s, 'add', 1);
  assert.ok(r.gymReady && C.canChallengeGym(s, 'add')); assert.strictEqual(r.unlocked, 2);
  assert.ok(!C.zoneOpen(s, 'add', 3));
  C.gymLose(s, 'add'); assert.strictEqual(s.fields.add.wins, 0); assert.ok(!C.canChallengeGym(s, 'add'));
  assert.strictEqual(s.fields.add.open, 2, '구역 개방은 유지');
  for (let i = 0; i < 3; i++) C.recordWin(s, "add", 2);
  assert.strictEqual(s.fields.add.open, 3);
  assert.ok(!C.canFinal(s));
  ['add', 'sub', 'mul'].forEach(op => C.gymWin(s, op, 1)); assert.ok(!C.canFinal(s));
  C.gymWin(s, 'div', 1); assert.ok(C.canFinal(s));
});

test('전투 수치', () => {
  assert.strictEqual(C.damageToEnemy(1), 10);
  assert.strictEqual(C.damageToEnemy(2), 15);
  for (const r of [0, 0.5, 0.999]) { const d = C.damageToAlly(false, () => r); assert.ok(d >= 5 && d <= 8, 'range'); const g = C.damageToAlly(true, () => r); assert.strictEqual(g, Math.ceil(d / 2)); }
  assert.strictEqual(C.damageToAlly(false, () => 0), 5); assert.strictEqual(C.damageToAlly(false, () => 0.999), 8);
  assert.strictEqual(C.maxHp({ hpBoost: 0 }), 25); assert.strictEqual(C.maxHp({ hpBoost: 2 }), 60);
  assert.strictEqual(C.bossAllySlots({ hpBoost: 0 }), 3);
});

test('저장 코드 왕복 & 잘못된 코드', () => {
  const s = C.newState('김하늘별', 'pul'); s.map = 'fmul'; s.x = 22; s.y = 28; s.cp = 120; s.hp = 22;
  C.recordWin(s, 'mul', 1); C.gymWin(s, 'add', 2);
  const set = { fixLevel: 2, timer: 1, hintAlways: 0, hpBoost: 1, sound: 1, reduceMotion: 0 };
  const code = C.encodeSave(s, set);
  const r = C.decodeSave(code);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.state)), JSON.parse(JSON.stringify(s)));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.settings)), set);
  assert.throws(() => C.decodeSave('hello'));
  assert.throws(() => C.decodeSave(code.slice(0, -1) + (code.endsWith('a') ? 'b' : 'a')));
  assert.throws(() => C.decodeSave(code.replace('.1.', '.2.')));
  assert.throws(() => C.decodeSave(''));
  assert.ok(C.decodeSave('  ' + code + '\n'));
});
