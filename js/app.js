// 宝宝学一学 - 应用逻辑
"use strict";

const app = document.getElementById("app");

// ---------------- 语音 ----------------
// 某些内置浏览器禁用 localStorage，做安全兜底
let muted = false;
try { muted = localStorage.getItem("bbx_muted") === "1"; } catch (e) {}
let voicesReady = false;

function pickVoice(langPrefix) {
  const voices = speechSynthesis.getVoices();
  const sameLang = voices.filter(v => v.lang.replace("_", "-").toLowerCase().startsWith(langPrefix));
  // 优先"增强/高级"质量语音（如 iOS 下载的增强版），再退到本地语音
  return (
    sameLang.find(v => /enhanced|premium|增强|高级/i.test(v.name)) ||
    sameLang.find(v => v.localService) ||
    sameLang[0] ||
    null
  );
}

function loadVoices() {
  speechSynthesis.getVoices();
  if (speechSynthesis.getVoices().length > 0) voicesReady = true;
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

// ---------------- 播放：预生成音频优先，系统语音兜底 ----------------
let currentAudio = null;

function stopVoice() {
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}

function speak(text, lang = "zh-CN", rate = 0.85) {
  if (muted) return;
  if (!("speechSynthesis" in window)) return;
  try {
    stopVoice();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = 1.1; // 稍微高一点，更亲切
    const v = pickVoice(lang.slice(0, 2).toLowerCase());
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch (e) { /* 语音失败不影响使用 */ }
}

// playKey(key, 兜底文本, 语言)：有打包音频就播音频，否则用系统语音
function playKey(key, fallbackText, lang = "zh-CN") {
  if (muted) return;
  const src = typeof AUDIO_FILES !== "undefined" ? AUDIO_FILES[key] : null;
  if (src) {
    stopVoice();
    const a = new Audio(src);
    currentAudio = a;
    a.play().catch(() => speak(fallbackText, lang));
    return;
  }
  speak(fallbackText, lang);
}

// 播放一段打包音频并等它播完（用于逐个数数）
function playAudioWait(key) {
  return new Promise(resolve => {
    if (muted) { setTimeout(resolve, 320); return; }
    const src = typeof AUDIO_FILES !== "undefined" ? AUDIO_FILES[key] : null;
    if (!src) { resolve(); return; }
    stopVoice();
    const a = new Audio(src);
    currentAudio = a;
    a.onended = resolve;
    a.onerror = resolve;
    a.play().catch(resolve);
  });
}
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------------- 音效（WebAudio 合成，无需音频文件） ----------------
let actx = null;
function ensureCtx() {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === "suspended") actx.resume();
  } catch (e) { /* 无音效不影响使用 */ }
}
function tone(f1, f2, dur, type = "sine", vol = 0.12) {
  if (muted) return;
  try {
    ensureCtx();
    if (!actx) return;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, actx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, actx.currentTime + dur);
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch (e) { /* 忽略 */ }
}

// ---------------- 工具 ----------------
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Endless 风格大眼睛（字母/数字专用，汉字不用）
function eyesHTML() {
  return `<span class="eyes"><i class="eye"><i class="pupil"></i></i><i class="eye"><i class="pupil"></i></i></span>`;
}
function lookAt(tile, px, py) {
  tile.querySelectorAll(".pupil").forEach(p => {
    const r = tile.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ang = Math.atan2(py - cy, px - cx);
    p.style.transform = `translate(${(Math.cos(ang) * 3.5).toFixed(1)}px, ${(Math.sin(ang) * 3.5).toFixed(1)}px)`;
  });
}
function resetEyes(tile) {
  tile.querySelectorAll(".pupil").forEach(p => p.style.transform = "");
}

