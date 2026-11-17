
  // =============== 입력 연결 ===============
  function on(id, ev, fn) { $(id).addEventListener(ev, fn); }
  function unlockAudio() { Sound.unlock(); }
  document.addEventListener('pointerdown', unlockAudio, true);
  document.addEventListener('keydown', unlockAudio, true);

  on('btn-new', 'click', function () { Sound.sfx('select'); $('name-input').value = '지우'; $('name-err').textContent = ''; showScene('name'); });
  on('btn-resume', 'click', function () { Sound.sfx('select'); resumeGame(); });
  on('btn-load', 'click', function () { Sound.sfx('select'); $('load-input').value = ''; $('load-err').textContent = ''; showScene('load'); });
  on('btn-teacher', 'click', function () { Sound.sfx('select'); renderTeacher(); });
  on('name-back', 'click', function () { renderTitle(); });
  on('name-ok', 'click', function () {
    var v = Array.from($('name-input').value.trim()).slice(0, 5).join('');
    if (!v) { $('name-err').textContent = '이름을 1글자 이상 써 주세요.'; return; }
    if (/[.<>]/.test(v)) { $('name-err').textContent = '글자와 숫자만 쓸 수 있어요.'; return; }
    MM.pendingName = v; Sound.sfx('select'); renderPick();
  });
  on('name-input', 'keydown', function (e) { if (e.key === 'Enter' && !e.isComposing) $('name-ok').click(); });
  on('pick-back', 'click', function () { showScene('name'); });
  on('pick-ok', 'click', async function () {
    if (!pickSel) return;
    var mon = pickSel;
    showScene(null); $('hud').classList.add('hidden'); $('pad').classList.add('hidden');
    S = S || null;
    startGame(MM.pendingName || '지우', mon);
  });
  on('load-back', 'click', function () { renderTitle(); });
  on('load-ok', 'click', function () { if (!loadCode($('load-input').value)) $('load-err').textContent = '올바른 저장 코드가 아닙니다. 다시 확인해 주세요.'; });
  on('set-back', 'click', function () { Sound.sfx('select'); renderTitle(); });
  on('set-reset', 'click', async function () {
    var yes = await confirmBox('진행 초기화', '지금 하던 게임 진행(이름, 뱃지, 몬스터 기록)을 모두 지울까요? 저장 코드는 지워지지 않아요.');
    if (yes) { S = null; curMap = null; MAPS = {}; spriteCache = {}; toast('진행을 초기화했어요.'); log('reset'); renderTitle(); renderTeacher(); }
  });
  on('sound-btn', 'click', function () { settings.sound = settings.sound ? 0 : 1; applySettings(); });
  on('menubtn', 'click', function () { if (busy()) return; Sound.sfx('select'); showModal('menu', true); });
  on('m-close', 'click', function () { showModal('menu', false); });
  on('m-save', 'click', function () { openSave(); });
  on('m-sound', 'click', function () { settings.sound = settings.sound ? 0 : 1; applySettings(); });
  on('m-motion', 'click', function () { settings.reduceMotion = settings.reduceMotion ? 0 : 1; applySettings(); });
  on('m-title', 'click', function () { showModal('menu', false); renderTitle(); });
  on('save-copy', 'click', copySave);
  on('save-close', 'click', function () { showModal('savebox', false); });
  on('end-ok', 'click', function () { renderTitle(); });
  on('dialog', 'click', function () { advanceDlg(); });
  on('qmsg', 'click', msgTap);
  on('hint-x', 'click', function () { $('hint').classList.add('hidden'); });
  on('act-hint', 'click', function () { if ($('hint').classList.contains('hidden')) openHint(); else $('hint').classList.add('hidden'); });
  on('act-guard', 'click', toggleGuard);
  on('act-run', 'click', runAway);
  on('rotate-ok', 'click', function () { rotateDismissed = true; fit(); });

  // 키패드
  (function () {
    var kp = $('keypad');
    ['7', '8', '9', '4', '5', '6', '1', '2', '3', 'del', '0', 'ok'].forEach(function (k) {
      var b = document.createElement('button'); b.className = 'btn' + (k === 'ok' ? ' ok' : k === 'del' ? ' del' : ''); b.setAttribute('data-k', k);
      b.textContent = k === 'ok' ? '확인' : k === 'del' ? '지우기' : k;
      b.addEventListener('click', function () { keyIn(k); });
      kp.appendChild(b);
    });
  })();

  // 방향 버튼 (누르고 있으면 계속 이동)
  qa('#dpad button').forEach(function (b) {
    var d = b.getAttribute('data-dir');
    function down(e) { e.preventDefault(); input.dir = d; b.classList.add('on'); if (!P.moving) tryMove(d); }
    function up() { if (input.dir === d) input.dir = null; b.classList.remove('on'); }
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    b.addEventListener('click', function () { if (!P.moving && !input.dir) tryMove(d); });
  });
  on('abtn', 'pointerdown', function (e) { e.preventDefault(); aPress(); });
  function aPress() { if (Dlg.open) { advanceDlg(); return; } interact(); }

  var KEYDIR = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  document.addEventListener('keydown', function (e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (Battle.active) {
      if (msgWait && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); msgTap(); return; }
      if (/^[0-9]$/.test(e.key)) keyIn(e.key);
      else if (e.key === 'Backspace') { e.preventDefault(); keyIn('del'); }
      else if (e.key === 'Enter') keyIn('ok');
      else if (e.key === 'Tab' && B && B.problem && B.problem.twoPart) { e.preventDefault(); B.focus = 1 - B.focus; renderAnswer(); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') { e.preventDefault(); aPress(); return; }
    var d = KEYDIR[e.key]; if (d) { e.preventDefault(); input.dir = d; }
  });
  document.addEventListener('keyup', function (e) { var d = KEYDIR[e.key]; if (d && input.dir === d) input.dir = null; });
  window.addEventListener('blur', function () { input.dir = null; });

  // =============== 화면 맞추기 ===============
  var rotateDismissed = false;
  function fit() {
    var w = window.innerWidth || 960, h = window.innerHeight || 600;
    var s = Math.min(w / VW, h / VH);
    $('stage').style.setProperty('--s', s);
    $('rotate').classList.toggle('show', h > w * 1.05 && !rotateDismissed);
  }
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', function () { setTimeout(fit, 200); });
  document.addEventListener('gesturestart', function (e) { e.preventDefault(); });
  document.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // =============== 테스트용 도우미 ===============
  MM.state = function () { return S; };
  MM.map = function () { return curMap; };
  MM.dlgOpen = function () { return Dlg.open; };
  MM.advance = advanceDlg;
  MM.interact = interact;
  MM.tryMove = tryMove;
  MM.face = function (d) { S.dir = d; };
  MM.msgTap = msgTap;
  MM.waitingMsg = function () { return !!msgWait; };
  MM.battleActive = function () { return Battle.active; };
  MM.qLocked = function () { return !B || B.locked; };

  // 시작
  fit(); applySettings(); renderTitle();
  if (window.requestAnimationFrame) requestAnimationFrame(frame);
})();
