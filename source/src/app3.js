
  // =============== 전투 ===============
  var Battle = { active: false };
  var B = null;
  MM.battle = function () { return B; };
  var PRAISE = ['정답이에요!', '잘했어요!', '멋져요!', '정확해요!', '훌륭해요!'];

  function hpClass(el, ratio) { el.classList.toggle('mid', ratio <= 0.5 && ratio > 0.2); el.classList.toggle('low', ratio <= 0.2); }
  function renderHp(side) {
    var u = side === 'enemy' ? B.enemy : B.ally, p = side === 'enemy' ? 'e' : 'a';
    if (B.kind === 'wild') {
      var r = Math.max(0, u.hp / u.max); $(p + '-fill').style.width = (r * 100) + '%'; hpClass($(p + '-fill'), r);
      $(p + '-num').textContent = u.hp + ' / ' + u.max;
    } else {
      var sl = $(p + '-slots'); sl.innerHTML = '';
      for (var i = 0; i < u.max; i++) { var s = document.createElement('i'); if (i >= u.hp) s.className = 'off'; sl.appendChild(s); }
      $(p + '-num').textContent = u.hp + '칸 / ' + u.max + '칸';
    }
  }
  function setupBattleUI() {
    var boss = B.kind !== 'wild';
    $('battle').classList.toggle('boss', boss);
    ['e', 'a'].forEach(function (p) { $(p + '-bar').classList.toggle('hidden', boss); $(p + '-slots').classList.toggle('hidden', !boss); });
    $('e-name').textContent = B.enemy.name; $('e-lv').textContent = B.enemy.tag;
    $('a-name').textContent = MONS[S.mon].name; $('a-lv').textContent = S.name;
    var se = $('spr-e'), sa = $('spr-a');
    se.className = 'spr e'; sa.className = 'spr a';
    drawInto(se, B.enemy.raster); drawInto(sa, monsterRaster(MONS[S.mon]));
    $('act-guard').classList.toggle('hidden', boss); $('act-run').classList.toggle('hidden', boss);
    $('guard-ic').classList.remove('on'); $('act-guard').classList.remove('on');
    $('hint').classList.add('hidden');
    renderHp('enemy'); renderHp('ally');
    showMsgMode();
  }
  function showMsgMode() { $('qmsg').classList.remove('hidden'); $('qarea').classList.add('hidden'); }
  function showQMode() { $('qmsg').classList.add('hidden'); $('qarea').classList.remove('hidden'); }
  var msgWait = null;
  function bmsg(text, wait) {
    showMsgMode(); $('qmsg-t').textContent = text; $('qmsg-more').style.display = wait ? '' : 'none';
    log('msg:' + text);
    if (!wait) return delay(900);
    return new Promise(function (res) { msgWait = res; });
  }
  function msgTap() { if (msgWait) { var r = msgWait; msgWait = null; Sound.sfx('select'); r(); } }

  function startWild(op, zone) {
    var level = settings.fixLevel || zone;
    var sp = WILD[op][zone - 1];
    B = { kind: 'wild', op: op, zone: zone, level: level, combo: 0, wrong: 0, guard: false, slots: ['', ''], focus: 0, locked: true,
      enemy: { name: sp.name, tag: level + '단계', raster: monsterRaster(sp), hp: C.BAL.enemyHp, max: C.BAL.enemyHp },
      ally: { hp: S.hp, max: C.maxHp(settings) } };
    return runBattleIntro('앗! 야생의 ' + sp.name + josa(sp.name, '이', '가') + ' 나타났다!');
  }
  MM.startWild = startWild;
  function startBoss(kind, op, level) {
    var slots = C.bossAllySlots(settings);
    var gm = GYM_MON[op];
    var enemy = kind === 'gym'
      ? { name: gm.name, tag: '관장 몬스터', raster: monsterRaster(gm), hp: C.BAL.gymEnemy, max: C.BAL.gymEnemy }
      : { name: '매뜨킹', tag: '최종 보스', raster: monsterRaster(KING), hp: C.BAL.finalEnemy, max: C.BAL.finalEnemy };
    B = { kind: kind, op: op, level: level, combo: 0, wrong: 0, guard: false, slots: ['', ''], focus: 0, locked: true, enemy: enemy, ally: { hp: slots, max: slots } };
    var intro = kind === 'gym' ? LEADERS[op].name.split(' ').pop() + ' 관장이 ' + gm.name + josa(gm.name, '을', '를') + ' 내보냈다!' : '매뜨킹이 나타났다! 최후의 승부!';
    return runBattleIntro(intro);
  }
  MM.startBoss = startBoss;
  async function runBattleIntro(text) {
    Battle.active = true; input.dir = null;
    setupBattleUI(); showScene('battle'); Sound.music(B.kind === 'wild' ? 'battle' : 'boss'); Sound.sfx('encounter');
    log('battle:start:' + B.kind);
    await bmsg(text, true);
    await bmsg('가자, ' + MONS[S.mon].name + '!', false);
    newQuestion();
  }
  function newQuestion() {
    if (B.kind === 'wild') B.problem = C.genProblem(B.op, B.level, MM.rng);
    else if (B.kind === 'gym') B.problem = C.genWordProblem(B.op, B.level, MM.rng);
    else B.problem = C.genMixed(MM.rng);
    if (MM.forceProblem) { B.problem = MM.forceProblem; MM.forceProblem = null; }
    $('hint').classList.add('hidden');
    log('question:' + B.problem.text + '=' + B.problem.answer);
    showQuestion();
  }
  function showQuestion() {
    var p = B.problem; B.slots = ['', '']; B.focus = 0;
    $('qpic').textContent = p.word ? p.pic : '';
    var qt = $('qtext'); qt.className = 'qtext' + (p.word ? ' word' : p.mixed ? ' mix' : '');
    qt.textContent = p.word ? p.text : p.text + ' = ?';
    renderAnswer(); showQMode(); B.locked = false;
    if (settings.hintAlways || B.wrong > 0) openHint();
    startTimer();
  }
  function renderAnswer() {
    var p = B.problem, a = $('ans'); a.innerHTML = '';
    function slot(i, label, unit) {
      if (label) { var l = document.createElement('span'); l.textContent = label; a.appendChild(l); }
      var s = document.createElement('div'); s.className = 'slot' + (B.focus === i ? ' focus' : ''); s.setAttribute('data-slot', i); s.textContent = B.slots[i] || ' ';
      s.addEventListener('click', function () { B.focus = i; renderAnswer(); }); a.appendChild(s);
      if (unit) { var u = document.createElement('span'); u.textContent = unit; a.appendChild(u); }
    }
    if (p.twoPart) {
      var lb = p.labels || ['몫', '나머지'], un = p.word ? p.units : ['', ''];
      slot(0, lb[0], un[0]); slot(1, lb[1], un[1]);
    } else slot(0, p.word ? '답' : '', p.word ? p.unit : '');
  }
  function keyIn(k) {
    if (!B || B.locked || !Battle.active) return;
    if (k === 'del') { B.slots[B.focus] = B.slots[B.focus].slice(0, -1); renderAnswer(); return; }
    if (k === 'ok') { submit(); return; }
    if (B.slots[B.focus].length >= 6) return;
    if (B.slots[B.focus] === '0') B.slots[B.focus] = '';
    B.slots[B.focus] += k; Sound.sfx('select'); renderAnswer();
  }
  MM.keyIn = keyIn;
  function shakeSlot(i) { var s = qa('.slot', $('ans'))[i]; if (s) { s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); } }
  async function submit() {
    if (B.locked) return;
    var p = B.problem;
    if (B.slots[0] === '') { B.focus = 0; renderAnswer(); shakeSlot(0); return; }
    if (p.twoPart && B.slots[1] === '') { B.focus = 1; renderAnswer(); shakeSlot(1); return; }
    B.locked = true; stopTimer();
    var ok = C.checkAnswer(p, B.slots[0], p.twoPart ? B.slots[1] : undefined);
    log('answer:' + (ok ? 'correct' : 'wrong'));
    if (ok) await onCorrect(); else await onWrong(false);
  }
  async function onCorrect() {
    B.combo++; B.wrong = 0; Sound.sfx('correct');
    var praise = PRAISE[Math.floor(MM.rng() * PRAISE.length)];
    var dmg = B.kind === 'wild' ? C.damageToEnemy(B.combo) : 1;
    await bmsg(praise + ' ' + MONS[S.mon].name + '의 공격!' + (B.kind === 'wild' && B.combo >= 2 ? ' (연속 정답 보너스!)' : ''), false);
    await animate('a'); log('anim:ally-attack');
    B.enemy.hp = Math.max(0, B.enemy.hp - dmg); renderHp('enemy'); log('hp:enemy:' + B.enemy.hp);
    await delay(600);
    B.guard = false; $('guard-ic').classList.remove('on'); $('act-guard').classList.remove('on');
    if (B.enemy.hp <= 0) return winBattle();
    newQuestion();
  }
  async function onWrong(timeout) {
    B.combo = 0; B.wrong++; Sound.sfx('wrong');
    var p = B.problem, dmg = B.kind === 'wild' ? C.damageToAlly(B.guard, MM.rng) : 1;
    var ans = p.twoPart ? '몫 ' + p.answer + ', 나머지 ' + p.rem : p.answer + (p.word && p.unit ? p.unit : '');
    // 틀리면 정답을 알려 주고, 같은 문제가 아니라 새 문제로 넘어간다
    await bmsg((timeout ? '시간이 다 됐어요! ' : '아쉬워요! ') + '정답은 ' + ans + '이에요.', true);
    await bmsg(B.enemy.name + '의 공격!' + (B.guard ? ' (방어해서 피해가 절반!)' : ''), false);
    await animate('e'); log('anim:enemy-attack');
    B.ally.hp = Math.max(0, B.ally.hp - dmg); if (B.kind === 'wild') { S.hp = B.ally.hp; } renderHp('ally'); log('hp:ally:' + B.ally.hp);
    await delay(600);
    B.guard = false; $('guard-ic').classList.remove('on'); $('act-guard').classList.remove('on');
    if (B.ally.hp <= 0) return loseBattle();
    newQuestion();
  }
  async function animate(who) {
    var atk = who === 'a' ? $('spr-a') : $('spr-e'), def = who === 'a' ? $('spr-e') : $('spr-a');
    atk.classList.remove('lunge-a', 'lunge-e'); void atk.offsetWidth; atk.classList.add(who === 'a' ? 'lunge-a' : 'lunge-e');
    await delay(260);
    Sound.sfx(who === 'a' ? 'hit' : 'hurt');
    def.classList.remove('hit'); void def.offsetWidth; def.classList.add('hit');
    await delay(450);
    atk.classList.remove('lunge-a', 'lunge-e'); def.classList.remove('hit');
  }
  async function winBattle() {
    $('spr-e').classList.add('faint'); Sound.sfx('win'); await delay(700);
    var b = B;
    if (b.kind === 'wild') {
      S.cp += 10;
      var r = C.recordWin(S, b.op, b.zone);
      log('win:wild');
      await bmsg(b.enemy.name + josa(b.enemy.name, '을', '를') + ' 이겼다! 용기 포인트 +10', true);
      var f = S.fields[b.op];
      await bmsg('이 필드에서 이긴 몬스터: ' + Math.min(f.wins, 3) + '/3', true);
      if (r.unlocked) { invalidate(); await bmsg('🎉 ' + r.unlocked + '단계 구역 문이 열렸어요!', true); }
      if (r.gymReady) await bmsg('🏅 체육관 관장에게 도전할 수 있어요!', true);
      endBattle();
    } else if (b.kind === 'gym') {
      var first = !S.fields[b.op].badge;
      C.gymWin(S, b.op, b.level); Sound.sfx('badge'); log('win:gym:' + b.op);
      await bmsg(LEADERS[b.op].name + ': 대단해! ' + GYM_MON[b.op].name + '를 쓰러뜨렸구나!', true);
      await bmsg(first ? '🏅 ' + C.OP_NAME[b.op] + ' 뱃지를 받았다! (' + C.badgeCount(S) + '/4)' : '연습 시합에서도 이겼어요! 멋져요!', true);
      if (C.canFinal(S) && first) { invalidate(); await bmsg('뱃지 4개를 모두 모았어요! 마을의 챔피언 전당이 열렸어요!', true); }
      endBattle();
    } else {
      log('win:final');
      await bmsg('매뜨킹: 크윽... 네가 진정한 수학 챔피언이다!', true);
      Battle.active = false; B = null; stopTimer(); showEnding();
    }
  }
  async function loseBattle() {
    $('spr-a').classList.add('faint'); await delay(700);
    var b = B;
    if (b.kind === 'wild') {
      log('lose:wild');
      await bmsg(MONS[S.mon].name + josa(MONS[S.mon].name, '이', '가') + ' 지쳐 버렸어요...', true);
      await bmsg('매뜨센터로 가서 쉬어요. 이긴 몬스터 수는 그대로예요!', true);
      endBattle(); S.hp = C.maxHp(settings); goto('town', 5, 5, 'down'); toast('HP가 모두 회복되었어요! 💗');
    } else if (b.kind === 'gym') {
      C.gymLose(S, b.op); log('lose:gym');
      await bmsg(LEADERS[b.op].name + ': 아쉽다! 몬스터 3마리를 다시 이기고 와!', true);
      var fm = getMap('f' + b.op);
      endBattle(); goto(fm.id, fm.spawn.x, fm.spawn.y, 'up'); toast('필드 입구로 돌아왔어요. 몬스터 0/3');
    } else {
      log('lose:final');
      await bmsg('매뜨킹: 다시 연습하고 오너라!', true);
      endBattle(); goto('town', 18, 14, 'down');
    }
  }
  function endBattle() { Battle.active = false; B = null; stopTimer(); showScene(null); if (curMap) Sound.music(curMap.music); renderHUD(); log('battle:end'); }
  async function runAway() {
    if (!B || B.locked || B.kind !== 'wild') return;
    B.locked = true; stopTimer(); log('run');
    await bmsg('무사히 도망쳤다!', true); endBattle();
  }
  function toggleGuard() {
    if (!B || B.locked || B.kind !== 'wild') return;
    B.guard = !B.guard; $('guard-ic').classList.toggle('on', B.guard); $('act-guard').classList.toggle('on', B.guard);
    if (B.guard) toast('방어 자세! 이번에 틀려도 피해가 절반이에요.');
    log('guard:' + B.guard);
  }

  // 시간제한
  var timerH = null, timerLeft = 0;
  function startTimer() {
    stopTimer();
    if (!settings.timer) { $('timer').classList.add('hidden'); return; }
    $('timer').classList.remove('hidden'); timerLeft = 30; $('timer-fill').style.width = '100%';
    timerH = setInterval(function () {
      if (B && !B.locked && !Dlg.open) { timerLeft -= 0.25; $('timer-fill').style.width = Math.max(0, timerLeft / 30 * 100) + '%'; if (timerLeft <= 0) { stopTimer(); B.locked = true; log('timeout'); onWrong(true); } }
    }, 250);
  }
  function stopTimer() { if (timerH) clearInterval(timerH); timerH = null; }

  // 힌트
  function blocks(n, cls, opts) { var h = ''; for (var i = 0; i < n; i++) h += '<span class="blk ' + (cls || '') + ((opts && opts.cross && i >= n - opts.cross) ? ' x' : '') + ((opts && opts.group && (i + 1) % opts.group === 0 && i < n - 1) ? ' gap' : '') + '"></span>'; return h; }
  function vertical(a, b, sign) { var w = Math.max(String(a).length, String(b).length) + 2; function pad(s) { s = String(s); while (s.length < w) s = ' ' + s; return s; } var line = ''; for (var i = 0; i < w; i++) line += '─'; return '<pre class="vert">' + pad(a) + '\n' + sign + pad(b).slice(1) + '\n' + line + '\n' + pad('?') + '</pre>'; }
  function opHint(op, a, b, level) {
    var h = '';
    if (op === 'add') {
      if (a + b <= 20) h += '<div>파란 블록 ' + a + '개와 주황 블록 ' + b + '개를 모두 세어 봐요.</div><div class="blocks">' + blocks(a, '') + blocks(b, 'o') + '</div>';
      else h += vertical(a, b, '+') + '<div>일의 자리부터 더해요. 10이 넘으면 윗자리로 1을 올려요.</div>';
    } else if (op === 'sub') {
      if (a <= 20) h += '<div>블록 ' + a + '개 중에서 ✕ 표시한 ' + b + '개를 빼고 남은 블록을 세어 봐요.</div><div class="blocks">' + blocks(a, '', { cross: b }) + '</div>';
      else h += vertical(a, b, '−') + '<div>일의 자리부터 빼요. 뺄 수 없으면 윗자리에서 10을 빌려 와요.' + (C.hasZero(a) ? ' <b>0이 있는 자리는 빌려줄 수 없으니, 그 윗자리에서 먼저 빌려 와요!</b>' : '') + '</div>';
    } else if (op === 'mul') {
      if (a * b <= 81 && a <= 9) { var rows = ''; for (var r = 0; r < b; r++) rows += '<div class="row">' + blocks(a, r % 2 ? 'o' : '') + '</div>'; h += '<div>' + a + '개씩 ' + b + '줄이에요. 모두 몇 개일까요?</div><div class="blocks rows">' + rows + '</div>'; }
      else { var ds = String(a).split('').map(Number), parts = []; ds.forEach(function (d, i) { var place = Math.pow(10, ds.length - 1 - i); if (d) parts.push((d * place) + ' × ' + b + ' = ' + (d * place * b)); }); h += vertical(a, b, '×') + '<div>자리마다 나누어 곱한 다음 모두 더해요.</div><div>' + parts.join('<br>') + '</div>'; }
    } else if (op === 'div') {
      if (a <= 81 && level === 1) h += '<div>블록 ' + a + '개를 ' + b + '개씩 묶었어요. 몇 묶음일까요?</div><div class="blocks">' + blocks(a, '', { group: b }) + '</div>';
      else { var tens = []; for (var k = 10; k * b <= a + b * 10 && k <= 90; k += 10) tens.push(b + ' × ' + k + ' = ' + (b * k)); h += '<div>곱셈으로 생각해요: ' + b + ' × □ 가 ' + a + '에 가까운 수를 찾아요.</div><div>' + tens.join(', ') + '</div>'; }
      var tbl = []; for (var j = 1; j <= 9; j++) tbl.push(b + '×' + j + '=' + (b * j)); h += '<div style="margin-top:4px">' + b + '단: ' + tbl.join(' · ') + '</div>';
      if (level === 3) h += '<div><b>나머지는 ' + b + '보다 작아야 해요!</b></div>';
    }
    return h;
  }
  function buildHint(p) {
    if (p.mixed) {
      var m = /\(([^)]+)\)/.exec(p.text);
      return '<h4>💡 계산 순서</h4><div>① 괄호 ( ) 안을 먼저 계산해요' + (m ? ': <b>' + esc(m[1]) + '</b>' : '') + '</div><div>② 곱셈(×)과 나눗셈(÷)을 계산해요</div><div>③ 덧셈(+)과 뺄셈(−)을 앞에서부터 계산해요</div>';
    }
    var h = '<h4>💡 힌트</h4>';
    if (p.word) {
      var key = { add: '"모두", "더" → 더하기', sub: '"남은", "차이" → 빼기', mul: '"씩", "몇 개 있어요" → 곱하기', div: '"똑같이 나누어", "씩 묶으면" → 나누기' }[p.op];
      h += '<div>무엇을 구하나요? ' + key + '</div><div>식으로 바꾸면: <b>' + p.a + ' ' + C.SIGN[p.op] + ' ' + p.b + ' = □</b></div>';
    }
    return h + opHint(p.op, p.a, p.b, p.level);
  }
  function openHint() { if (!B || !B.problem) return; $('hint-body').innerHTML = buildHint(B.problem); $('hint').classList.remove('hidden'); log('hint:open'); }
  MM.hintHTML = function () { return $('hint-body').innerHTML; };