const PRAISES = ["真棒！", "答对啦！", "好厉害！", "太棒了！"];
function celebrate() {
  const pi = Math.floor(Math.random() * PRAISES.length);
  const praise = el("div", "praise", PRAISES[pi]);
  document.body.appendChild(praise);
  setTimeout(() => praise.remove(), 1300);
  const emojis = ["⭐", "🌟", "🎉", "✨", "🎈", "❤️"];
  for (let i = 0; i < 14; i++) {
    const c = el("div", "confetti", emojis[Math.floor(Math.random() * emojis.length)]);
    c.style.left = Math.random() * 100 + "vw";
    c.style.animationDuration = 1.6 + Math.random() * 1.4 + "s";
    c.style.animationDelay = Math.random() * 0.4 + "s";
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3600);
  }
  tone(660, 990, 0.12, "sine", 0.1);
  setTimeout(() => tone(880, 1320, 0.18, "sine", 0.1), 90);
  playKey("praise" + pi, PRAISES[pi]);
}

// ---------------- 界面框架 ----------------
function topbar(title, onBack, showMute, extra) {
  const bar = el("div", "topbar");
  // 回主页用🏠，返回上一级用⬅️
  const back = el("button", "btn-back", onBack === renderHome ? "🏠" : "⬅️");
  back.onclick = onBack;
  bar.appendChild(back);
  bar.appendChild(el("h1", "", title));
  const sp = el("div", "spacer");
  bar.appendChild(sp);
  if (extra) {
    (Array.isArray(extra) ? extra : [extra]).forEach(x => {
      const b = el("button", "btn-mute", x.icon);
      b.title = x.name;
      b.onclick = x.cb;
      bar.appendChild(b);
    });
  }
  if (showMute) {
    const mute = el("button", "btn-mute", muted ? "🔇" : "🔊");
    mute.onclick = () => {
      muted = !muted;
      try { localStorage.setItem("bbx_muted", muted ? "1" : "0"); } catch (e) {}
      mute.textContent = muted ? "🔇" : "🔊";
      if (muted) stopVoice();
    };
    bar.appendChild(mute);
  }
  return bar;
}

// ---------------- 主页 ----------------
function renderHome() {
  app.className = "";
  app.innerHTML = "";
  const home = el("div", "home");
  decorate(home); // 封面也用场景背景
  home.appendChild(el("div", "home-title", "🌈 宝宝学一学"));
  home.appendChild(el("div", "home-sub", "给最棒的小宝贝 · 点一点，学一学"));

  const grid = el("div", "home-grid");
  const cats = [
    { key: "letters", name: "字母 ABC", cls: "cat-letters", icon: "🔤" },
    { key: "numbers", name: "数字 123", cls: "cat-numbers", icon: "🔢" },
    { key: "chars",   name: "汉字 ★ 学汉字", cls: "cat-chars", icon: "字" }
  ];
  cats.forEach(c => {
    const btn = el("button", "cat-card " + c.cls, `<span class="big">${c.icon}</span><span>${c.name}</span>`);
    btn.onclick = () => renderModes(c.key, c.name);
    grid.appendChild(btn);
  });
  home.appendChild(grid);
  app.appendChild(home);
}

// ---------------- 模式选择 ----------------
function renderModes(catKey, catName) {
  app.className = "cat-bg-" + catKey; // 二级菜单同款场景背景
  app.innerHTML = "";
  app.appendChild(topbar(catName, renderHome, true));
  const modes = el("div", "modes");
  decorate(modes);
  const learn = el("button", "mode-btn mode-learn", `<span class="big">📖</span> 学一学`);
  learn.onclick = () => renderLearn(catKey, catName);
  const play = el("button", "mode-btn mode-play", `<span class="big">🎮</span> 玩一玩`);
  play.onclick = () => renderQuiz(catKey, catName);
  modes.appendChild(learn);
  modes.appendChild(play);
  app.appendChild(modes);
  playKey("m-" + catKey, catName + "，想学一学，还是玩一玩？");
}

// ---------------- 学一学 ----------------
let playMode = {};   // 字母/数字的学一学视图："play"=满屏拖动（默认） | "grid"=排排队
let learnList = [], learnIdx = 0;

function renderLearn(catKey, catName) {
  if (catKey !== "chars" && playMode[catKey] !== "grid") renderPlayground(catKey, catName);
  else renderLearnGrid(catKey, catName);
}

