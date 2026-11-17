(function (root) {
  'use strict';
  function makeRng(seed) {
    if (seed === undefined || seed === null) return Math.random;
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

  var OPS = ['add', 'sub', 'mul', 'div'];
  var SIGN = { add: '+', sub: '−', mul: '×', div: '÷' };
  var OP_NAME = { add: '덧셈', sub: '뺄셈', mul: '곱셈', div: '나눗셈' };

  function hasCarry(a, b) {
    while (a > 0 || b > 0) { if ((a % 10) + (b % 10) >= 10) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); }
    return false;
  }
  function hasBorrow(a, b) {
    while (b > 0) { if ((a % 10) < (b % 10)) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); }
    return false;
  }
  function hasZero(n) { return String(n).indexOf('0') >= 0; }

  function numsAdd(level, rng) {
    if (level === 1) return [ri(rng, 1, 9), ri(rng, 1, 9)];
    if (level === 2) {
      var want = rng() < 0.7;
      for (var i = 0; i < 500; i++) {
        var a = ri(rng, 10, 99), b = ri(rng, 10, 99);
        if (((a % 10) + (b % 10) >= 10) === want) return [a, b];
      }
      return [48, 37];
    }
    var d = rng() < 0.6 ? 3 : 4, lo = Math.pow(10, d - 1), hi = Math.pow(10, d) - 1;
    for (var j = 0; j < 500; j++) {
      var x = ri(rng, lo, hi), y = ri(rng, lo, hi);
      if (hasCarry(x, y)) return [x, y];
    }
    return [457, 368];
  }
  function numsSub(level, rng) {
    if (level === 1) { var a1 = ri(rng, 2, 9); return [a1, ri(rng, 1, a1)]; }
    if (level === 2) {
      var want = rng() < 0.7;
      for (var i = 0; i < 500; i++) {
        var a = ri(rng, 11, 99), b = ri(rng, 10, a - 1);
        if (((a % 10) < (b % 10)) === want) return [a, b];
      }
      return [52, 27];
    }
    var zeroMode = rng() < 0.6;
    for (var k = 0; k < 2000; k++) {
      var d = rng() < 0.5 ? 3 : 4;
      var A = ri(rng, Math.pow(10, d - 1), Math.pow(10, d) - 1);
      if (zeroMode) {
        var s = String(A).split('');
        var nz = ri(rng, 1, Math.min(2, d - 1));
        for (var z = 0; z < nz; z++) s[ri(rng, 1, d - 1)] = '0';
        A = parseInt(s.join(''), 10);
      }
      var bd = ri(rng, 2, d);
      var lo = Math.pow(10, bd - 1), hi = Math.min(A - 1, Math.pow(10, bd) - 1);
      if (hi < lo) continue;
      var B = ri(rng, lo, hi);
      if (!hasBorrow(A, B) && rng() < 0.8) continue;
      if (zeroMode && !hasZero(A)) continue;
      return [A, B];
    }
    return [1003, 457];
  }
  function numsMul(level, rng) {
    if (level === 1) return [ri(rng, 2, 9), ri(rng, 1, 9)];
    if (level === 2) return [ri(rng, 10, 99), ri(rng, 2, 9)];
    return [ri(rng, 100, 999), ri(rng, 2, 9)];
  }
  function numsDiv(level, rng) {
    var d = ri(rng, 2, 9), q, r = 0;
    if (level === 1) q = ri(rng, 1, 9);
    else if (level === 2) q = ri(rng, 10, 99);
    else { q = ri(rng, 2, 99); r = ri(rng, 1, d - 1); }
    return { n: q * d + r, d: d, q: q, r: r };
  }

  function genProblem(op, level, rng) {
    rng = rng || Math.random;
    level = Math.max(1, Math.min(3, level | 0));
    var a, b, ans, rem = 0, two = false;
    if (op === 'add') { var p = numsAdd(level, rng); a = p[0]; b = p[1]; ans = a + b; }
    else if (op === 'sub') { var p2 = numsSub(level, rng); a = p2[0]; b = p2[1]; ans = a - b; }
    else if (op === 'mul') { var p3 = numsMul(level, rng); a = p3[0]; b = p3[1]; ans = a * b; }
    else { var dv = numsDiv(level, rng); a = dv.n; b = dv.d; ans = dv.q; rem = dv.r; two = level === 3; }
    return { op: op, level: level, a: a, b: b, text: a + ' ' + SIGN[op] + ' ' + b, answer: ans, rem: rem, twoPart: two };
  }

  var WORD = {
    add: [
      { lv: [1, 2], pic: '🍎', unit: '개', t: '바구니에 사과가 {a}개 있어요. 사과 {b}개를 더 넣었어요. 사과는 모두 몇 개인가요?' },
      { lv: [1, 2], pic: '🐟', unit: '마리', t: '연못에 물고기 {a}마리가 있어요. 물고기 {b}마리가 더 왔어요. 물고기는 모두 몇 마리인가요?' },
      { lv: [1, 2], pic: '🎈', unit: '개', t: '빨간 풍선 {a}개와 파란 풍선 {b}개가 있어요. 풍선은 모두 몇 개인가요?' },
      { lv: [3], pic: '🪙', unit: '원', t: '저금통에 {a}원이 있어요. {b}원을 더 넣었어요. 저금통에는 모두 얼마가 있나요?' },
      { lv: [3], pic: '🏟️', unit: '명', t: '경기장에 어른 {a}명과 어린이 {b}명이 왔어요. 모두 몇 명이 왔나요?' }
    ],
    sub: [
      { lv: [1, 2], pic: '🎈', unit: '개', t: '풍선 {a}개 중 {b}개가 터졌어요. 남은 풍선은 몇 개인가요?' },
      { lv: [1, 2], pic: '🍪', unit: '개', t: '쿠키 {a}개가 있었어요. {b}개를 먹었어요. 남은 쿠키는 몇 개인가요?' },
      { lv: [1, 2], pic: '🐦', unit: '마리', t: '나무에 새 {a}마리가 있었어요. {b}마리가 날아갔어요. 남은 새는 몇 마리인가요?' },
      { lv: [3], pic: '💰', unit: '원', t: '{a}원이 있었어요. {b}원짜리 장난감을 샀어요. 남은 돈은 얼마인가요?' },
      { lv: [3], pic: '📚', unit: '권', t: '도서관에 책이 {a}권 있어요. {b}권을 빌려 갔어요. 남은 책은 몇 권인가요?' }
    ],
    mul: [
      { lv: [1, 2, 3], pic: '🧺', unit: '개', t: '사과 {a}개가 든 바구니가 {b}개 있어요. 사과는 모두 몇 개인가요?' },
      { lv: [1, 2, 3], pic: '🍬', unit: '개', t: '한 봉지에 사탕이 {a}개씩 들어 있어요. {b}봉지에는 사탕이 모두 몇 개인가요?' },
      { lv: [1, 2], pic: '✏️', unit: '자루', t: '상자 하나에 연필이 {a}자루씩 있어요. 상자 {b}개에는 연필이 모두 몇 자루인가요?' },
      { lv: [3], pic: '🎟️', unit: '원', t: '입장권 한 장은 {a}원이에요. {b}장을 사려면 모두 얼마가 필요한가요?' }
    ],
    div: [
      { lv: [1, 2], pic: '🍪', unit: '개', t: '쿠키 {a}개를 {b}명이 똑같이 나누어 먹어요. 한 명이 몇 개씩 먹나요?' },
      { lv: [1, 2], pic: '🍎', unit: '개', t: '사과 {a}개를 바구니 {b}개에 똑같이 나누어 담아요. 바구니 하나에 몇 개씩 담나요?' },
      { lv: [1, 2], pic: '🖍️', unit: '묶음', t: '색연필 {a}자루를 {b}자루씩 묶었어요. 모두 몇 묶음인가요?' },
      { lv: [3], pic: '🍬', unit: '개', labels: ['한 명에게', '남는 사탕'], t: '사탕 {a}개를 {b}명에게 똑같이 나누어 주려고 해요. 한 명에게 몇 개씩 주고, 몇 개가 남나요?' },
      { lv: [3], pic: '🥚', unit: '개', units: ['판', '개'], labels: ['달걀', '남는 달걀'], t: '달걀 {a}개를 한 판에 {b}개씩 담아요. 몇 판이 되고, 몇 개가 남나요?' }
    ]
  };

  function genWordProblem(op, level, rng) {
    rng = rng || Math.random;
    var p = genProblem(op, level, rng);
    var pool = WORD[op].filter(function (t) { return t.lv.indexOf(p.level) >= 0; });
    var tp = pick(rng, pool);
    p.word = true;
    p.pic = tp.pic;
    p.unit = tp.unit;
    p.units = tp.units || [tp.unit, tp.unit];
    p.labels = tp.labels || null;
    p.expr = p.text;
    p.text = tp.t.replace('{a}', p.a).replace('{b}', p.b);
    return p;
  }

  // ---------- 혼합 계산 ----------
  function tokenize(str) {
    var s = String(str).replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
    var out = [], i = 0;
    while (i < s.length) {
      var ch = s[i];
      if (ch === ' ') { i++; continue; }
      if (/[0-9]/.test(ch)) { var j = i; while (j < s.length && /[0-9]/.test(s[j])) j++; out.push(parseInt(s.slice(i, j), 10)); i = j; continue; }
      if ('+-*/()'.indexOf(ch) >= 0) { out.push(ch); i++; continue; }
      return null;
    }
    return out;
  }
  function evalExpr(str) {
    var toks = tokenize(str);
    if (!toks) return { ok: false };
    var prec = { '+': 1, '-': 1, '*': 2, '/': 2 }, outQ = [], st = [];
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (typeof t === 'number') outQ.push(t);
      else if (t === '(') st.push(t);
      else if (t === ')') {
        while (st.length && st[st.length - 1] !== '(') outQ.push(st.pop());
        if (!st.length) return { ok: false };
        st.pop();
      } else {
        while (st.length && st[st.length - 1] !== '(' && prec[st[st.length - 1]] >= prec[t]) outQ.push(st.pop());
        st.push(t);
      }
    }
    while (st.length) { var o = st.pop(); if (o === '(') return { ok: false }; outQ.push(o); }
    var vs = [], exact = true;
    for (var k = 0; k < outQ.length; k++) {
      var x = outQ[k];
      if (typeof x === 'number') { vs.push(x); continue; }
      if (vs.length < 2) return { ok: false };
      var b = vs.pop(), a = vs.pop();
      if (x === '+') vs.push(a + b);
      else if (x === '-') vs.push(a - b);
      else if (x === '*') vs.push(a * b);
      else { if (b === 0) return { ok: false }; if (a % b !== 0) exact = false; vs.push(a / b); }
    }
    if (vs.length !== 1) return { ok: false };
    return { ok: true, value: vs[0], exact: exact };
  }

  var MIX = [
    function (r) { var a = ri(r, 10, 49), b = ri(r, 10, 49), c = ri(r, 2, 5), e = ri(r, 2, 9), k = ri(r, Math.ceil(10 / e), Math.floor(99 / e)); return '(' + a + ' + ' + b + ') × ' + c + ' − ' + (e * k) + ' ÷ ' + e; },
    function (r) { var b = ri(r, 10, 30), c = ri(r, 10, 30), s = b + c, q = ri(r, 1, Math.floor(99 / s)), d = ri(r, 10, 30), e = ri(r, 2, 5); return (s * q) + ' ÷ (' + b + ' + ' + c + ') + ' + d + ' × ' + e; },
    function (r) { var a = ri(r, 30, 99), b = ri(r, 10, a - 10), c = ri(r, 2, 6), d = ri(r, 10, 99); return '(' + a + ' − ' + b + ') × ' + c + ' + ' + d; },
    function (r) { var d = ri(r, 10, 89), c = d + ri(r, 2, 9), a = ri(r, 10, 99), b = ri(r, 10, 30); return a + ' + ' + b + ' × (' + c + ' − ' + d + ')'; },
    function (r) { var c = ri(r, 2, 9), q = ri(r, 10, Math.floor(198 / c)), s = c * q; if (s < 20) return null; var a = ri(r, Math.max(10, s - 99), Math.min(99, s - 10)), b = s - a; if (b < 10 || b > 99) return null; var d = ri(r, 10, q); return '(' + a + ' + ' + b + ') ÷ ' + c + ' − ' + d; },
    function (r) { var a = ri(r, 10, 40), c = ri(r, 2, 5), b = ri(r, 10, 40), d = ri(r, 10, 40); return a + ' × ' + c + ' − (' + b + ' + ' + d + ')'; },
    function (r) { var a = ri(r, 40, 99), c = ri(r, 2, 9), qm = Math.floor((a - 10) / c); if (qm < 2) return null; var q = ri(r, 2, qm), b = a - c * q; if (b < 10) return null; var d = ri(r, 10, 30), e = ri(r, 2, 4); return '(' + a + ' − ' + b + ') ÷ ' + c + ' + ' + d + ' × ' + e; }
  ];
  function genMixed(rng) {
    rng = rng || Math.random;
    for (var i = 0; i < 3000; i++) {
      var e = pick(rng, MIX)(rng);
      if (!e) continue;
      var r = evalExpr(e);
      if (r.ok && r.exact && Number.isInteger(r.value) && r.value >= 0 && r.value <= 3000 && e.indexOf('(') >= 0) {
        return { op: 'mix', level: 3, mixed: true, text: e, answer: r.value, rem: 0, twoPart: false };
      }
    }
    return { op: 'mix', level: 3, mixed: true, text: '(23 + 48) × 2 − 15 ÷ 3', answer: 137, rem: 0, twoPart: false };
  }

  function checkAnswer(p, v1, v2) {
    if (v1 === null || v1 === undefined || v1 === '' || isNaN(Number(v1))) return false;
    if (Number(v1) !== p.answer) return false;
    if (p.twoPart) return v2 !== '' && v2 !== null && v2 !== undefined && Number(v2) === p.rem;
    return true;
  }

  // ---------- 전투 수치 ----------
  var BAL = { enemyHp: 30, allyHp: 30, hit: 10, comboBonus: 5, enemyHit: 5, enemyHitMin: 5, enemyHitMax: 8, gymEnemy: 3, finalEnemy: 5, need: 3 };
  function damageToEnemy(combo) { return BAL.hit + (combo >= 2 ? BAL.comboBonus : 0); }
  function damageToAlly(guard, rng) { var d = BAL.enemyHitMin + Math.floor((rng ? rng() : Math.random()) * (BAL.enemyHitMax - BAL.enemyHitMin + 1)); return guard ? Math.ceil(d / 2) : d; }
  function maxHp(settings) { return [25, 45, 60][(settings && settings.hpBoost) || 0]; }
  function bossAllySlots(settings) { return 3 + ((settings && settings.hpBoost) || 0); }

  // ---------- 진행 상태 ----------
  var MON_IDS = ['zzi', 'bul', 'pul', 'mul'];
  function newState(name, mon) {
    var s = { name: name, mon: mon, map: 'town', x: 11, y: 10, dir: 'down', hp: 25, cp: 0, fields: {}, champion: 0 };
    OPS.forEach(function (op) { s.fields[op] = { wins: 0, zk: [0, 0, 0], open: 1, badge: 0, best: 0 }; });
    return s;
  }
  function recordWin(state, op, zone) {
    var f = state.fields[op];
    f.wins = Math.min(f.wins + 1, 99);
    f.zk[zone - 1] = Math.min(f.zk[zone - 1] + 1, 999);
    var unlocked = 0;
    if (zone === 1 && f.open < 2 && f.zk[0] >= BAL.need) { f.open = 2; unlocked = 2; }
    if (zone === 2 && f.open < 3 && f.zk[1] >= BAL.need) { f.open = 3; unlocked = 3; }
    return { unlocked: unlocked, gymReady: f.wins === BAL.need };
  }
  function canChallengeGym(state, op) { return state.fields[op].wins >= BAL.need; }
  function gymLose(state, op) { state.fields[op].wins = 0; }
  function gymWin(state, op, level) { var f = state.fields[op]; f.badge = 1; f.best = Math.max(f.best, level); }
  function badgeCount(state) { return OPS.reduce(function (n, op) { return n + (state.fields[op].badge ? 1 : 0); }, 0); }
  function canFinal(state) { return badgeCount(state) === 4; }
  function zoneOpen(state, op, zone) { return state.fields[op].open >= zone; }

  // ---------- 저장 코드 ----------
  var DIRS = ['down', 'up', 'left', 'right'];
  var SKEYS = ['fixLevel', 'timer', 'hintAlways', 'hpBoost', 'sound', 'reduceMotion'];
  function checksum(str) {
    var h = 7;
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i) * (i + 1)) % 46656;
    var s = h.toString(36);
    while (s.length < 3) s = '0' + s;
    return s;
  }
  function encodeSave(state, settings) {
    var name = Array.from(state.name).map(function (ch) { return ch.codePointAt(0).toString(36); }).join('_');
    var nums = [MON_IDS.indexOf(state.mon), state.x, state.y, DIRS.indexOf(state.dir), state.hp, state.cp, state.champion ? 1 : 0];
    OPS.forEach(function (op) { var f = state.fields[op]; nums.push(f.wins, f.zk[0], f.zk[1], f.zk[2], f.open, f.badge, f.best); });
    SKEYS.forEach(function (k) { nums.push(settings[k] ? Number(settings[k]) : 0); });
    var body = [name, state.map].concat(nums.map(function (n) { return Math.max(0, n | 0).toString(36); })).join('.');
    return 'MM1.' + body + '.' + checksum(body);
  }
  function decodeSave(code, validMap) {
    function fail() { throw new Error('올바른 저장 코드가 아닙니다'); }
    if (typeof code !== 'string') fail();
    code = code.replace(/\s+/g, '');
    var parts = code.split('.');
    var expectLen = 1 + 2 + 7 + 28 + 6 + 1;
    if (parts.length !== expectLen || parts[0] !== 'MM1') fail();
    var cs = parts[parts.length - 1], body = parts.slice(1, -1).join('.');
    if (checksum(body) !== cs) fail();
    var name;
    try {
      name = parts[1].split('_').map(function (c) { if (!/^[0-9a-z]+$/.test(c)) fail(); return String.fromCodePoint(parseInt(c, 36)); }).join('');
    } catch (e) { fail(); }
    if (!name || Array.from(name).length > 5) fail();
    var map = parts[2];
    if (!/^[a-z0-9]+$/.test(map)) fail();
    if (validMap && !validMap(map)) fail();
    var n = parts.slice(3, -1).map(function (x) { if (!/^[0-9a-z]+$/.test(x)) fail(); return parseInt(x, 36); });
    var st = newState(name, MON_IDS[n[0]]);
    if (!st.mon) fail();
    st.map = map; st.x = n[1]; st.y = n[2]; st.dir = DIRS[n[3]] || 'down'; st.hp = n[4]; st.cp = n[5]; st.champion = n[6] ? 1 : 0;
    if (st.x > 60 || st.y > 60 || st.hp > 60) fail();
    var i = 7;
    OPS.forEach(function (op) {
      var f = st.fields[op];
      f.wins = n[i++]; f.zk = [n[i++], n[i++], n[i++]]; f.open = n[i++]; f.badge = n[i++] ? 1 : 0; f.best = n[i++];
      if (f.open < 1 || f.open > 3 || f.best > 3 || f.wins > 99) fail();
    });
    var settings = {};
    SKEYS.forEach(function (k) { settings[k] = n[i++]; });
    if (settings.fixLevel > 3 || settings.hpBoost > 2) fail();
    return { state: st, settings: settings };
  }

  var Core = {
    makeRng: makeRng, OPS: OPS, SIGN: SIGN, OP_NAME: OP_NAME, MON_IDS: MON_IDS,
    hasCarry: hasCarry, hasBorrow: hasBorrow, hasZero: hasZero,
    genProblem: genProblem, genWordProblem: genWordProblem, genMixed: genMixed, evalExpr: evalExpr, checkAnswer: checkAnswer,
    BAL: BAL, damageToEnemy: damageToEnemy, damageToAlly: damageToAlly, maxHp: maxHp, bossAllySlots: bossAllySlots,
    newState: newState, recordWin: recordWin, canChallengeGym: canChallengeGym, gymLose: gymLose, gymWin: gymWin,
    badgeCount: badgeCount, canFinal: canFinal, zoneOpen: zoneOpen, encodeSave: encodeSave, decodeSave: decodeSave
  };
  root.MMCore = Core;
  if (typeof module !== 'undefined' && module.exports) module.exports = Core;
})(typeof window !== 'undefined' ? window : this);
