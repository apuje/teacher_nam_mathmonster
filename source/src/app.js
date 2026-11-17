(function () {
  'use strict';
  var C = window.MMCore;
  var MM = window.MM = { Core: C, speed: 1, events: [], encounterRate: 0.18, rng: Math.random };
  var settings = { fixLevel: 0, timer: 0, hintAlways: 0, hpBoost: 0, sound: 1, reduceMotion: 0 };
  var S = null; // 게임 진행 상태
  var TILE = 40, VW = 960, VH = 600;

  function log(e) { MM.events.push(e); if (MM.events.length > 800) MM.events.shift(); }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, Math.round(ms * MM.speed * (settings.reduceMotion ? 0.6 : 1))); }); }
  function $(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function josa(word, a, b) {
    var ch = String(word).charCodeAt(String(word).length - 1);
    if (ch < 0xAC00 || ch > 0xD7A3) return b;
    return ((ch - 0xAC00) % 28) ? a : b;
  }
  function ctx2d(c) { try { return c && c.getContext ? c.getContext('2d') : null; } catch (e) { return null; } }

  // =============== 소리 (Web Audio로 직접 생성) ===============
  var NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(n) {
    var m = /^([A-G])(#|b)?(\d)$/.exec(n); if (!m) return 0;
    var semi = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (parseInt(m[3], 10) + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  }
  function parseSeq(s) { return s.replace(/\|/g, ' ').trim().split(/\s+/).map(function (t) { var p = t.split(':'); return { n: p[0], d: parseFloat(p[1] || '1') }; }); }
  var TRACKS = {
    town: { bpm: 120, lead: 'E5:1 G5:1 C6:2 B5:1 A5:1 G5:2 | A5:1 G5:1 F5:1 E5:1 D5:2 G4:2 | E5:1 G5:1 C6:2 D6:1 C6:1 B5:2 | A5:1 B5:1 C6:1 G5:1 C5:4', bass: 'C3:2 G3:2 C3:2 G3:2 | F3:2 C4:2 G3:2 B2:2 | C3:2 G3:2 E3:2 G3:2 | F3:2 G3:2 C3:4' },
    field: { bpm: 140, lead: 'G4:1 B4:1 D5:1 G5:1 F#5:2 D5:2 | E5:1 D5:1 C5:1 B4:1 A4:4 | B4:1 D5:1 G5:1 B5:1 A5:2 F#5:2 | G5:1 F#5:1 E5:1 F#5:1 G5:4', bass: 'G2:2 D3:2 G2:2 D3:2 | C3:2 G3:2 D3:2 A2:2 | G2:2 D3:2 G2:2 D3:2 | C3:2 D3:2 G2:4' },
    battle: { bpm: 168, lead: 'A4:1 C5:1 E5:1 A5:1 G5:1 E5:1 C5:1 E5:1 | F5:1 E5:1 D5:1 C5:1 B4:2 E5:2 | A4:1 C5:1 E5:1 A5:1 B5:1 A5:1 G5:1 E5:1 | F5:2 E5:2 D5:2 E5:2', bass: 'A2:1 A3:1 A2:1 A3:1 A2:1 A3:1 A2:1 A3:1 | F2:1 F3:1 F2:1 F3:1 E2:1 E3:1 E2:1 E3:1 | A2:1 A3:1 A2:1 A3:1 A2:1 A3:1 A2:1 A3:1 | D2:1 D3:1 D2:1 D3:1 E2:1 E3:1 E2:1 E3:1' },
    boss: { bpm: 176, lead: 'D5:1 D5:1 F5:1 D5:1 A5:2 G5:1 F5:1 | E5:1 F5:1 G5:1 E5:1 C#5:4 | D5:1 F5:1 A5:1 D6:1 C6:2 A5:2 | Bb5:1 A5:1 G5:1 E5:1 D5:4', bass: 'D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 | A1:1 A2:1 A1:1 A2:1 A1:1 A2:1 A1:1 A2:1 | D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 D2:1 D3:1 | Bb1:1 Bb2:1 Bb1:1 Bb2:1 A1:1 A2:1 A1:1 A2:1' },
    ending: { bpm: 110, lead: 'G4:1 C5:1 E5:1 G5:3 E5:2 | F5:1 A5:1 G5:1 E5:1 C5:4 | D5:1 E5:1 F5:2 A5:2 G5:2 | E5:1 D5:1 B4:1 D5:1 C5:4', bass: 'C3:4 E3:4 | F3:4 C3:4 | D3:4 G3:4 | G2:4 C3:4' }
  };
  Object.keys(TRACKS).forEach(function (k) { TRACKS[k].L = parseSeq(TRACKS[k].lead); TRACKS[k].B = parseSeq(TRACKS[k].bass); });

  var Sound = {
    ctx: null, master: null, want: null, cur: null, timer: null, li: 0, bi: 0, lt: 0, bt: 0,
    init: function () {
      if (this.ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.18; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; return false; }
      return true;
    },
    unlock: function () {
      if (!this.init()) return;
      if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { } }
      if (this.want && this.cur !== this.want) this.music(this.want);
    },
    tone: function (f, t, d, type, vol) {
      if (!this.ctx || !f) return;
      var o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol || 0.5, t + 0.01);
      g.gain.setValueAtTime(vol || 0.5, t + d * 0.7); g.gain.linearRampToValueAtTime(0.0001, t + d * 0.98);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + d);
    },
    music: function (name) {
      this.want = name;
      if (!settings.sound || !this.ctx || this.ctx.state !== 'running') { this.stopLoop(); return; }
      if (this.cur === name) return;
      this.stopLoop(); this.cur = name;
      var tr = TRACKS[name]; if (!tr) return;
      var self = this, eighth = 60 / tr.bpm / 2;
      this.li = 0; this.bi = 0; this.lt = this.bt = this.ctx.currentTime + 0.08;
      this.timer = setInterval(function () {
        var until = self.ctx.currentTime + 0.35;
        while (self.lt < until) { var n = tr.L[self.li]; if (n.n !== '-') self.tone(freq(n.n), self.lt, n.d * eighth, 'square', 0.32); self.lt += n.d * eighth; self.li = (self.li + 1) % tr.L.length; }
        while (self.bt < until) { var b = tr.B[self.bi]; if (b.n !== '-') self.tone(freq(b.n), self.bt, b.d * eighth, 'triangle', 0.6); self.bt += b.d * eighth; self.bi = (self.bi + 1) % tr.B.length; }
      }, 90);
    },
    stopLoop: function () { if (this.timer) clearInterval(this.timer); this.timer = null; this.cur = null; },
    sfx: function (name) {
      if (!settings.sound || !this.ctx || this.ctx.state !== 'running') return;
      var t = this.ctx.currentTime + 0.01, s = this;
      var seqs = {
        select: [['C6', 0.05]], correct: [['C6', 0.08], ['E6', 0.08], ['G6', 0.16]], wrong: [['E3', 0.14], ['C3', 0.22]],
        hit: [['G5', 0.04], ['D5', 0.04], ['A4', 0.04], ['E4', 0.08]], hurt: [['C4', 0.06], ['G3', 0.06], ['C3', 0.12]],
        encounter: [['C5', 0.05], ['E5', 0.05], ['G5', 0.05], ['C6', 0.05], ['E6', 0.05], ['G6', 0.1]],
        heal: [['C5', 0.08], ['E5', 0.08], ['G5', 0.08], ['C6', 0.2]], badge: [['G5', 0.1], ['G5', 0.1], ['G5', 0.1], ['C6', 0.4]],
        win: [['E5', 0.08], ['G5', 0.08], ['C6', 0.08], ['E6', 0.3]], bump: [['A2', 0.08]], door: [['G4', 0.05], ['C5', 0.08]]
      }[name] || [];
      seqs.forEach(function (p) { s.tone(freq(p[0]), t, p[1] + 0.02, name === 'bump' ? 'triangle' : 'square', 0.4); t += p[1]; });
    }
  };
  MM.Sound = Sound;

  // =============== 도트 그림 ===============
  function Raster(n) { this.n = n; this.px = new Array(n * n); for (var i = 0; i < n * n; i++) this.px[i] = null; }
  Raster.prototype.set = function (x, y, c) { x = Math.floor(x); y = Math.floor(y); if (x >= 0 && y >= 0 && x < this.n && y < this.n) this.px[y * this.n + x] = c; };
  Raster.prototype.get = function (x, y) { return (x >= 0 && y >= 0 && x < this.n && y < this.n) ? this.px[y * this.n + x] : null; };
  Raster.prototype.ell = function (cx, cy, rx, ry, c) { for (var y = 0; y < this.n; y++) for (var x = 0; x < this.n; x++) { var dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry; if (dx * dx + dy * dy <= 1) this.set(x, y, c); } };
  Raster.prototype.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c); };
  Raster.prototype.tri = function (ax, ay, bx, by, cx, cy, c) {
    function s(px, py, x1, y1, x2, y2) { return (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2); }
    for (var y = 0; y < this.n; y++) for (var x = 0; x < this.n; x++) {
      var px = x + 0.5, py = y + 0.5, d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay);
      if (!(((d1 < 0) || (d2 < 0) || (d3 < 0)) && ((d1 > 0) || (d2 > 0) || (d3 > 0)))) this.set(x, y, c);
    }
  };
  Raster.prototype.outline = function (c) {
    var add = [];
    for (var y = 0; y < this.n; y++) for (var x = 0; x < this.n; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    var self = this; add.forEach(function (p) { self.set(p[0], p[1], c); });
  };
  Raster.prototype.paint = function (canvas) {
    var ctx = ctx2d(canvas); if (!ctx) return canvas;
    canvas.width = this.n; canvas.height = this.n; ctx.clearRect(0, 0, this.n, this.n);
    for (var i = 0; i < this.px.length; i++) if (this.px[i]) { ctx.fillStyle = this.px[i]; ctx.fillRect(i % this.n, Math.floor(i / this.n), 1, 1); }
    return canvas;
  };

  var MARKS = {
    '+': ['00100', '00100', '11111', '00100', '00100'], '−': ['00000', '00000', '11111', '00000', '00000'],
    '×': ['10001', '01010', '00100', '01010', '10001'], '÷': ['00100', '00000', '11111', '00000', '00100']
  };
  function monsterRaster(d) {
    var r = new Raster(32), b = d.body, ac = d.accent, bl = d.belly, P = d.parts || [];
    function has(p) { return P.indexOf(p) >= 0; }
    if (has('shell')) { r.ell(16, 19, 13, 10, ac); r.ell(16, 19, 11, 8, '#c08a4a'); }
    if (has('wings')) { r.ell(5, 15, 5, 7, ac); r.ell(27, 15, 5, 7, ac); }
    if (has('flameTail')) { r.ell(27, 21, 3, 3, b); r.ell(28, 14, 3.5, 5, '#f03e3e'); r.ell(28, 15, 2, 3, '#ffd43b'); }
    if (has('bolt')) { r.rect(24, 18, 3, 3, b); r.rect(26, 15, 3, 3, ac); r.rect(24, 12, 3, 3, ac); r.rect(26, 9, 3, 3, ac); }
    if (has('tailCurl')) { r.ell(27, 23, 3, 3, b); r.ell(28, 21, 2, 2, bl); }
    if (has('bulb')) { r.ell(16, 9, 8, 6, ac); r.rect(15, 4, 2, 10, '#1b5e20'); r.ell(16, 4, 3, 2, '#8ce99a'); }
    if (has('mouseEars')) { r.ell(8, 8, 4.5, 4.5, b); r.ell(24, 8, 4.5, 4.5, b); r.ell(8, 8, 2.2, 2.2, ac); r.ell(24, 8, 2.2, 2.2, ac); }
    if (has('catEars')) { r.tri(6, 3, 6, 14, 14, 10, b); r.tri(26, 3, 26, 14, 18, 10, b); r.tri(7, 6, 7, 12, 11, 10, ac); r.tri(25, 6, 25, 12, 21, 10, ac); }
    if (has('bearEars')) { r.ell(9, 9, 3.5, 3.5, b); r.ell(23, 9, 3.5, 3.5, b); r.ell(9, 9, 1.8, 1.8, ac); r.ell(23, 9, 1.8, 1.8, ac); }
    if (has('horn')) { r.tri(13, 10, 19, 10, 16, 1, '#ffe066'); }
    if (has('horns2')) { r.ell(8, 10, 3, 3, ac); r.ell(24, 10, 3, 3, ac); }
    if (has('antenna')) { r.rect(11, 3, 1, 7, '#222'); r.rect(20, 3, 1, 7, '#222'); r.ell(11.5, 3, 2, 2, ac); r.ell(20.5, 3, 2, 2, ac); }
    if (has('spikes')) { r.tri(8, 13, 12, 13, 10, 5, ac); r.tri(14, 11, 18, 11, 16, 3, ac); r.tri(20, 13, 24, 13, 22, 5, ac); }
    if (has('fluff')) { [[9, 13], [16, 10], [23, 13], [7, 20], [25, 20], [11, 26], [21, 26]].forEach(function (p) { r.ell(p[0], p[1], 5, 5, b); }); }
    if (has('feet')) { r.ell(11, 28, 3.5, 2.5, ac); r.ell(21, 28, 3.5, 2.5, ac); }
    if (has('zigzagCrest')) { r.tri(9, 9, 13, 9, 10, 2, ac); r.tri(14, 9, 18, 9, 16, 1, ac); r.tri(19, 9, 23, 9, 22, 2, ac); }
    if (has('stubWings')) { r.ell(5, 18, 3, 4, ac); r.ell(27, 18, 3, 4, ac); }
    if (has('flameCrest')) { r.tri(11, 7, 21, 7, 16, -1, '#ffd43b'); r.tri(13, 7, 19, 7, 16, 2, '#f03e3e'); }
    if (has('fluffTail')) { r.ell(26, 22, 4, 3, b); r.ell(29, 19, 2.5, 2.5, bl); }
    if (has('leafEars')) { r.tri(9, 11, 6, 0, 13, 9, ac); r.tri(23, 11, 26, 0, 19, 9, ac); r.tri(9, 10, 8, 3, 11, 8, '#8ce99a'); r.tri(23, 10, 24, 3, 21, 8, '#8ce99a'); }
    if (has('dropCrest')) { r.tri(12, 9, 20, 9, 16, 0, '#a5d8ff'); r.tri(14, 8, 18, 8, 16, 3, '#e7f5ff'); }
    if (has('fanTail')) { r.tri(25, 20, 31, 15, 31, 27, ac); r.tri(25, 22, 31, 19, 31, 29, b); }
    if (has('slime')) { r.ell(16, 21, 13, 9, b); r.rect(3, 22, 26, 7, b); r.ell(16, 21, 9, 6, bl); }
    else { r.ell(16, 18, d.bw || 10, d.bh || 10, b); r.ell(16, 22, 6.5, 5.5, bl); }
    if (has('cannon')) { r.rect(8, 9, 7, 4, '#343a40'); r.rect(17, 9, 7, 4, '#343a40'); r.rect(9, 7, 5, 3, '#495057'); r.rect(18, 7, 5, 3, '#495057'); }
    if (has('flower')) { [[11, 8], [21, 8], [16, 5], [16, 12]].forEach(function (p) { r.ell(p[0], p[1], 2.6, 2.6, '#f06595'); }); r.ell(16, 8.5, 2.4, 2.4, '#ffd43b'); }
    if (has('beak')) { r.tri(14, 18, 18, 18, 16, 22, '#fab005'); }
    if (has('mask')) { r.rect(8, 13, 16, 4, '#495057'); }
    if (has('spots')) { r.ell(9, 15, 1.5, 1.5, ac); r.ell(23, 17, 1.5, 1.5, ac); r.ell(11, 24, 1.2, 1.2, ac); }
    if (has('crown')) { r.rect(9, 3, 14, 4, '#fcc419'); r.tri(9, 3, 12, 3, 10.5, -1, '#fcc419'); r.tri(14.5, 3, 17.5, 3, 16, -2, '#fcc419'); r.tri(20, 3, 23, 3, 21.5, -1, '#fcc419'); r.set(16, 4, '#e03131'); }
    // 얼굴
    var ey = has('slime') ? 18 : 15;
    [[12, ey], [19, ey]].forEach(function (p) { r.rect(p[0], p[1], 2, 3, '#1a1a1a'); r.set(p[0], p[1], '#fff'); });
    if (d.cheek) { r.ell(9, ey + 4, 1.8, 1.4, d.cheek); r.ell(23, ey + 4, 1.8, 1.4, d.cheek); }
    if (!has('beak')) { r.set(15, ey + 4, '#1a1a1a'); r.set(16, ey + 4, '#1a1a1a'); }
    if (d.mark && MARKS[d.mark]) { MARKS[d.mark].forEach(function (row, j) { for (var i = 0; i < 5; i++) if (row[i] === '1') r.set(14 + i, 21 + j, d.markColor || '#fff'); }); }
    r.outline('#1d1d2b');
    return r;
  }
  function personRaster(p, n) {
    n = n || 32; var r = new Raster(n), k = n / 32;
    if (p.cape) r.rect(8 * k, 15 * k, 16 * k, 13 * k, p.cape);
    r.rect(12 * k, 25 * k, 3 * k, 5 * k, p.pants); r.rect(17 * k, 25 * k, 3 * k, 5 * k, p.pants);
    r.rect(10 * k, 16 * k, 12 * k, 10 * k, p.shirt);
    r.rect(7 * k, 17 * k, 3 * k, 7 * k, p.shirt); r.rect(22 * k, 17 * k, 3 * k, 7 * k, p.shirt);
    r.rect(7 * k, 24 * k, 3 * k, 2 * k, p.skin); r.rect(22 * k, 24 * k, 3 * k, 2 * k, p.skin);
    r.ell(16 * k, 10 * k, 6.5 * k, 6.5 * k, p.skin);
    r.ell(16 * k, 6 * k, 7 * k, 4 * k, p.hair); r.rect(9 * k, 5 * k, 2 * k, 6 * k, p.hair); r.rect(21 * k, 5 * k, 2 * k, 6 * k, p.hair);
    if (p.hat) { r.rect(9 * k, 2 * k, 14 * k, 4 * k, p.hat); r.rect(7 * k, 5 * k, 10 * k, 2 * k, p.hat); }
    var dir = p.dir || 'down';
    if (dir === 'down') { r.rect(13 * k, 10 * k, 1, 2 * k, '#111'); r.rect(18 * k, 10 * k, 1, 2 * k, '#111'); }
    else if (dir === 'left') r.rect(11 * k, 10 * k, 1, 2 * k, '#111');
    else if (dir === 'right') r.rect(20 * k, 10 * k, 1, 2 * k, '#111');
    else r.ell(16 * k, 9 * k, 6 * k, 5 * k, p.hair);
    r.outline('#1d1d2b');
    return r;
  }

  var MONS = {
    zzi: { name: '찌리새', type: '전기', body: '#ffd43b', belly: '#fff3bf', accent: '#e8590c', cheek: '#ff6b6b', parts: ['zigzagCrest', 'beak', 'stubWings', 'feet'] },
    bul: { name: '불여우', type: '불', body: '#ff922b', belly: '#ffe8cc', accent: '#c2410c', parts: ['catEars', 'flameCrest', 'fluffTail', 'feet'] },
    pul: { name: '풀토끼', type: '풀', body: '#69db7c', belly: '#d3f9d8', accent: '#2b8a3e', parts: ['leafEars', 'feet'] },
    mul: { name: '물방울돌', type: '물', body: '#4dabf7', belly: '#e7f5ff', accent: '#1c7ed6', parts: ['dropCrest', 'fanTail', 'feet'] }
  };
  var WILD = {
    add: [{ name: '플러피', body: '#ffc9de', belly: '#fff0f6', accent: '#f783ac', parts: ['fluff'], mark: '+', markColor: '#d6336c' },
      { name: '더하곰', body: '#c08457', belly: '#f1d3b3', accent: '#7a4b2a', parts: ['bearEars', 'feet'], mark: '+', markColor: '#7a4b2a' },
      { name: '합체룡', body: '#e64980', belly: '#ffdeeb', accent: '#a61e4d', parts: ['horn', 'wings', 'feet'], mark: '+', markColor: '#a61e4d' }],
    sub: [{ name: '빼꼼이', body: '#a5d8ff', belly: '#e7f5ff', accent: '#1971c2', parts: ['slime', 'antenna'], mark: '−', markColor: '#1971c2' },
      { name: '마이너구리', body: '#adb5bd', belly: '#f1f3f5', accent: '#495057', parts: ['catEars', 'mask', 'feet'], mark: '−', markColor: '#212529' },
      { name: '빼기라스', body: '#2f9e44', belly: '#d8f5a2', accent: '#1b5e20', parts: ['spikes', 'feet'], mark: '−', markColor: '#1b5e20' }],
    mul: [{ name: '곱슬양', body: '#f8f9fa', belly: '#fff', accent: '#868e96', parts: ['fluff', 'horns2'], mark: '×', markColor: '#495057' },
      { name: '두배새', body: '#74c0fc', belly: '#e7f5ff', accent: '#1864ab', parts: ['wings', 'beak', 'feet'], mark: '×', markColor: '#1864ab' },
      { name: '곱하곤', body: '#ff922b', belly: '#fff4e6', accent: '#d9480f', parts: ['horn', 'wings', 'spikes', 'feet'], mark: '×', markColor: '#d9480f' }],
    div: [{ name: '나누리', body: '#d0bfff', belly: '#f3f0ff', accent: '#6741d9', parts: ['slime'], mark: '÷', markColor: '#6741d9' },
      { name: '쪼개미', body: '#e03131', belly: '#ffc9c9', accent: '#5c0f0f', parts: ['antenna', 'feet'], mark: '÷', markColor: '#5c0f0f' },
      { name: '몫돌이', body: '#868e96', belly: '#dee2e6', accent: '#343a40', parts: ['spikes', 'feet'], mark: '÷', markColor: '#212529', bw: 11, bh: 10 }]
  };
  // 관장이 내보내는 강한 몬스터 (이름·모양은 독자 디자인, 전투 시 한 마리씩 등장)
  var GYM_MON = {
    add: { name: '철갑거북', body: '#339af0', belly: '#d0ebff', accent: '#1864ab', parts: ['shell', 'spikes', 'feet'], bw: 11, bh: 10 },
    sub: { name: '화염비룡', body: '#ff922b', belly: '#ffe8cc', accent: '#c2410c', parts: ['wings', 'horn', 'feet'], bw: 10, bh: 10 },
    mul: { name: '꽃빛왕', body: '#40c057', belly: '#d3f9d8', accent: '#2b8a3e', parts: ['flower', 'feet'], bw: 11, bh: 10 },
    div: { name: '별뿔왕', body: '#9775fa', belly: '#e5dbff', accent: '#5f3dc4', parts: ['antenna', 'spikes', 'horn', 'feet'], bw: 11, bh: 11 }
  };
  var KING = { name: '매뜨킹', body: '#7048e8', belly: '#e5dbff', accent: '#3b1f9e', parts: ['wings', 'horn', 'crown', 'feet'], bw: 11, bh: 11 };
  var PLAYER = { skin: '#ffd8a8', hair: '#3b2a1a', shirt: '#339af0', pants: '#343a40', hat: '#e03131' };
  var LEADERS = {
    add: { name: '더하기 관장 한결', look: { skin: '#ffd8a8', hair: '#c92a2a', shirt: '#ff8787', pants: '#5c0f0f', cape: '#c92a2a' } },
    sub: { name: '빼기 관장 소라', look: { skin: '#ffe3c4', hair: '#1864ab', shirt: '#74c0fc', pants: '#0b3d6e', cape: '#1864ab' } },
    mul: { name: '곱하기 관장 태양', look: { skin: '#f1c48f', hair: '#e67700', shirt: '#ffd43b', pants: '#7a4b00', cape: '#e67700' } },
    div: { name: '나누기 관장 하늘', look: { skin: '#ffd8a8', hair: '#5f3dc4', shirt: '#b197fc', pants: '#2b1a6b', cape: '#5f3dc4' } }
  };
  var BADGE_COLOR = { add: '#e03131', sub: '#1c7ed6', mul: '#f59f00', div: '#7048e8' };
  var spriteCache = {};
  function spriteCanvas(key, rasterFn) {
    if (!spriteCache[key]) { var c = document.createElement('canvas'); rasterFn().paint(c); spriteCache[key] = c; }
    return spriteCache[key];
  }
  function drawInto(canvas, raster) { raster.paint(canvas); }

  // =============== 지도 ===============
  function grid(w, h, ch) { var t = []; for (var y = 0; y < h; y++) { var row = []; for (var x = 0; x < w; x++) row.push(ch); t.push(row); } return t; }
  function fillR(t, x0, y0, x1, y1, ch) { for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) t[y][x] = ch; }
  function border(t, ch) { var h = t.length, w = t[0].length; for (var x = 0; x < w; x++) { t[0][x] = ch; t[h - 1][x] = ch; } for (var y = 0; y < h; y++) { t[y][0] = ch; t[y][w - 1] = ch; } }
  function stamp(m, b) { fillR(m.t, b.x, b.y, b.x + b.w - 1, b.y + b.h - 1, 'B'); b.door = { x: b.x + Math.floor(b.w / 2), y: b.y + b.h - 1 }; m.t[b.door.y][b.door.x] = 'D'; }
  var MAPS = {};
  var FIELD_INFO = {
    add: { name: '덧셈 필드', floor: '#a3d977', path: '#ecd9a0', roof: '#e03131', third: { type: 'shop', name: '문구점', emoji: '🖍️' }, second: 'police' },
    sub: { name: '뺄셈 필드', floor: '#c5d97a', path: '#e6cf98', roof: '#1c7ed6', third: { type: 'shop', name: '시장', emoji: '🧺' }, second: 'fire' },
    mul: { name: '곱셈 필드', floor: '#8fd6b0', path: '#e9dcb0', roof: '#f59f00', third: { type: 'shop', name: '과수원 집', emoji: '🍊' }, second: 'police' },
    div: { name: '나눗셈 필드', floor: '#b2cf8a', path: '#e3d3a8', roof: '#7048e8', third: { type: 'shop', name: '빵집', emoji: '🥐' }, second: 'fire' }
  };
  var TOWN_RETURN = { add: { x: 11, y: 1, dir: 'down' }, sub: { x: 22, y: 7, dir: 'left' }, mul: { x: 11, y: 14, dir: 'up' }, div: { x: 1, y: 7, dir: 'right' } };

  function buildTown() {
    var m = { id: 'town', name: '시작 마을', kind: 'town', w: 24, h: 16, music: 'town', floor: '#9bd77a', path: '#e9d8a6' };
    var t = m.t = grid(24, 16, 'o'); border(t, 'T');
    fillR(t, 11, 1, 12, 14, '.'); fillR(t, 1, 7, 22, 8, '.');
    t[0][11] = t[0][12] = 'X'; t[15][11] = t[15][12] = 'X'; t[7][0] = t[8][0] = 'X'; t[7][23] = t[8][23] = 'X';
    [[2, 13], [9, 3], [14, 3], [21, 4], [9, 11], [14, 12], [21, 14], [2, 9]].forEach(function (p) { t[p[1]][p[0]] = '*'; });
    [[1, 1], [22, 1], [1, 14], [22, 10], [8, 14], [15, 1]].forEach(function (p) { t[p[1]][p[0]] = 'T'; });
    m.buildings = [
      { x: 3, y: 2, w: 5, h: 3, type: 'center', name: '매뜨센터', emoji: '💗', roof: '#f06595' },
      { x: 16, y: 2, w: 5, h: 3, type: 'rest', name: '마을 식당', emoji: '🍚', roof: '#fab005' },
      { x: 3, y: 10, w: 5, h: 3, type: 'home', name: '우리 집', emoji: '🏠', roof: '#4dabf7' },
      { x: 15, y: 10, w: 6, h: 4, type: 'hall', name: '챔피언 전당', emoji: '🏆', roof: '#7048e8' }
    ];
    m.buildings.forEach(function (b) { stamp(m, b); });
    fillR(t, 5, 5, 5, 6, '.'); fillR(t, 18, 5, 18, 6, '.'); fillR(t, 5, 13, 10, 13, '.'); fillR(t, 13, 14, 18, 14, '.');
    m.exits = [[11, 0, 'add'], [12, 0, 'add'], [23, 7, 'sub'], [23, 8, 'sub'], [11, 15, 'mul'], [12, 15, 'mul'], [0, 7, 'div'], [0, 8, 'div']].map(function (e) { return { x: e[0], y: e[1], to: 'f' + e[2], tx: 14, ty: 18, dir: 'up' }; });
    m.signs = [{ x: 13, y: 1, text: '북쪽 ↑ 덧셈 필드' }, { x: 21, y: 6, text: '동쪽 → 뺄셈 필드' }, { x: 10, y: 14, text: '남쪽 ↓ 곱셈 필드' }, { x: 2, y: 6, text: '서쪽 ← 나눗셈 필드' }];
    m.labels = [{ x: 12, y: 0.55, text: '↑ 덧셈 필드' }, { x: 21.3, y: 9.6, text: '뺄셈 필드 →' }, { x: 12, y: 15.55, text: '↓ 곱셈 필드' }, { x: 2.7, y: 9.6, text: '← 나눗셈 필드' }];
    m.npcs = [
      { x: 14, y: 6, name: '매뜨 박사', look: { skin: '#ffd8a8', hair: '#dee2e6', shirt: '#f8f9fa', pants: '#868e96' }, talk: 'doctor' },
      { x: 8, y: 9, name: '민준', look: { skin: '#ffd8a8', hair: '#5c3d1e', shirt: '#69db7c', pants: '#1864ab' }, lines: ['풀숲에 들어가면 몬스터가 나와!', '문제를 맞히면 내 몬스터가 공격해!'] },
      { x: 21, y: 12, name: '할머니', look: { skin: '#ffe3c4', hair: '#ced4da', shirt: '#e599f7', pants: '#862e9c' }, talk: 'grandma' }
    ];
    return m;
  }

  var NPC_LINES = {
    add: [['덧셈은 모두 몇 개인지 합치는 거야!', '"모두", "더", "합쳐서"라는 말이 나오면 덧셈이야.'], ['일의 자리끼리 더해서 10이 넘으면', '윗자리로 1을 올려 줘!'], ['3단계 풀숲에는 큰 수 몬스터가 살아.', '천천히 자리를 맞춰서 계산해 봐!'], ['관장님은 이 필드에서 몬스터를', '3마리 이긴 사람만 만나 주신대.']],
    sub: [['뺄셈은 남은 것을 구하는 거야!', '"남은", "덜", "차이"라는 말이 나오면 뺄셈이야.'], ['일의 자리에서 뺄 수 없으면', '윗자리에서 10을 빌려 와!'], ['0이 있는 수는 조심해!', '0에서는 빌릴 수 없으니 그 윗자리에서 먼저 빌려 와.'], ['관장님은 이 필드에서 몬스터를', '3마리 이긴 사람만 만나 주신대.']],
    mul: [['곱셈은 같은 수를 여러 번 더하는 거야!', '3 × 4는 3을 4번 더한 것과 같아.'], ['구구단을 외우면 곱셈 몬스터를 쉽게 이길 수 있어!'], ['큰 수 곱셈은 일의 자리부터 곱하고', '올림한 수를 꼭 더해 줘!'], ['관장님은 이 필드에서 몬스터를', '3마리 이긴 사람만 만나 주신대.']],
    div: [['나눗셈은 똑같이 나누는 거야!', '12 ÷ 3은 12를 3묶음으로 똑같이 나누는 거지.'], ['나눗셈이 어려우면 곱셈으로 생각해 봐!', '3 × □ = 12에서 □를 찾으면 돼.'], ['3단계 풀숲에서는 나머지가 생겨.', '나머지는 나누는 수보다 항상 작아!'], ['관장님은 이 필드에서 몬스터를', '3마리 이긴 사람만 만나 주신대.']]
  };
  function zoneOfTile(ch) { return ch === ':' || ch === 'h' ? 3 : (ch === ';' || ch === 'g') ? 2 : 1; }
  var NPC_LOOKS = [
    { skin: '#ffd8a8', hair: '#212529', shirt: '#ffa94d', pants: '#495057' }, { skin: '#f1c48f', hair: '#862e9c', shirt: '#63e6be', pants: '#0b7285' },
    { skin: '#ffe3c4', hair: '#e67700', shirt: '#ff8787', pants: '#343a40' }, { skin: '#ffd8a8', hair: '#495057', shirt: '#a5d8ff', pants: '#1864ab' }
  ];

  function buildField(op) {
    var fi = FIELD_INFO[op];
    var W = 45, H = 30;
    var m = { id: 'f' + op, name: fi.name, kind: 'field', op: op, w: W, h: H, music: 'field', floor: fi.floor, path: fi.path };
    var t = m.t = grid(W, H, 'o'); border(t, 'T');
    // 3단계 고급 풀숲(위), 2단계 중급 풀숲(가운데), 1단계 초급 풀숲(왼쪽 아래)
    fillR(t, 1, 1, 43, 7, ':'); fillR(t, 1, 8, 43, 8, '='); t[8][22] = t[8][23] = 'h';
    fillR(t, 1, 9, 43, 14, ';'); fillR(t, 1, 15, 43, 15, '='); t[15][22] = t[15][23] = 'g';
    fillR(t, 3, 16, 16, 23, ',');
    // 길: 가운데 세로 길, 건물 앞 가로 길, 아래쪽 큰 길
    fillR(t, 22, 1, 23, 7, '.'); fillR(t, 22, 9, 23, 14, '.'); fillR(t, 22, 16, 23, 28, '.');
    fillR(t, 24, 19, 41, 19, '.'); fillR(t, 26, 26, 40, 26, '.'); fillR(t, 3, 27, 41, 28, '.');
    t[29][22] = t[29][23] = 'X';
    [[6, 3], [13, 2], [33, 2], [39, 4], [10, 11], [30, 10], [38, 12], [18, 20], [4, 20]].forEach(function (p) { t[p[1]][p[0]] = 'T'; });
    var second = fi.second === 'police' ? { type: 'police', name: '경찰서', emoji: '🚓', roof: '#364fc7' } : { type: 'fire', name: '소방서', emoji: '🚒', roof: '#e03131' };
    m.buildings = [
      { x: 25, y: 16, w: 6, h: 3, type: 'rest', name: fi.name.replace(' 필드', '') + ' 식당', emoji: '🍚', roof: '#fab005' },
      { x: 35, y: 16, w: 6, h: 3, type: second.type, name: second.name, emoji: second.emoji, roof: second.roof },
      { x: 6, y: 24, w: 6, h: 3, type: fi.third.type, name: fi.third.name, emoji: fi.third.emoji, roof: '#20c997' },
      { x: 27, y: 22, w: 10, h: 4, type: 'gym', name: fi.name.replace(' 필드', '') + ' 체육관', emoji: '🏅', roof: fi.roof }
    ];
    m.buildings.forEach(function (b) { stamp(m, b); });
    m.exits = [{ x: 22, y: 29, to: 'town', back: op }, { x: 23, y: 29, to: 'town', back: op }];
    m.spawn = { x: 22, y: 28, dir: 'up' };
    m.signs = [{ x: 20, y: 20, text: '← 1단계 초급 풀숲' }, { x: 20, y: 11, text: '← 2단계 중급 풀숲' }, { x: 20, y: 4, text: '← 3단계 고급 풀숲' }];
    m.labels = [{ x: 17.5, y: 16.45, text: '1단계 초급' }, { x: 17.5, y: 9.45, text: '2단계 중급' }, { x: 17.5, y: 1.45, text: '3단계 고급' }];
    var L = NPC_LINES[op];
    m.npcs = [
      { x: 21, y: 16, name: '문지기', look: NPC_LOOKS[3], talk: 'gate' },
      { x: 14, y: 25, name: '하린', look: NPC_LOOKS[0], lines: L[0] },
      { x: 8, y: 12, name: '도윤', look: NPC_LOOKS[1], lines: L[1] },
      { x: 30, y: 4, name: '서아', look: NPC_LOOKS[2], lines: L[2] },
      { x: 38, y: 23, name: '체육관 안내원', look: NPC_LOOKS[3], lines: L[3] }
    ];
    return m;
  }

  var ROOM_LINES = {
    center: ['어서 오세요, 매뜨센터예요!', '몬스터의 HP를 모두 회복해 드렸어요. 힘내요!'],
    home: ['엄마: 왔구나! 밥 먹고 쉬었다 가렴.', '엄마: 틀려도 괜찮아. 다시 생각하면 돼!'],
    rest: { add: ['셰프: 김밥 3줄에 2줄을 더 만들면 5줄!', '셰프: 든든하게 먹었으니 HP가 꽉 찼어요!'], sub: ['셰프: 만두 10개 중 4개를 먹으면 6개가 남지!', '셰프: 배부르게 먹었으니 HP가 꽉 찼어요!'], mul: ['셰프: 한 접시에 떡 4개씩, 3접시면 12개!', '셰프: 맛있게 먹었으니 HP가 꽉 찼어요!'], div: ['셰프: 피자 8조각을 4명이 나누면 2조각씩!', '셰프: 잘 먹었으니 HP가 꽉 찼어요!'], town: ['셰프: 어서 와! 따뜻한 밥 먹고 가렴.', '셰프: HP가 모두 회복되었어요!'] },
    police: { add: ['경찰관: + 기호는 "더하기"라고 읽어.', '경찰관: 두 수를 합치라는 뜻이야. 꼭 기억해!'], mul: ['경찰관: × 기호는 "곱하기"라고 읽어.', '경찰관: 같은 수를 여러 번 더한다는 뜻이야!'], sub: ['경찰관: − 기호는 "빼기"라고 읽어.', '경찰관: 덜어 내라는 뜻이야!'], div: ['경찰관: ÷ 기호는 "나누기"라고 읽어.', '경찰관: 똑같이 나눈다는 뜻이야!'] },
    fire: { sub: ['소방관: 문장제 문제는 먼저 "무엇을 구하나요?"를 찾아요.', '소방관: "남은", "더 많은", "차이"가 보이면 뺄셈일 수 있어요!'], div: ['소방관: 문장제 문제는 먼저 "무엇을 구하나요?"를 찾아요.', '소방관: "똑같이 나누어", "몇 묶음"이 보이면 나눗셈이에요!'], add: ['소방관: 문제에서 숫자에 동그라미를 쳐 봐요.', '소방관: 그다음 식을 세워요!'], mul: ['소방관: 문제에서 숫자에 동그라미를 쳐 봐요.', '소방관: "씩", "묶음"이 보이면 곱셈일 수 있어요!'] },
    shop: { add: ['문구점 주인: 연필 3자루와 지우개 2개를 사면 물건은 모두 5개!', '문구점 주인: 덧셈은 생활 곳곳에 있단다.'], sub: ['상인: 사과 9개 중 3개를 팔았으니 6개가 남았네!', '상인: 남은 것을 셀 때 뺄셈을 쓰지.'], mul: ['과수원 아저씨: 나무 한 그루에 귤이 6개씩, 5그루면 30개!', '과수원 아저씨: 곱셈으로 빨리 셀 수 있지.'], div: ['제빵사: 빵 12개를 3봉지에 똑같이 담으면 4개씩!', '제빵사: 나눗셈은 공평하게 나누는 거야.'] }
  };

  function buildInterior(parent, bi) {
    var b = parent.buildings[bi];
    var m = { id: 'i' + parent.id + bi, kind: 'interior', parent: parent.id, bIndex: bi, btype: b.type, op: parent.op || null, name: b.name, w: 12, h: 9, music: (b.type === 'gym' || b.type === 'hall') ? 'boss' : parent.music };
    var t = m.t = grid(12, 9, 'f');
    fillR(t, 0, 0, 11, 1, 'w'); for (var y = 0; y < 9; y++) { t[y][0] = 'w'; t[y][11] = 'w'; } fillR(t, 0, 8, 11, 8, 'w');
    t[8][6] = 'm';
    m.floor = (b.type === 'gym' || b.type === 'hall') ? '#dee2e6' : '#e3c48d';
    m.exits = [{ x: 6, y: 8, to: parent.id, tx: b.door.x, ty: b.door.y + 1, dir: 'down' }];
    m.spawn = { x: 6, y: 7, dir: 'up' };
    m.signs = []; m.labels = []; m.buildings = [];
    if (b.type === 'gym' || b.type === 'hall') {
      [[3, 4], [8, 4], [3, 6], [8, 6]].forEach(function (p) { t[p[1]][p[0]] = 'q'; });
      if (b.type === 'gym') m.npcs = [{ x: 6, y: 2, name: LEADERS[parent.op].name, look: LEADERS[parent.op].look, talk: 'leader' }];
      else m.npcs = [{ x: 6, y: 2, name: '매뜨킹', monster: KING, talk: 'king' }];
    } else {
      fillR(t, 3, 4, 8, 4, 'c'); t[6][2] = 'k'; t[6][9] = 'k'; t[2][1] = 'p'; t[2][10] = 'p';
      var who = { center: '간호사 하나', home: '엄마', rest: '셰프', police: '경찰관', fire: '소방관', shop: b.name + ' 주인' }[b.type];
      var look = { center: { skin: '#ffd8a8', hair: '#f783ac', shirt: '#fff', pants: '#f06595' }, home: { skin: '#ffd8a8', hair: '#5c3d1e', shirt: '#ffc078', pants: '#e8590c' }, rest: { skin: '#ffd8a8', hair: '#fff', shirt: '#fff', pants: '#343a40', hat: '#fff' }, police: { skin: '#ffd8a8', hair: '#212529', shirt: '#364fc7', pants: '#1c2541', hat: '#1c2541' }, fire: { skin: '#ffd8a8', hair: '#212529', shirt: '#e03131', pants: '#343a40', hat: '#fab005' }, shop: { skin: '#f1c48f', hair: '#7a4b2a', shirt: '#20c997', pants: '#495057' } }[b.type];
      var lines = ROOM_LINES[b.type];
      if (!Array.isArray(lines)) lines = lines[parent.op || 'town'] || lines.town;
      m.npcs = [{ x: 6, y: 3, name: who, look: look, lines: lines }];
    }
    return m;
  }
  function getMap(id) {
    if (MAPS[id]) return MAPS[id];
    var m = null;
    if (id === 'town') m = buildTown();
    else if (/^f(add|sub|mul|div)$/.test(id)) m = buildField(id.slice(1));
    else {
      var mm = /^i(town|fadd|fsub|fmul|fdiv)(\d)$/.exec(id);
      if (mm) { var par = getMap(mm[1]); if (par.buildings[+mm[2]]) m = buildInterior(par, +mm[2]); }
    }
    if (m) MAPS[id] = m;
    return m;
  }
  MM.getMap = getMap;

  // =============== 지도 그리기 ===============
  var mapCanvas = $('map'), mctx = ctx2d(mapCanvas);
  if (mctx) mctx.imageSmoothingEnabled = false;
  var staticLayer = null, staticFor = null;
  function hash(x, y) { var h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  var GRASS = { ',': ['#51cf66', '#2b8a3e'], ';': ['#37b24d', '#1b5e20'], ':': ['#2b8a3e', '#0b3d14'] };
  function drawTile(c, m, x, y) {
    var ch = m.t[y][x], px = x * TILE, py = y * TILE;
    function base(col) { c.fillStyle = col; c.fillRect(px, py, TILE, TILE); }
    switch (ch) {
      case 'o': case '*': case 'T': case '=':
        base(m.floor);
        if (hash(x, y) > 0.6) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(px + 8, py + 10, 4, 4); c.fillRect(px + 26, py + 24, 4, 4); }
        if (ch === '*') { [[10, 12, '#ff6b6b'], [26, 20, '#fcc419'], [16, 28, '#fff']].forEach(function (f) { c.fillStyle = f[2]; c.fillRect(px + f[0], py + f[1], 6, 6); c.fillStyle = '#e8590c'; c.fillRect(px + f[0] + 2, py + f[1] + 2, 2, 2); }); }
        if (ch === 'T') { c.fillStyle = '#6b3e1e'; c.fillRect(px + 16, py + 24, 8, 14); c.fillStyle = '#1e6b33'; c.fillRect(px + 4, py + 4, 32, 24); c.fillRect(px + 8, py + 0, 24, 30); c.fillStyle = '#2f9e44'; c.fillRect(px + 10, py + 6, 10, 8); c.fillStyle = '#14532d'; c.fillRect(px + 4, py + 24, 32, 4); }
        if (ch === '=') { c.fillStyle = '#8d5a2b'; c.fillRect(px, py + 14, TILE, 6); c.fillRect(px, py + 26, TILE, 6); c.fillStyle = '#6b3e1e'; c.fillRect(px + 4, py + 8, 7, 30); c.fillRect(px + 28, py + 8, 7, 30); }
        break;
      case '.': case 'X':
        base(m.path); c.fillStyle = 'rgba(120,90,40,.18)'; if (hash(x, y) > 0.5) c.fillRect(px + 12, py + 18, 4, 4);
        if (ch === 'X') { c.fillStyle = 'rgba(255,255,255,.75)'; c.fillRect(px + 12, py + 12, 16, 16); c.fillStyle = '#e8590c'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText('★', px + 20, py + 27); }
        break;
      case ',': case ';': case ':':
        var g = GRASS[ch]; base(g[0]); c.fillStyle = g[1];
        for (var i = 0; i < 3; i++) { var bx = px + 4 + i * 12 + (y % 2) * 5, by = py + 8 + ((i * 13) % 18); c.fillRect(bx, by, 3, 10); c.fillRect(bx + 4, by + 3, 3, 7); c.fillRect(bx - 3, by + 4, 3, 6); }
        break;
      case 'g': case 'h':
        base(m.path);
        var open = S && S.fields[m.op] && S.fields[m.op].open >= (ch === 'g' ? 2 : 3);
        c.fillStyle = '#6b3e1e'; if (x === 22) c.fillRect(px, py + 4, 8, 34); else c.fillRect(px + 32, py + 4, 8, 34);
        if (!open) { c.fillStyle = '#a0522d'; c.fillRect(px, py + 12, TILE, 6); c.fillRect(px, py + 24, TILE, 6); for (var k = 4; k < TILE; k += 9) c.fillRect(px + k, py + 8, 4, 28); if (x === 22) { c.fillStyle = '#fcc419'; c.fillRect(px + 30, py + 14, 14, 12); c.fillStyle = '#222'; c.fillRect(px + 35, py + 18, 4, 5); } }
        break;
      case 'f': base(m.floor); c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(px, py + 19, TILE, 2); if (m.floor === '#dee2e6' && (x + y) % 2) { c.fillStyle = '#ced4da'; c.fillRect(px, py, TILE, TILE); } break;
      case 'w': base('#8d6e63'); c.fillStyle = '#a1887f'; c.fillRect(px, py, TILE, 30); c.fillStyle = '#6d4c41'; c.fillRect(px, py + 30, TILE, 10); break;
      case 'm': base('#e03131'); c.fillStyle = '#ffc9c9'; c.fillRect(px + 6, py + 6, 28, 4); break;
      case 'c': base(m.floor); c.fillStyle = '#8d5a2b'; c.fillRect(px, py + 6, TILE, 30); c.fillStyle = '#c08a4a'; c.fillRect(px, py + 6, TILE, 10); break;
      case 'k': base(m.floor); c.fillStyle = '#6b3e1e'; c.fillRect(px + 4, py + 8, 32, 22); c.fillStyle = '#fff'; c.fillRect(px + 12, py + 12, 16, 10); break;
      case 'p': base(m.floor); c.fillStyle = '#8d5a2b'; c.fillRect(px + 12, py + 24, 16, 14); c.fillStyle = '#2f9e44'; c.fillRect(px + 8, py + 4, 24, 22); break;
      case 'q': base(m.floor); c.fillStyle = '#868e96'; c.fillRect(px + 10, py + 2, 20, 36); c.fillStyle = '#ced4da'; c.fillRect(px + 12, py + 4, 8, 32); break;
      default: base(m.floor);
    }
  }
  function drawBuilding(c, b, m) {
    var px = b.x * TILE, py = b.y * TILE, w = b.w * TILE, h = b.h * TILE, roofH = Math.round(h * 0.5);
    c.fillStyle = '#f1e3c6'; c.fillRect(px, py, w, h);
    c.fillStyle = b.roof; c.fillRect(px - 4, py - 6, w + 8, roofH + 6);
    c.fillStyle = 'rgba(0,0,0,.18)'; for (var i = 0; i < w + 8; i += 12) c.fillRect(px - 4 + i, py - 6, 4, roofH + 6);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(px - 4, py + roofH - 4, w + 8, 4);
    c.fillStyle = '#74c0fc';
    for (var wx = b.x; wx < b.x + b.w; wx++) if (wx !== b.door.x) { c.fillRect(wx * TILE + 10, py + roofH + 8, 20, 14); }
    var dx = b.door.x * TILE, dy = b.door.y * TILE;
    c.fillStyle = '#5c3d1e'; c.fillRect(dx + 8, dy + 6, 24, 34); c.fillStyle = '#3b2a1a'; c.fillRect(dx + 8, dy + 6, 24, 4); c.fillStyle = '#fcc419'; c.fillRect(dx + 25, dy + 22, 3, 3);
    if (b.type === 'hall' && !(S && C.canFinal(S))) { c.fillStyle = '#495057'; for (var k = 0; k < 4; k++) c.fillRect(dx + 8, dy + 10 + k * 8, 24, 3); }
    c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
    var label = b.emoji + ' ' + b.name, tw = c.measureText ? c.measureText(label).width : 80;
    var lx = px + w / 2, ly = py + 8;
    c.fillStyle = '#fff'; c.fillRect(lx - tw / 2 - 6, ly - 2, tw + 12, 22); c.strokeStyle = '#222'; c.lineWidth = 2; c.strokeRect(lx - tw / 2 - 6, ly - 2, tw + 12, 22);
    c.fillStyle = '#222'; c.fillText(label, lx, ly + 15);
  }
  function buildStatic(m) {
    var cv = document.createElement('canvas'); cv.width = m.w * TILE; cv.height = m.h * TILE;
    var c = ctx2d(cv); if (!c) return cv;
    c.imageSmoothingEnabled = false;
    for (var y = 0; y < m.h; y++) for (var x = 0; x < m.w; x++) drawTile(c, m, x, y);
    (m.buildings || []).forEach(function (b) { drawBuilding(c, b, m); });
    (m.signs || []).forEach(function (s) { var px = s.x * TILE, py = s.y * TILE; c.fillStyle = '#6b3e1e'; c.fillRect(px + 17, py + 20, 6, 18); c.fillStyle = '#c08a4a'; c.fillRect(px + 4, py + 6, 32, 18); c.strokeStyle = '#3b2a1a'; c.lineWidth = 2; c.strokeRect(px + 4, py + 6, 32, 18); c.fillStyle = '#3b2a1a'; c.fillRect(px + 10, py + 12, 20, 2); c.fillRect(px + 10, py + 17, 14, 2); });
    (m.labels || []).forEach(function (l) { c.font = 'bold 17px sans-serif'; c.textAlign = 'center'; var tw = c.measureText ? c.measureText(l.text).width : 90; var lx = l.x * TILE, ly = l.y * TILE; c.fillStyle = 'rgba(255,255,255,.88)'; c.fillRect(lx - tw / 2 - 8, ly - 4, tw + 16, 26); c.strokeStyle = '#222'; c.lineWidth = 2; c.strokeRect(lx - tw / 2 - 8, ly - 4, tw + 16, 26); c.fillStyle = '#222'; c.fillText(l.text, lx, ly + 15); });
    return cv;
  }
  function invalidate() { staticFor = null; }

  // =============== 플레이어 / 이동 ===============
  var P = { moving: false, fx: 0, fy: 0, t: 0, step: 0 };
  var input = { dir: null };
  var MOVE_MS = 170;
  var curMap = null;
  var transitioning = false;
  function busy() { return !S || Dlg.open || transitioning || Battle.active || anySceneOpen() || anyModalOpen(); }
  function anySceneOpen() { return qa('.scene.show').length > 0; }
  function anyModalOpen() { return qa('.modal.show').length > 0; }
  var DXY = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  var SOLID = 'TB=~wc kpq';
  function npcAt(m, x, y) { for (var i = 0; i < (m.npcs || []).length; i++) if (m.npcs[i].x === x && m.npcs[i].y === y) return m.npcs[i]; return null; }
  function signAt(m, x, y) { for (var i = 0; i < (m.signs || []).length; i++) if (m.signs[i].x === x && m.signs[i].y === y) return m.signs[i]; return null; }
  function buildingAtDoor(m, x, y) { for (var i = 0; i < (m.buildings || []).length; i++) { var b = m.buildings[i]; if (b.door.x === x && b.door.y === y) return i; } return -1; }
  function tileAt(m, x, y) { if (x < 0 || y < 0 || x >= m.w || y >= m.h) return ' '; return m.t[y][x]; }

  function tryMove(dir) {
    if (busy() || P.moving) return false;
    var m = curMap; S.dir = dir;
    var nx = S.x + DXY[dir][0], ny = S.y + DXY[dir][1], ch = tileAt(m, nx, ny);
    if (SOLID.indexOf(ch) >= 0 || npcAt(m, nx, ny) || signAt(m, nx, ny)) { return false; }
    if (ch === 'g' || ch === 'h') {
      var need = ch === 'g' ? 2 : 3;
      if (S.fields[m.op].open < need) { input.dir = null; Sound.sfx('bump'); gateMessage(m.op, need); return false; }
    }
    if (ch === 'D') {
      var bi = buildingAtDoor(m, nx, ny);
      if (bi >= 0 && m.buildings[bi].type === 'hall' && !C.canFinal(S)) { input.dir = null; Sound.sfx('bump'); say([{ who: '챔피언 전당', text: '문이 잠겨 있어요. 뱃지 4개를 모두 모으면 열려요!' }, { text: '지금 모은 뱃지: ' + C.badgeCount(S) + '개' }]); return false; }
    }
    P.fx = S.x; P.fy = S.y; S.x = nx; S.y = ny; P.t = 0; P.moving = true; P.step++;
    if (MM.speed === 0) finishStep();
    return true;
  }
  function gateMessage(op, need) {
    var f = S.fields[op], k = f.zk[need - 2];
    say([{ who: '문지기', text: need + '단계 구역은 아직 닫혀 있어요.' }, { who: '문지기', text: (need - 1) + '단계 구역 몬스터를 3마리 이기면 열려요! (지금 ' + Math.min(k, 3) + '/3)' }]);
  }
  function finishStep() {
    P.moving = false; P.t = 1;
    var m = curMap, ch = tileAt(m, S.x, S.y);
    log('step:' + m.id + ':' + S.x + ',' + S.y);
    var ex = (m.exits || []).filter(function (e) { return e.x === S.x && e.y === S.y; })[0];
    if (ex) { useExit(m, ex); return; }
    if (ch === 'D') { var bi = buildingAtDoor(m, S.x, S.y); if (bi >= 0) { enterBuilding(m, bi); return; } }
    if (ch === ',' || ch === ';' || ch === ':') {
      var zone = ch === ',' ? 1 : ch === ';' ? 2 : 3;
      if (MM.rng() < MM.encounterRate) { input.dir = null; startWild(m.op, zone); }
    }
  }
  function goto(id, x, y, dir) {
    var m = getMap(id); if (!m) return;
    curMap = m; S.map = id; S.x = x; S.y = y; S.dir = dir || S.dir; P.moving = false; invalidate();
    Sound.music(m.music); renderHUD(); log('map:' + id);
  }
  MM.goto = function (id, x, y, dir) { goto(id, x, y, dir); };
  async function fadeTo(fn) {
    transitioning = true; Sound.sfx('door');
    try {
      $('fade').classList.add('on'); await delay(260);
      fn(); await delay(60);
    } catch (e) { log('error:fade:' + e.message); console.error(e); }
    finally { $('fade').classList.remove('on'); await delay(200); transitioning = false; }
  }
  function useExit(m, ex) {
    input.dir = null;
    if (m.kind === 'interior') fadeTo(function () { goto(ex.to, ex.tx, ex.ty, ex.dir); });
    else if (ex.to === 'town') { var r = TOWN_RETURN[ex.back]; fadeTo(function () { goto('town', r.x, r.y, r.dir); }); }
    else { var fm = getMap(ex.to); fadeTo(function () { goto(ex.to, fm.spawn.x, fm.spawn.y, fm.spawn.dir); toast(fm.name + '에 왔어요!'); }); }
  }
  function enterBuilding(m, bi) {
    input.dir = null;
    var id = 'i' + m.id + bi, im = getMap(id), type = m.buildings[bi].type;
    fadeTo(function () { goto(id, im.spawn.x, im.spawn.y, 'up'); }).then(function () {
      if (type === 'rest' || type === 'center' || type === 'home') { healAll(); toast('HP가 모두 회복되었어요! 💗'); }
    });
  }
  function healAll() { S.hp = C.maxHp(settings); Sound.sfx('heal'); renderHUD(); log('heal'); }

  // =============== 대화 ===============
  var Dlg = { open: false, queue: [], resolve: null, choice: false };
  function say(lines) {
    return new Promise(function (res) {
      Dlg.queue = lines.map(function (l) { return typeof l === 'string' ? { text: l } : l; });
      Dlg.resolve = res; Dlg.open = true; Dlg.choice = false;
      $('dialog').classList.remove('hidden'); nextLine();
    });
  }
  function nextLine() {
    if (!Dlg.queue.length) { closeDlg(); return; }
    var l = Dlg.queue.shift(); renderDlg(l.who, l.text, null);
  }
  function renderDlg(who, text, choices) {
    var w = qa('.who', $('dialog'))[0];
    if (who) { w.textContent = who; w.classList.remove('hidden'); } else w.classList.add('hidden');
    qa('.txt', $('dialog'))[0].textContent = text;
    var ch = qa('.choices', $('dialog'))[0]; ch.innerHTML = '';
    qa('.more', $('dialog'))[0].style.display = choices ? 'none' : '';
    if (choices) choices.forEach(function (c, i) {
      var b = document.createElement('button'); b.className = 'btn' + (i === 0 ? ' primary' : ''); b.textContent = c; b.setAttribute('data-choice', i);
      b.addEventListener('click', function (e) { e.stopPropagation(); Sound.sfx('select'); var r = Dlg.resolve; closeDlg(true); r(i); });
      ch.appendChild(b);
    });
  }
  function closeDlg(silent) { Dlg.open = false; Dlg.choice = false; $('dialog').classList.add('hidden'); var r = Dlg.resolve; Dlg.resolve = null; if (!silent && r) r(); }
  function advanceDlg() { if (!Dlg.open || Dlg.choice) return; Sound.sfx('select'); nextLine(); }
  function ask(who, text, options) {
    return new Promise(function (res) { Dlg.open = true; Dlg.choice = true; Dlg.queue = []; Dlg.resolve = res; $('dialog').classList.remove('hidden'); renderDlg(who, text, options); });
  }
  MM.say = say;

  // =============== 말 걸기 ===============
  function interact() {
    if (busy()) return;
    var m = curMap, d = DXY[S.dir], tx = S.x + d[0], ty = S.y + d[1];
    var npc = npcAt(m, tx, ty);
    if (!npc && tileAt(m, tx, ty) === 'c') npc = npcAt(m, tx + d[0], ty + d[1]);
    if (npc) { talkTo(npc); return; }
    var sg = signAt(m, tx, ty);
    if (sg) say([{ who: '표지판', text: sg.text }]);
  }
  async function talkTo(npc) {
    var back = { up: 'down', down: 'up', left: 'right', right: 'left' }; npc.dir = back[S.dir];
    log('talk:' + npc.name);
    if (npc.talk === 'doctor') {
      await say([{ who: npc.name, text: S.name + ', 모험은 잘 되고 있니?' }, { who: npc.name, text: '마을 출입구 4곳은 덧셈, 뺄셈, 곱셈, 나눗셈 필드로 이어져 있단다.' }, { who: npc.name, text: '필드에서 몬스터 3마리를 이기면 체육관 관장에게 도전할 수 있어.' }, { who: npc.name, text: '뱃지 4개를 모으면 챔피언 전당의 매뜨킹에게 도전할 수 있지!' }]);
    } else if (npc.talk === 'grandma') {
      await say([{ who: npc.name, text: C.canFinal(S) ? '뱃지 4개를 모았구나! 챔피언 전당 문이 열렸단다.' : '챔피언 전당은 뱃지 4개를 모은 사람만 들어갈 수 있어. (지금 ' + C.badgeCount(S) + '개)' }]);
    } else if (npc.talk === 'gate') {
      var f = S.fields[curMap.op];
      await say([{ who: npc.name, text: '이 필드는 1단계, 2단계, 3단계 구역으로 나뉘어 있어요.' }, { who: npc.name, text: f.open >= 3 ? '모든 구역이 열렸어요! 마음껏 모험하세요.' : (f.open + 1) + '단계 구역은 ' + f.open + '단계 몬스터를 3마리 이기면 열려요. (지금 ' + Math.min(f.zk[f.open - 1], 3) + '/3)' }, { who: npc.name, text: '체육관은 구역과 상관없이 몬스터 3마리만 이기면 도전할 수 있어요!' }]);
    } else if (npc.talk === 'leader') {
      await leaderTalk(npc);
    } else if (npc.talk === 'king') {
      await kingTalk(npc);
    } else {
      await say(npc.lines.map(function (t) { return { who: npc.name, text: t }; }));
    }
  }
  async function leaderTalk(npc) {
    var op = curMap.op, f = S.fields[op];
    if (!C.canChallengeGym(S, op)) {
      await say([{ who: npc.name, text: '도전하러 왔구나!' }, { who: npc.name, text: '먼저 이 필드에서 몬스터 3마리를 이기고 와! (지금 ' + f.wins + '/3)' }]);
      return;
    }
    await say([{ who: npc.name, text: f.badge ? '또 왔구나! 연습 시합도 좋아.' : '좋아, 몬스터 3마리를 이겼구나!' }, { who: npc.name, text: '나는 ' + C.OP_NAME[op] + ' 문장제 문제를 낼 거야. 낮은 단계로 이겨도 똑같은 뱃지를 줄게!' }]);
    var i = await ask(npc.name, '몇 단계로 도전할래?', ['1단계', '2단계', '3단계', '다음에 할게요']);
    if (i === 3) { await say([{ who: npc.name, text: '준비되면 다시 말을 걸어 줘!' }]); return; }
    startBoss('gym', op, i + 1);
  }
  async function kingTalk(npc) {
    await say([{ who: '매뜨킹', text: '크하하! 뱃지 4개를 모은 ' + S.name + '이로구나!' }, { who: '매뜨킹', text: '나는 괄호가 있는 혼합 계산 문제를 낸다!' }, { who: '매뜨킹', text: '괄호 → 곱셈·나눗셈 → 덧셈·뺄셈 순서를 잊지 마라!' }]);
    var i = await ask('매뜨킹', '도전하겠느냐?', ['도전!', '다음에 할게요']);
    if (i === 0) startBoss('final', null, 3);
  }

  // =============== HUD ===============
  function renderHUD() {
    if (!S) return;
    $('hud-name').textContent = S.name;
    var mx = C.maxHp(settings); if (S.hp > mx) S.hp = mx;
    $('hud-hp').style.width = Math.round(S.hp / mx * 100) + '%';
    $('hud-hptxt').textContent = MONS[S.mon].name + ' HP ' + S.hp + '/' + mx;
    $('hud-cp').textContent = '용기 포인트 ' + S.cp;
    var bd = $('hud-badges'); bd.innerHTML = '';
    C.OPS.forEach(function (op) { var d = document.createElement('div'); d.className = 'badge' + (S.fields[op].badge ? ' on' : ''); d.style.background = S.fields[op].badge ? BADGE_COLOR[op] : '#eee'; d.textContent = S.fields[op].badge ? C.SIGN[op] : ''; d.title = C.OP_NAME[op] + ' 뱃지'; bd.appendChild(d); });
    var m = curMap, txt = m ? m.name : '';
    if (m && m.kind === 'field') {
      var ch = tileAt(m, S.x, S.y), z = zoneOfTile(ch);
      txt = m.name + ' · ' + ['', '1단계 초급', '2단계 중급', '3단계 고급'][z] + '<br>몬스터 ' + Math.min(S.fields[m.op].wins, 3) + '/3' + (S.fields[m.op].wins >= 3 ? ' 체육관 도전 가능!' : '');
      void ch;
    }
    $('hud-mid').innerHTML = txt;
    $('sound-btn').textContent = settings.sound ? '🔊' : '🔇';
    drawInto($('hud-mon'), monsterRaster(MONS[S.mon]));
  }
  function toast(t) { var e = $('toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.tm); toast.tm = setTimeout(function () { e.classList.remove('on'); }, 1800); }

  // =============== 그리기 반복 ===============
  var lastT = 0;
  function frame(ts) {
    var dt = Math.min(50, ts - (lastT || ts)); lastT = ts;
    update(dt); render();
    requestAnimationFrame(frame);
  }
  function update(dt) {
    if (!S || !curMap) return;
    if (P.moving) { P.t += dt / MOVE_MS; if (P.t >= 1) finishStep(); }
    else if (input.dir && !busy()) tryMove(input.dir);
    if (curMap.kind === 'field' && !P.moving) { var z = zoneOfTile(tileAt(curMap, S.x, S.y)); if (z !== update.z || curMap.id !== update.m || S.fields[curMap.op].wins !== update.w) { update.z = z; update.m = curMap.id; update.w = S.fields[curMap.op].wins; renderHUD(); } }
  }
  function render() {
    if (!mctx || !S || !curMap) return;
    var m = curMap;
    if (staticFor !== m.id) { staticLayer = buildStatic(m); staticFor = m.id; }
    var ppx = S.x * TILE, ppy = S.y * TILE;
    if (P.moving) { var k = Math.min(1, P.t); ppx = (P.fx + (S.x - P.fx) * k) * TILE; ppy = (P.fy + (S.y - P.fy) * k) * TILE; }
    var mw = m.w * TILE, mh = m.h * TILE;
    var cx = mw <= VW ? -(VW - mw) / 2 : Math.max(0, Math.min(mw - VW, ppx + 20 - VW / 2));
    var cy = mh <= VH ? -(VH - mh) / 2 : Math.max(0, Math.min(mh - VH, ppy + 20 - VH / 2));
    cx = Math.round(cx); cy = Math.round(cy);
    mctx.fillStyle = '#000'; mctx.fillRect(0, 0, VW, VH);
    mctx.drawImage(staticLayer, -cx, -cy);
    var ents = (m.npcs || []).map(function (n) { return { y: n.y * TILE, draw: function () { drawNpc(n, n.x * TILE - cx, n.y * TILE - cy); } }; });
    ents.push({ y: ppy, draw: function () { drawPlayer(ppx - cx, ppy - cy); } });
    ents.sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { e.draw(); });
    var ch = tileAt(m, S.x, S.y);
    if (!P.moving && (ch === ',' || ch === ';' || ch === ':')) { var g = GRASS[ch]; mctx.fillStyle = g[0]; mctx.fillRect(ppx - cx + 4, ppy - cy + 28, 32, 12); mctx.fillStyle = g[1]; mctx.fillRect(ppx - cx + 8, ppy - cy + 30, 3, 10); mctx.fillRect(ppx - cx + 22, ppy - cy + 30, 3, 10); }
  }
  function drawNpc(n, x, y) {
    var key = n.monster ? 'mon-king' : 'npc-' + n.name + '-' + (n.dir || 'down');
    var cv = spriteCanvas(key, function () { return n.monster ? monsterRaster(n.monster) : personRaster(Object.assign({}, n.look, { dir: n.dir || 'down' })); });
    if (n.monster) mctx.drawImage(cv, x - 20, y - 40, 80, 80); else mctx.drawImage(cv, x, y - 6, 40, 44);
  }
  function drawPlayer(x, y) {
    var bob = P.moving && (Math.floor(P.t * 4) % 2) ? 2 : 0;
    var cv = spriteCanvas('player-' + S.dir, function () { return personRaster(Object.assign({}, PLAYER, { dir: S.dir })); });
    mctx.drawImage(cv, x, y - 6 - bob, 40, 44);
  }

  // =============== 장면 전환 ===============
  function showScene(id) { qa('.scene').forEach(function (s) { s.classList.toggle('show', s.id === id); }); var inGame = !id; $('hud').classList.toggle('hidden', !inGame); $('pad').classList.toggle('hidden', !inGame); }
  function showModal(id, on) { $(id).classList.toggle('show', on); }
  MM.scene = function () { var s = qa('.scene.show')[0]; return s ? s.id : 'map'; };

  function renderTitle() {
    var tm = $('title-mons'); tm.innerHTML = '';
    C.MON_IDS.forEach(function (id) { var c = document.createElement('canvas'); c.width = 32; c.height = 32; drawInto(c, monsterRaster(MONS[id])); tm.appendChild(c); });
    $('btn-resume').classList.toggle('hidden', !S);
    showScene('title'); Sound.music('town');
  }
  var pickSel = null;
  function renderPick() {
    var row = $('pick-row'); row.innerHTML = ''; pickSel = null; $('pick-ok').disabled = true;
    C.MON_IDS.forEach(function (id) {
      var d = MONS[id], b = document.createElement('button'); b.className = 'pick-card'; b.setAttribute('data-mon', id);
      var c = document.createElement('canvas'); c.width = 32; c.height = 32; drawInto(c, monsterRaster(d)); b.appendChild(c);
      var n = document.createElement('b'); n.textContent = d.name; b.appendChild(n);
      var t = document.createElement('span'); t.textContent = d.type + ' 몬스터'; b.appendChild(t);
      b.addEventListener('click', function () { Sound.sfx('select'); pickSel = id; qa('.pick-card').forEach(function (x) { x.classList.toggle('sel', x === b); }); $('pick-ok').disabled = false; });
      row.appendChild(b);
    });
    showScene('pick');
  }
  async function startGame(name, mon) {
    S = C.newState(name, mon); S.hp = C.maxHp(settings);
    showScene(null); goto('town', 11, 10, 'down');
    log('game:start');
    await say([{ who: '매뜨 박사', text: '반가워, ' + name + '! 나는 매뜨 박사란다.' }, { who: '매뜨 박사', text: MONS[mon].name + josa(MONS[mon].name, '과', '와') + ' 함께 수학 몬스터들을 만나 보렴!' }, { who: '매뜨 박사', text: '마을의 출입구 4곳으로 나가면 덧셈, 뺄셈, 곱셈, 나눗셈 필드가 있어.' }, { who: '매뜨 박사', text: '움직일 때는 화살표 버튼, 말을 걸 때는 A 버튼을 눌러!' }]);
  }
  function resumeGame() { showScene(null); goto(S.map, S.x, S.y, S.dir); }

  // 교사용 설정
  var SET_DEF = [
    { k: 'fixLevel', label: '문제 난이도', opts: [['구역에 따라', 0], ['1단계 고정', 1], ['2단계 고정', 2], ['3단계 고정', 3]] },
    { k: 'timer', label: '시간제한 (30초)', opts: [['끔', 0], ['켬', 1]] },
    { k: 'hintAlways', label: '힌트 항상 보이기', opts: [['끔', 0], ['켬', 1]] },
    { k: 'hpBoost', label: '내 몬스터 HP', opts: [['기본 25', 0], ['높게 45', 1], ['아주 높게 60', 2]] },
    { k: 'sound', label: '소리', opts: [['끔', 0], ['켬', 1]] },
    { k: 'reduceMotion', label: '움직임 줄이기', opts: [['끔', 0], ['켬', 1]] }
  ];
  function renderTeacher() {
    var box = $('set-rows'); box.innerHTML = '';
    SET_DEF.forEach(function (d) {
      var row = document.createElement('div'); row.className = 'set-row';
      var l = document.createElement('span'); l.textContent = d.label; row.appendChild(l);
      var seg = document.createElement('div'); seg.className = 'seg';
      d.opts.forEach(function (o) {
        var b = document.createElement('button'); b.className = 'btn' + (Number(settings[d.k]) === o[1] ? ' on' : ''); b.textContent = o[0]; b.setAttribute('data-set', d.k + ':' + o[1]);
        b.addEventListener('click', function () { settings[d.k] = o[1]; applySettings(); renderTeacher(); Sound.s