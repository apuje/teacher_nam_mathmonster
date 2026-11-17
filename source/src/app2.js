fx('select'); });
        seg.appendChild(b);
      });
      row.appendChild(seg); box.appendChild(row);
    });
    showScene('teacher');
  }
  function applySettings() {
    $('stage').classList.toggle('reduce', !!settings.reduceMotion);
    if (!settings.sound) Sound.stopLoop(); else if (Sound.want) { Sound.unlock(); Sound.music(Sound.want); }
    $('m-sound').textContent = settings.sound ? '🔊 소리 끄기' : '🔇 소리 켜기';
    $('m-motion').textContent = '움직임 줄이기: ' + (settings.reduceMotion ? '켬' : '끔');
    if (S) { var mx = C.maxHp(settings); if (S.hp > mx) S.hp = mx; renderHUD(); }
  }
  MM.settings = settings;
  MM.applySettings = applySettings;

  function confirmBox(title, text) {
    return new Promise(function (res) {
      $('cf-title').textContent = title; $('cf-text').textContent = text; showModal('confirm', true);
      function done(v) { showModal('confirm', false); $('cf-yes').onclick = null; $('cf-no').onclick = null; res(v); }
      $('cf-yes').onclick = function () { done(true); }; $('cf-no').onclick = function () { done(false); };
    });
  }

  // 저장 코드
  function makeSaveCode() { return C.encodeSave(S, settings); }
  function openSave() {
    var code = makeSaveCode(); $('save-code').value = code; $('save-msg').textContent = '';
    showModal('menu', false); showModal('savebox', true); log('save:' + code);
  }
  function copySave() {
    var ta = $('save-code'), code = ta.value, msg = $('save-msg');
    function ok() { msg.style.color = '#2b8a3e'; msg.textContent = '복사했어요! 메모장이나 클래스룸에 붙여 넣어 보관하세요.'; }
    function manual() { ta.focus(); ta.select(); msg.style.color = '#e8590c'; msg.textContent = '코드를 길게 눌러 직접 복사해 주세요.'; }
    function legacy() { try { ta.removeAttribute('readonly'); ta.focus(); ta.select(); ta.setSelectionRange(0, code.length); var r = document.execCommand && document.execCommand('copy'); ta.setAttribute('readonly', ''); if (r) ok(); else manual(); } catch (e) { manual(); } }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(ok, legacy);
      else legacy();
    } catch (e) { legacy(); }
  }
  function loadCode(code) {
    try {
      var r = C.decodeSave(code, function (id) { return !!getMap(id); });
      var m = getMap(r.state.map);
      if (r.state.x >= m.w || r.state.y >= m.h || SOLID.indexOf(tileAt(m, r.state.x, r.state.y)) >= 0) throw new Error('bad pos');
      Object.keys(r.settings).forEach(function (k) { settings[k] = r.settings[k]; });
      S = r.state; applySettings();
      showScene(null); goto(S.map, S.x, S.y, S.dir); toast(S.name + '의 모험을 이어서 해요!'); log('load:ok');
      return true;
    } catch (e) { log('load:fail'); return false; }
  }
  MM.loadCode = loadCode;
  MM.makeSaveCode = function () { return S ? makeSaveCode() : null; };

  // 엔딩
  function showEnding() {
    S.champion = 1;
    var eb = $('end-badges'); eb.innerHTML = '';
    C.OPS.forEach(function (op) { var d = document.createElement('div'); d.className = 'badge on'; d.style.background = BADGE_COLOR[op]; d.textContent = C.SIGN[op]; eb.appendChild(d); });
    drawInto($('end-mon'), monsterRaster(MONS[S.mon]));
    $('end-sub').textContent = S.name + josa(S.name, '과', '와') + ' ' + MONS[S.mon].name + ', 챔피언이 되었어요!';
    $('end-msg').textContent = '덧셈, 뺄셈, 곱셈, 나눗셈, 혼합 계산까지 모두 해냈어요. 정말 멋져요!';
    showScene('ending'); Sound.music('ending'); Sound.sfx('badge'); log('ending');
  }