// 满屏拖动玩耍场（Endless 风格，仅字母/数字）
function renderPlayground(catKey, catName) {
  app.className = "cat-bg-" + catKey; // 场景背景
  app.innerHTML = "";
  const toggle = {
    icon: "🧹", name: "排排队",
    cb: () => { playMode[catKey] = "grid"; renderLearnGrid(catKey, catName); }
  };
  const pg = el("div", "playground");
  const scatter = {
    icon: "🔄", name: "变一变",
    cb: () => {
      pg.classList.add("glide");
      pg.querySelectorAll(".ptile").forEach(t => {
        t.style.left = Math.random() * (pg.clientWidth - t.offsetWidth) + "px";
        t.style.top = Math.random() * (pg.clientHeight - t.offsetHeight) + "px";
      });
      tone(600, 900, 0.15, "sine", 0.08);
      setTimeout(() => pg.classList.remove("glide"), 700);
    }
  };
  app.appendChild(topbar(catName + " · 学一学", () => renderModes(catKey, catName), true, [toggle, scatter]));
  app.appendChild(pg);
  decorate(app); // 太阳、云朵、草地
  pg.appendChild(el("div", "pg-hint", "👆 拖一拖 · 点一点"));

  const list = DATA[catKey];
  learnList = list;
  const W = pg.clientWidth, H = pg.clientHeight;
  const n = list.length;
  const cols = Math.max(2, Math.floor(W / 118));
  const rows = Math.ceil(n / cols);
  const cellW = W / cols, cellH = H / rows;
  const size = clamp(Math.min(cellW, cellH) * 0.86, 60, 104);

  list.forEach((item, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const jx = (Math.random() - 0.5) * cellW * 0.3;
    const jy = (Math.random() - 0.5) * cellH * 0.3;
    const t = el("button", "ptile " + catKey);
    t.style.width = t.style.height = size + "px";
    t.style.left = clamp(col * cellW + cellW / 2 - size / 2 + jx, 0, W - size) + "px";
    t.style.top = clamp(row * cellH + cellH / 2 - size / 2 + jy, 0, H - size) + "px";
    t.style.animationDelay = (-Math.random() * 3).toFixed(2) + "s";
    t.style.animationDuration = (2.6 + Math.random() * 1.6).toFixed(2) + "s";

    let g, sub;
    if (catKey === "letters") { g = item.g; sub = item.w; }
    else { g = item.n; sub = item.zh; }
    t.innerHTML = eyesHTML() +
      `<span class="g" style="font-size:${Math.round(size * 0.4)}px">${g}</span>` +
      `<span class="sub">${sub}</span>`;
    t.querySelectorAll(".eye").forEach(e2 => e2.style.animationDelay = (-Math.random() * 4).toFixed(2) + "s");
    pg.appendChild(t);
    makeDraggable(t, catKey, i);
  });
}

// 拖动 + 点按（点按=打开大卡片学习）
function makeDraggable(t, catKey, idx) {
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
  t.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { t.setPointerCapture(e.pointerId); } catch (err) {}
    t.classList.add("dragging");
    t.classList.remove("wobble");
    sx = e.clientX; sy = e.clientY;
    ox = t.offsetLeft; oy = t.offsetTop;
    moved = false;
    tone(520, 760, 0.1, "sine", 0.1); // 拿起来的"啵"声
  });
  t.addEventListener("pointermove", e => {
    if (!t.classList.contains("dragging")) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
    if (moved) {
      const P = t.parentElement.getBoundingClientRect();
      t.style.left = clamp(ox + dx, 0, P.width - t.offsetWidth) + "px";
      t.style.top = clamp(oy + dy, 0, P.height - t.offsetHeight) + "px";
    }
    lookAt(t, e.clientX, e.clientY); // 眼睛跟着手指看
  });
  const up = () => {
    if (!t.classList.contains("dragging")) return;
    t.classList.remove("dragging");
    resetEyes(t);
    if (!moved) {
      showBigCard(catKey, idx);
    } else {
      tone(650, 220, 0.2, "triangle", 0.1); // 放下的"咚"声
      t.classList.add("wobble");
      setTimeout(() => t.classList.remove("wobble"), 520);
    }
  };
  t.addEventListener("pointerup", up);
  t.addEventListener("pointercancel", up);
}

// 排排队网格视图（汉字始终用这个）
function renderLearnGrid(catKey, catName) {
  app.className = "cat-bg-" + catKey; // 场景背景
  app.innerHTML = "";
  const isLetterNum = catKey !== "chars";
  const toggle = isLetterNum ? {
    icon: "🎲", name: "满屏玩",
    cb: () => { playMode[catKey] = "play"; renderPlayground(catKey, catName); }
  } : null;
  app.appendChild(topbar(catName + " · 学一学", () => renderModes(catKey, catName), true, toggle));
  const wrap = el("div", "grid-wrap");
  const grid = el("div", "card-grid");
  decorate(app); // 太阳、云朵、草地
  learnList = DATA[catKey];
  learnList.forEach((item, i) => {
    let g, sub;
    if (catKey === "letters") { g = item.g; sub = item.w; }
    else if (catKey === "numbers") { g = item.n; sub = item.zh; }
    else { g = item.g; sub = item.w; }
    const tile = el("button", "tile " + catKey);
    tile.style.setProperty("--tilt", (Math.random() * 6 - 3).toFixed(1) + "deg");
    tile.innerHTML = (isLetterNum ? eyesHTML() : "") +
      `<span class="g">${g}</span><span class="sub">${sub}</span>`;
    if (isLetterNum) tile.querySelectorAll(".eye").forEach(e2 => e2.style.animationDelay = (-Math.random() * 4).toFixed(2) + "s");
    tile.onclick = () => showBigCard(catKey, i);
    grid.appendChild(tile);
  });
  wrap.appendChild(grid);
  app.appendChild(wrap);
}

// 大卡片入口：字母/数字进"学习舞台"，汉字保持原卡片
function showBigCard(catKey, idx) {
  learnIdx = idx;
  const item = learnList[idx];
  app.querySelector(".overlay")?.remove();
  const ov = el("div", "overlay");
  if (catKey === "letters") { ov.classList.add("stage", "stage-letters"); buildLetterStage(ov, item, idx); }
  else if (catKey === "numbers") { ov.classList.add("stage", "stage-numbers"); buildNumberStage(ov, item, idx); }
  else buildCharCard(ov, item, idx);
  app.appendChild(ov);
}

// 舞台布景：太阳、云朵、草地、泡泡
function decorate(ov) {
  ov.appendChild(el("div", "deco sun"));
  for (let i = 0; i < 3; i++) ov.appendChild(el("div", "deco cloud c" + i));
  ov.appendChild(el("div", "deco hill h1"));
  ov.appendChild(el("div", "deco hill h2"));
  for (let i = 0; i < 6; i++) {
    const b = el("div", "deco bubble");
    b.style.left = (6 + i * 16 + Math.random() * 6) + "%";
    b.style.animationDelay = (-Math.random() * 9).toFixed(1) + "s";
    b.style.animationDuration = (7 + Math.random() * 6).toFixed(1) + "s";
    ov.appendChild(b);
  }
}

// 舞台底部按钮行（上一张/关闭/下一张 + 附加按钮）
function stageNav(ov, catKey, idx, extra) {
  const row = el("div", "stage-actions");
  (extra || []).forEach(({ icon, name, cb }) => {
    const b = el("button", "nav-btn", icon);
    b.title = name;
    b.onclick = e => { e.stopPropagation(); cb(); };
    row.appendChild(b);
  });
  const prev = el("button", "nav-btn", "⬅️");
  prev.onclick = e => { e.stopPropagation(); showBigCard(catKey, (idx - 1 + learnList.length) % learnList.length); };
  const close = el("button", "nav-btn", "✖️");
  close.onclick = e => { e.stopPropagation(); ov.remove(); };
  const next = el("button", "nav-btn", "➡️");
  next.onclick = e => { e.stopPropagation(); showBigCard(catKey, (idx + 1) % learnList.length); };
  row.appendChild(prev); row.appendChild(close); row.appendChild(next);
  ov.appendChild(row);
}

// 舞台里的大字：可随意拖动，点一下说话
function makeStageDraggable(g, onTap) {
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false;
  g.addEventListener("pointerdown", e => {
    e.preventDefault();
    try { g.setPointerCapture(e.pointerId); } catch (err) {}
    const r = g.getBoundingClientRect(); // 转为自由定位
    g.style.left = r.left + "px";
    g.style.top = r.top + "px";
    g.style.transform = "none";
    g.classList.add("dragging");
    sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; moved = false;
    tone(520, 760, 0.1, "sine", 0.1);
  });
  g.addEventListener("pointermove", e => {
    if (!g.classList.contains("dragging")) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 8) moved = true;
    if (moved) {
      g.style.left = clamp(ox + dx, 6, innerWidth - g.offsetWidth - 6) + "px";
      g.style.top = clamp(oy + dy, 6, innerHeight - g.offsetHeight - 6) + "px";
    }
    lookAt(g, e.clientX, e.clientY);
  });
  const up = () => {
    if (!g.classList.contains("dragging")) return;
    g.classList.remove("dragging");
    resetEyes(g);
    if (!moved) onTap();
    else {
      tone(650, 220, 0.2, "triangle", 0.1);
      g.classList.add("wobble");
      setTimeout(() => g.classList.remove("wobble"), 520);
    }
  };
  g.addEventListener("pointerup", up);
  g.addEventListener("pointercancel", up);
}

// 字母学习舞台
function buildLetterStage(ov, item, idx) {
  decorate(ov);

  const say = () => playKey("L" + idx, `${item.g}. ${item.g} is for ${item.w}.`, "en-US");
  const sayWord = () => playKey("wd" + idx, item.w, "en-US");

  const glyph = el("div", "glyph stage-glyph");
  glyph.innerHTML = eyesHTML() + `<span class="glyph-text">${item.g}${item.g.toLowerCase()}</span>`;
  glyph.querySelectorAll(".eye").forEach(e2 => e2.style.animationDelay = (-Math.random() * 4).toFixed(2) + "s");
  ov.appendChild(glyph);
  makeStageDraggable(glyph, say);
  say();

  // 单词区：逐个点字母（发音+点亮），全部点亮后合并成单词，点单词读整词
  const wordRow = el("div", "word-row");
  wordRow.appendChild(el("span", "em", item.c));
  const letterIndex = {};
  DATA.letters.forEach((l, i) => letterIndex[l.g] = i);
  const tiles = item.w.split("").filter(ch => ch !== " ");
  const lit = new Set();
  let combined = false;

  const tw = Math.max(30, Math.min(52, Math.floor((innerWidth * 0.82 - 64 - (tiles.length - 1) * 6) / tiles.length)));
  tiles.forEach((ch, ti) => {
    const t = el("button", "word-tile", ch);
    t.style.width = tw + "px";
    t.style.height = Math.round(tw * 1.12) + "px";
    t.style.fontSize = Math.round(tw * 0.56) + "px";
    const up = ch.toUpperCase();
    t.onclick = () => {
      if (combined) { sayWord(); popEl(wordRow); return; }
      playKey("ls" + letterIndex[up], up, "en-US");
      t.classList.remove("pop");
      void t.offsetWidth;
      t.classList.add("pop");
      if (!lit.has(ti)) {
        lit.add(ti);
        t.classList.add("lit");
        if (lit.size === tiles.length) setTimeout(combine, 500);
      }
    };
    wordRow.appendChild(t);
  });
  ov.appendChild(wordRow);

  function combine() {
    combined = true;
    wordRow.classList.add("combined");
    tone(523, 659, 0.12, "sine", 0.1);
    setTimeout(() => tone(659, 880, 0.2, "sine", 0.1), 130);
    setTimeout(sayWord, 400);
  }
  function reset() {
    combined = false;
    lit.clear();
    wordRow.classList.remove("combined");
    wordRow.querySelectorAll(".word-tile").forEach(t => t.classList.remove("lit"));
  }
  function popEl(e2) { e2.classList.remove("pop"); void e2.offsetWidth; e2.classList.add("pop"); }

  // 中文注解：点一下听中文
  const zhLabel = el("button", "word-zh", item.zh);
  zhLabel.onclick = e => {
    e.stopPropagation();
    playKey("zw" + idx, item.zh);
    popEl(zhLabel);
  };
  ov.appendChild(zhLabel);

  stageNav(ov, "letters", idx, [
    { icon: "🔊", name: "再听一次", cb: say },
    { icon: "↺", name: "重新拼", cb: reset }
  ]);
}

// 数字学习舞台
function buildNumberStage(ov, item, idx) {
  decorate(ov);

  const say = () => playKey("n" + item.n, `这是${item.zh}。我们一起数：${item.zh}！`);
  ov.appendChild(el("div", "stage-zh", item.zh));

  const glyph = el("div", "glyph stage-glyph");
  glyph.innerHTML = eyesHTML() + `<span class="glyph-text">${item.n}</span>`;
  glyph.querySelectorAll(".eye").forEach(e2 => e2.style.animationDelay = (-Math.random() * 4).toFixed(2) + "s");
  ov.appendChild(glyph);
  makeStageDraggable(glyph, say);

  // 苹果区：5 个一组，点一个数一个；数数时苹果和数字放大
  const zone = el("div", "apple-zone" + (item.n > 10 ? " small" : ""));
  const big = el("div", "count-big"); // 数到几的大数字
  zone.appendChild(big);
  const rows = [];
  for (let i = 0; i < item.n; i += 5) rows.push(Math.min(5, item.n - i));
  let order = 0;
  rows.forEach(c => {
    const row = el("div", "dots-row");
    for (let k = 0; k < c; k++) {
      const ap = el("button", "ap", "🍎");
      order++;
      const cnt = order;
      ap.onclick = () => {
        tone(500 + cnt * 30, 750 + cnt * 30, 0.09, "sine", 0.09);
        bump(ap, cnt);
        playKey("cnt" + cnt, zhNumName(cnt));
      };
      row.appendChild(ap);
    }
    zone.appendChild(row);
  });
  ov.appendChild(zone);

  // 数数放大：当前苹果变大，上方大数字蹦一下
  function bump(apEl, cnt) {
    big.textContent = zhNumName(cnt);
    big.classList.remove("bump");
    void big.offsetWidth;
    big.classList.add("bump");
    if (apEl) {
      apEl.classList.add("hot");
      setTimeout(() => apEl.classList.remove("hot"), 750);
    }
  }

  // 开场：苹果依次蹦出来
  let counting = false;
  async function countUp() {
    if (counting) return;
    counting = true;
    const apples = [...zone.querySelectorAll(".ap")];
    apples.forEach(a => a.classList.remove("in"));
    big.textContent = "";
    await wait(250);
    for (let i = 0; i < apples.length; i++) {
      if (!ov.isConnected) return; // 被关掉了
      apples[i].classList.add("in");
      bump(apples[i], i + 1);
      await playAudioWait("cnt" + (i + 1));
      await wait(100);
    }
    counting = false;
  }

  // 开场先全部亮相
  zone.querySelectorAll(".ap").forEach((a, i) => setTimeout(() => a.classList.add("in"), 150 + i * 60));

  stageNav(ov, "numbers", idx, [
    { icon: "🔢", name: "数一数", cb: countUp },
    { icon: "🔊", name: "再听一次", cb: say }
  ]);
  say();
}

// 汉字大卡片：同样用场景背景，内容保持原样
function buildCharCard(ov, item, idx) {
  ov.classList.add("stage", "stage-chars");
  decorate(ov);

  const card = el("div", "big-card");
  card.innerHTML = `
    <div class="glyph"><span class="glyph-text">${item.g}</span></div>
    <div class="pinyin">${item.p}</div>
    <div class="word">${item.w}</div>
    <div class="hint">点一点卡片再听一次 ▶</div>`;
  const say = () => playKey("c" + idx, `${item.g}，${item.p}。${item.w}的${item.g}。`);
  card.onclick = say;
  say();
  ov.appendChild(card);

  const nav = el("div", "nav-row");
  const prev = el("button", "nav-btn", "⬅️");
  prev.onclick = e => { e.stopPropagation(); showBigCard("chars", (idx - 1 + learnList.length) % learnList.length); };
  const next = el("button", "nav-btn", "➡️");
  next.onclick = e => { e.stopPropagation(); showBigCard("chars", (idx + 1) % learnList.length); };
  const close = el("button", "nav-btn", "✖️");
  close.onclick = e => { e.stopPropagation(); ov.remove(); };
  nav.appendChild(prev); nav.appendChild(close); nav.appendChild(next);
  ov.appendChild(nav);
}

// 数字中文名（与语音生成脚本一致）
function zhNumName(n) {
  const lows = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (n <= 10) return lows[n];
  if (n < 20) return "十" + lows[n - 10];
  return "二十";
}

// ---------------- 玩一玩：找一找问答 ----------------
let quizScore = 0;
function renderQuiz(catKey, catName) {
  quizScore = 0;
  app.className = "cat-bg-" + catKey; // 同款场景背景
  app.innerHTML = "";
  app.appendChild(topbar(catName + " · 玩一玩", () => renderModes(catKey, catName), true));

  const quiz = el("div", "quiz");
  decorate(quiz); // 太阳、云朵、草地
  const qEl = el("div", "quiz-question");
  const optsEl = el("div", "quiz-options");
  const scoreEl = el("div", "quiz-score", "⭐ 0");
  quiz.appendChild(qEl);
  quiz.appendChild(optsEl);
  quiz.appendChild(scoreEl);
  app.appendChild(quiz);

  const isLetterNum = catKey !== "chars";

  function nextRound() {
    optsEl.innerHTML = "";
    const list = DATA[catKey];
    const target = list[Math.floor(Math.random() * list.length)];
    const others = shuffle(list.filter(x => x !== target)).slice(0, 2);
    const opts = shuffle([target, ...others]);

    // 题目文案
    if (catKey === "letters") {
      const li = list.indexOf(target);
      qEl.innerHTML = `找一找：字母 <span class="target">${target.g}</span> 在哪里？`;
      playKey("ql" + li, `找一找，字母 ${target.g}，在哪里？`);
    } else if (catKey === "numbers") {
      qEl.innerHTML = `数一数，<span class="target">${target.zh}</span> 在哪里？`;
      playKey("qn" + target.n, `找一找，数字${target.zh}，在哪里？`);
    } else {
      const ci = list.indexOf(target);
      qEl.innerHTML = `找一找：<span class="target">${target.g}</span> 在哪里？`;
      playKey("qc" + ci, `找一找，${target.w}的${target.g}，在哪里？`);
    }

    opts.forEach(opt => {
      let label;
      if (catKey === "letters") label = opt.g;
      else if (catKey === "numbers") label = opt.n;
      else label = opt.g;
      const btn = el("button", "quiz-opt");
      btn.innerHTML = (isLetterNum ? eyesHTML() : "") + `<span class="lbl">${label}</span>`;
      if (isLetterNum) btn.querySelectorAll(".eye").forEach(e2 => e2.style.animationDelay = (-Math.random() * 4).toFixed(2) + "s");
      btn.onclick = () => {
        if (opt === target) {
          btn.classList.add("right");
          quizScore++;
          scoreEl.textContent = "⭐ " + quizScore;
          celebrate();
          setTimeout(nextRound, 1600);
        } else {
          btn.classList.add("wrong");
          playKey("wrong", "再想一想哦。");
        }
      };
      optsEl.appendChild(btn);
    });
  }
  nextRound();
}

// ---------------- 启动 ----------------
renderHome();

// 注册 Service Worker（离线使用）
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}
