// Health Note v3 — UI. State lives in store.js (IndexedDB); math in calc.js.
import { num, r1, e1rm, isWorking, entryStats, prScores, recommend, plates, warmups, bmr, factor, foodTotals, csv, daysBetween } from "./calc.js";
import { MUSCLES, PARTS, MUSCLE_PART, PART_MUSCLE, EQUIP, EQUIP_INC, TYPES } from "./exercises.js";
import * as store from "./store.js";

const APP_VERSION = "3.0.1";
const { MEALS, uid, norm, getEx, allEx, partOfEx, normFoodEntry, normMyFood, normDay } = store;
const ACTIVITY = [
  { v: 1.2, label: "거의 안 움직임 (×1.2)" }, { v: 1.375, label: "주 1–3회 운동 (×1.375)" },
  { v: 1.55, label: "주 3–5회 운동 (×1.55)" }, { v: 1.725, label: "주 6–7회 운동 (×1.725)" }, { v: 1.9, label: "고강도·육체노동 (×1.9)" }
];
const GOALS = [{ v: -500, label: "감량 (−500 kcal)" }, { v: 0, label: "유지 (±0)" }, { v: 300, label: "증량 (+300 kcal)" }];
const BIG3 = [{ k: "스쿼트", id: "e:스쿼트" }, { k: "벤치프레스", id: "e:벤치프레스" }, { k: "데드리프트", id: "e:데드리프트" }];
const SET_CYCLE = { N: "W", W: "F", F: "D", D: "N" };

/* ---------- utils ---------- */
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (t) => `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
const todayStr = () => ymd(new Date());
const parseD = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const shiftDate = (s, k) => { const t = parseD(s); t.setDate(t.getDate() + k); return ymd(t); };
const fmtDate = (s) => { const t = parseD(s); return `${t.getMonth() + 1}/${t.getDate()} (${"일월화수목금토"[t.getDay()]})`; };
const shortDate = (s) => { const t = parseD(s); return `${t.getMonth() + 1}/${t.getDate()}`; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const fmtClock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`; };
const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
const fmtSec = (s) => { s = num(s); return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60 ? (s % 60) + "초" : ""}`.trim() : `${s}초`; };
const mealByClock = () => { const h = new Date().getHours() + new Date().getMinutes() / 60; return h < 10.5 ? "b" : h < 15.5 ? "l" : h < 21 ? "d" : "s"; };
let toastT;
function toast(msg, pr) { const t = $("#toast"); t.textContent = msg; t.className = "toast" + (pr ? " pr" : ""); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, pr ? 3200 : 2400); }

/* ---------- state ---------- */
const S = {
  data: store.defaultData(), ready: false, tab: "summary", date: todayStr(), meal: mealByClock(), calMonth: todayStr().slice(0, 7),
  histEx: null, bodyMetric: "w", confirm: null, editFood: null, efBasis: null, fBasis: "sv", saveRoutine: false, saveMeal: null,
  pendingImport: null, showPaste: false, pickerOpen: false, pickQ: "", pickPart: null, creating: false, editEx: null, plateFor: null, storageOk: true
};
const D = () => S.data;
let saveT;
function save() { clearTimeout(saveT); saveT = setTimeout(flush, 300); }
async function flush() { clearTimeout(saveT); const ok = await store.saveData(D()); if (!ok && S.storageOk) { S.storageOk = false; toast("저장하지 못했습니다. 저장 공간을 확인해 주세요."); } }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); updateWakeLock(); });
window.addEventListener("pagehide", () => { flush(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function getDay(date) { if (!D().days[date]) D().days[date] = normDay(date, null); return D().days[date]; }
const hasContent = (d) => !!d && (d.entries.length || d.foods.length || d.body.w || d.body.fat || d.body.mm);
const ex = (id) => getEx(D(), id);

/* ---------- domain ---------- */
function latestBody(key, upTo) {
  const ds = Object.keys(D().days).filter((d) => d <= upTo && D().days[d].body[key]).sort();
  return ds.length ? { v: num(D().days[ds[ds.length - 1]].body[key]), date: ds[ds.length - 1] } : null;
}
const bwAt = (date) => latestBody("w", date)?.v || num(D().settings.weight) || 70;
function targets(date) {
  const st = D().settings, lw = latestBody("w", date);
  const w = lw ? lw.v : num(st.weight), src = lw ? `${shortDate(lw.date)} 기록` : "설정값";
  const h = num(st.height), a = num(st.age);
  const b = bmr({ sex: st.sex, w, h, a }), tdee = b * num(st.activity), auto = tdee + num(st.goal);
  const kcal = st.kcalOverride ? num(st.kcalOverride) : auto, protein = w * num(st.gPerKg);
  const fatG = kcal * num(st.fatPct) / 100 / 9, carbG = Math.max(0, (kcal - protein * 4 - fatG * 9) / 4);
  return { w, src, h, a, bmr: b, tdee, auto, kcal, protein, fatG, carbG };
}
const hasValues = (s) => s.kg !== "" || s.reps !== "" || s.sec !== "" || s.km !== "";
function lastSession(exId, before) {
  const dates = Object.keys(D().days).filter((d) => d < before).sort().reverse();
  for (const d of dates) { const e = D().days[d].entries.find((x) => x.exId === exId && x.sets.some(hasValues)); if (e) return { date: d, sets: e.sets }; }
  return null;
}
let pbCache = new Map();
function priorBest(exId, date) {
  const key = exId + "|" + date; if (pbCache.has(key)) return pbCache.get(key);
  const type = ex(exId).type, best = {};
  for (const d in D().days) {
    if (d >= date) continue; const bw = bwAt(d);
    for (const e of D().days[d].entries) if (e.exId === exId) for (const s of e.sets) if (isWorking(s)) for (const [k, v] of Object.entries(prScores(s, type, bw))) best[k] = Math.max(best[k] || 0, v);
  }
  pbCache.set(key, best); return best;
}
const PR_LABEL = { e: "추정 1RM", w: "최고 중량", r: "최다 횟수", sec: "최장 시간", km: "최장 거리" };
// Per-set PR flags (only once history exists): list of keys that beat every earlier set.
function prFlags(entry, date) {
  const best = { ...priorBest(entry.exId, date) };
  if (!Object.keys(best).length) return entry.sets.map(() => null);
  const type = ex(entry.exId).type, bw = bwAt(date);
  return entry.sets.map((s) => {
    if (!isWorking(s)) return null;
    const hit = [];
    for (const [k, v] of Object.entries(prScores(s, type, bw))) { if (v > (best[k] || 0) + 1e-9 && best[k] !== undefined) hit.push(k); best[k] = Math.max(best[k] || 0, v); }
    return hit.length ? hit : null;
  });
}
function dayStats(day) {
  let sets = 0, done = 0, vol = 0, prs = 0, lastAt = 0; const bw = bwAt(day.date);
  for (const e of day.entries) {
    const st = entryStats(e, ex(e.exId).type, bw); sets += st.total; done += st.done; vol += st.vol;
    prs += prFlags(e, day.date).filter(Boolean).length;
    for (const s of e.sets) if (s.at) lastAt = Math.max(lastAt, s.at);
  }
  let dur = 0;
  if (day.session) { const end = day.session.end || (day.date === todayStr() ? Date.now() : lastAt); dur = Math.max(0, end - day.session.start); }
  return { ex: day.entries.length, sets, done, vol, prs, dur };
}
const sessionActive = (day) => !!(day && day.session && !day.session.end && day.date === todayStr());
const blankSet = (t = "N") => ({ t, kg: "", reps: "", sec: "", km: "", rpe: "", done: false, at: null });
const fromTpl = (s) => ({ ...blankSet(s.t || "N"), kg: s.kg ?? "", reps: s.reps ?? "", sec: s.sec ?? "", km: s.km ?? "" });
function entrySetsFor(exId, date, tpl) {
  const last = lastSession(exId, date), e = ex(exId);
  const rec = D().settings.prefillRec ? recommend(last, e, date) : null;
  if (rec) return { sets: rec.sets.map(fromTpl), from: "rec", last };
  if (last) return { sets: last.sets.map(fromTpl), from: "last", last };
  if (tpl && tpl.length) return { sets: tpl.map(fromTpl), from: "tpl" };
  return { sets: [blankSet()], from: "new" };
}
function addEntry(day, exId, tpl) {
  const r = entrySetsFor(exId, day.date, tpl);
  day.entries.push({ id: uid(), exId, group: null, note: "", sets: r.sets });
  return r;
}
function recentExIds(limit = 12) {
  const seen = new Map();
  for (const d of Object.keys(D().days).sort().reverse()) for (const e of D().days[d].entries) if (!seen.has(e.exId)) seen.set(e.exId, d);
  return [...seen.keys()].slice(0, limit);
}
function usedExIds() { const s = new Set(); for (const d of Object.values(D().days)) for (const e of d.entries) s.add(e.exId); for (const r of D().routines) for (const it of r.items) s.add(it.exId); return s; }
function groupLabels(day) {
  const count = {}, out = {};
  for (const e of day.entries) if (e.group) { count[e.group] = (count[e.group] || 0) + 1; out[e.id] = e.group + count[e.group]; }
  for (const e of day.entries) if (e.group && count[e.group] < 2) { e.group = null; delete out[e.id]; }
  return out;
}

/* ---------- wake lock & clock ---------- */
let wakeLock = null;
async function updateWakeLock() {
  const want = D().settings.wakeLock && sessionActive(D().days[todayStr()]) && document.visibilityState === "visible";
  try {
    if (want && !wakeLock && "wakeLock" in navigator) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!want && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { wakeLock = null; }
}
setInterval(() => { const clk = document.getElementById("sessClock"); const day = D().days[S.date]; if (clk && day && day.session) clk.textContent = fmtClock(dayStats(day).dur); }, 1000);

/* ---------- install prompt ---------- */
let installEvt = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; requestRender(); });
window.addEventListener("appinstalled", () => { installEvt = null; toast("앱이 설치되었습니다."); requestRender(); });
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

/* ---------- rendering ---------- */
const $view = $("#view");
let renderDeferred = false;
function requestRender() {
  setTimeout(() => {
    const a = document.activeElement;
    if (a && $view.contains(a) && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) { renderDeferred = true; return; }
    render();
  }, 0);
}
$view.addEventListener("focusout", () => { if (renderDeferred) setTimeout(() => { if (renderDeferred) requestRender(); }, 0); });
const TITLES = { summary: "요약", workout: "운동", food: "식단", history: "기록", settings: "설정" };
function render() {
  renderDeferred = false; pbCache = new Map();
  $("#viewTitle").textContent = TITLES[S.tab];
  $("#dateLabel").textContent = fmtDate(S.date);
  $("#todayBtn").hidden = S.date === todayStr();
  $("#dateNav").hidden = S.tab === "history" || S.tab === "settings";
  document.querySelectorAll(".tab").forEach((b) => b.setAttribute("aria-current", b.dataset.tab === S.tab ? "page" : "false"));
  if (!S.ready) { $view.innerHTML = `<div class="empty">기록을 불러오는 중…</div>`; return; }
  let banner = "";
  if (!S.storageOk) banner += `<div class="banner">이 브라우저에서는 기록을 저장할 수 없습니다. 시크릿 모드라면 일반 창에서 열어 주세요.</div>`;
  $view.innerHTML = banner + ({ summary: vSummary, workout: vWorkout, food: vFood, history: vHistory, settings: vSettings }[S.tab])();
  updateWakeLock();
}
function bar(val, max, cls) {
  const pct = max > 0 ? Math.min(100, val / max * 100) : 0, over = max > 0 && val > max * 1.05 && cls !== "p";
  return `<div class="bar ${cls || ""} ${over ? "over" : ""}"><i style="width:${pct}%"></i></div>`;
}
function backupNag() {
  const days = Object.keys(D().days).filter((d) => hasContent(D().days[d])).length; if (days < 3) return "";
  const last = D().lastBackup ? Math.floor((Date.now() - D().lastBackup) / 86400000) : null; if (last !== null && last < 14) return "";
  return `<div class="banner"><span class="grow">기록은 이 휴대폰에만 저장됩니다. ${last === null ? "아직 백업한 적이 없습니다." : `마지막 백업이 ${last}일 전입니다.`}</span><button class="btn sm" data-act="goto" data-tab="settings">백업하기</button></div>`;
}
function migrationNote() {
  const m = D().migratedFrom; if (!m || m.seen) return "";
  const parts = [`v3로 업데이트했습니다. 기존 기록을 그대로 옮겼습니다.`];
  if (m.bodyweight && m.bodyweight.length) parts.push(`맨몸 운동 기록(${m.bodyweight.map(esc).join(", ")})은 체중으로 적은 kg 대신 횟수만 남겼습니다.`);
  if (m.custom && m.custom.length) parts.push(`목록에 없는 종목(${m.custom.map(esc).join(", ")})은 내 종목으로 만들었습니다.`);
  return `<div class="banner" style="border-style:solid"><span class="grow">${parts.join(" ")}</span><button class="btn sm" data-act="dismissmig">확인</button></div>`;
}

function vSummary() {
  const day = getDay(S.date), t = targets(S.date), ft = foodTotals(day.foods), ws = dayStats(day), remain = t.kcal - ft.kcal;
  const install = installEvt && !isStandalone() ? `<div class="banner"><span class="grow">홈 화면에 설치하면 앱처럼 바로 열 수 있습니다.</span><button class="btn sm primary" data-act="install">설치</button></div>` : "";
  return `${migrationNote()}${install}${backupNag()}
  <section class="card" aria-label="칼로리">
    <div class="kcal-hero">
      <div><div class="xs muted">${remain >= 0 ? "남은 칼로리" : "목표 초과"}</div>
        <div class="kcal-big ${remain < 0 ? "over" : ""}">${Math.round(Math.abs(remain)).toLocaleString()}<small> kcal</small></div></div>
      <div class="small muted kcal-side" style="text-align:right">섭취 <b>${Math.round(ft.kcal).toLocaleString()}</b><br>목표 <b>${Math.round(t.kcal).toLocaleString()}</b></div>
    </div>
    <div style="margin-top:12px">${bar(ft.kcal, t.kcal, "")}</div>
  </section>
  <section class="card metric" aria-label="단백질">
    <div class="metric-head"><span style="font-weight:700">단백질 (Protein)</span><span><b style="color:var(--accent)">${r1(ft.p)}</b> <span class="muted">/ ${Math.round(t.protein)} g</span></span></div>
    ${bar(ft.p, t.protein, "p")}
    <div class="small muted">${ft.p >= t.protein ? "오늘 목표 달성" : `${r1(t.protein - ft.p)} g 더 필요`} · 체중 ${t.w} kg × ${D().settings.gPerKg} g/kg</div>
  </section>
  <section class="card"><div class="macros two">
    <div class="macro"><div class="k"><span class="dot" style="background:var(--carb)"></span>탄수화물</div><div class="v">${Math.round(ft.c)}<span class="small muted"> / ${Math.round(t.carbG)} g</span></div>${bar(ft.c, t.carbG, "c")}</div>
    <div class="macro"><div class="k"><span class="dot" style="background:var(--accent)"></span>단백질 비율</div><div class="v">${ft.kcal ? Math.round(ft.p * 4 / ft.kcal * 100) : 0}<span class="small muted"> % kcal</span></div><div class="xs muted">${Math.round(ft.p * 4)} kcal</div></div>
  </div></section>
  <div class="sec-title">운동</div>
  <section class="card">
    ${ws.ex ? `<div class="stats">
      <div class="stat"><div class="v">${ws.done}<span class="small muted">/${ws.sets}</span></div><div class="k">완료 세트</div></div>
      <div class="stat"><div class="v">${Math.round(ws.vol).toLocaleString()}</div><div class="k">볼륨 kg</div></div>
      <div class="stat"><div class="v">${ws.dur >= 60000 ? fmtDur(ws.dur).replace("시간 ", "h ").replace("분", "m") : "—"}</div><div class="k">운동 시간</div></div>
      <div class="stat"><div class="v" style="${ws.prs ? "color:var(--pr)" : ""}">${ws.prs}</div><div class="k">신기록</div></div>
    </div><div class="small muted" style="margin-top:8px">${day.entries.map((e) => esc(ex(e.exId).name)).join(" · ")}</div>`
    : `<div class="empty" style="padding:6px">아직 운동 기록이 없습니다.<br><button class="btn primary sm" data-act="goto" data-tab="workout" style="margin-top:8px">운동 기록하기</button></div>`}
  </section>
  <div class="sec-title">체성분 (Body composition)</div>
  <section class="card stack">
    <div class="grid3">
      <div class="field"><label for="bw">체중 kg</label><input id="bw" inputmode="decimal" data-bind="body" data-k="w" value="${day.body.w ?? ""}" placeholder="${latestBody("w", S.date)?.v ?? ""}"></div>
      <div class="field"><label for="bf">체지방률 %</label><input id="bf" inputmode="decimal" data-bind="body" data-k="fat" value="${day.body.fat ?? ""}" placeholder="${latestBody("fat", S.date)?.v ?? ""}"></div>
      <div class="field"><label for="bm">골격근량 kg</label><input id="bm" inputmode="decimal" data-bind="body" data-k="mm" value="${day.body.mm ?? ""}" placeholder="${latestBody("mm", S.date)?.v ?? ""}"></div>
    </div>
    <div class="xs muted">체중을 기록하면 칼로리·단백질 목표와 맨몸 운동 볼륨에 최근 체중이 반영됩니다. 흐린 숫자는 직전 기록입니다.</div>
  </section>`;
}

/* ----- workout view ----- */
const COLS = {
  wr: [["kg", "kg"], ["reps", "횟수"], ["rpe", "RPE"]], bwp: [["kg", "+kg"], ["reps", "횟수"], ["rpe", "RPE"]],
  bwa: [["kg", "보조 kg"], ["reps", "횟수"], ["rpe", "RPE"]], bw: [["reps", "횟수"], ["rpe", "RPE"]],
  time: [["sec", "초"]], dist: [["km", "km"], ["min", "분"]]
};
function setCellVal(s, f) { if (f === "min") return s.sec === "" ? "" : r1(num(s.sec) / 60); return s[f]; }
function setLine(s, type) {
  if (type === "time") return fmtSec(s.sec); if (type === "dist") return `${num(s.km)}km ${s.sec !== "" ? Math.round(num(s.sec) / 60) + "분" : ""}`.trim();
  if (type === "bw") return `${num(s.reps)}회`; const sign = type === "bwp" ? "+" : type === "bwa" ? "−" : "";
  return `${sign}${num(s.kg)}×${num(s.reps)}`;
}
function exCard(entry, idx, day, labels) {
  const e = ex(entry.exId), type = e.type, st = entryStats(entry, type, bwAt(day.date)), last = lastSession(entry.exId, day.date);
  const flags = prFlags(entry, day.date), rec = recommend(last, e, day.date), cols = COLS[type];
  const conf = S.confirm === entry.id, label = labels[entry.id], next = day.entries[idx + 1];
  const linked = entry.group && next && next.group === entry.group;
  const pending = entry.sets.some((s) => !s.done);
  const recSame = rec && rec.sets.length === entry.sets.length && rec.sets.every((r, i) => num(r.kg) === num(entry.sets[i].kg) && num(r.reps) === num(entry.sets[i].reps));
  const lastTxt = last ? `지난번 ${shortDate(last.date)}: ${last.sets.filter(hasValues).map((s) => (s.t === "W" ? "W " : "") + setLine(s, type)).join(", ")}` : "이 종목 첫 기록";
  const firstWork = entry.sets.find((s) => !s.done && s.t !== "W" && num(s.kg)) || [...entry.sets].reverse().find((s) => s.t !== "W" && num(s.kg));
  const isBar = e.equip === "barbell" || e.equip === "smith";
  let platePanel = "";
  if (S.plateFor === entry.id) {
    const target = firstWork ? num(firstWork.kg) : 0, pl = plates(target, D().settings.barKg);
    platePanel = `<div class="panel small">${target ? `<b>${target} kg</b> · 바 ${D().settings.barKg} kg 기준 한쪽에 ${pl.under ? "바보다 가볍습니다" : pl.perSide.length ? `<b>${pl.perSide.join(" + ")}</b> kg` : "원판 없음"}${pl.rest ? ` <span class="muted">(${pl.rest} kg 맞출 수 없음)</span>` : ""}` : "세트에 무게를 먼저 입력하세요."}</div>`;
  }
  const edit = S.editEx === entry.id ? exEditPanel(e) : "";
  return `<section class="card ex ${entry.group ? "sup" : ""}">
    <div class="ex-head">
      ${label ? `<span class="sup-tag">${label}</span>` : ""}
      <div class="grow"><div class="ex-title">${esc(e.name)}</div>
        <div class="xs muted">${esc(MUSCLES[e.primary] || "")} · ${esc(EQUIP[e.equip] || "")} · ${esc(TYPES[type])}${["wr", "bwp", "bwa"].includes(type) ? ` · 목표 ${e.repMin}–${e.repMax}회` : ""}</div></div>
      <button class="icon-btn sm" data-act="moveex" data-id="${entry.id}" data-d="-1" aria-label="위로" ${idx === 0 ? "disabled" : ""}>↑</button>
      <button class="icon-btn sm" data-act="moveex" data-id="${entry.id}" data-d="1" aria-label="아래로" ${!next ? "disabled" : ""}>↓</button>
      <button class="icon-btn sm" data-act="editex" data-id="${entry.id}" aria-label="종목 설정">⋯</button>
    </div>
    ${edit}
    <div class="prev">${esc(lastTxt)}</div>
    ${rec && pending ? `<div class="rec ${rec.up ? "up" : ""}"><span class="grow"><b>${rec.up ? "증량 추천" : "오늘 추천"}</b> ${rec.sets.filter((s) => s.t !== "W").map((s) => setLine(s, type)).join(", ")}<br><span class="xs">${esc(rec.note)}</span></span>${recSame ? `<span class="xs muted">적용됨</span>` : `<button class="btn sm" data-act="applyrec" data-id="${entry.id}">적용</button>`}</div>` : ""}
    <div class="sets">
      <div class="set hdr k-${type}"><span>세트</span>${cols.map((c) => `<span>${c[1]}</span>`).join("")}<span>완료</span><span></span></div>
      ${entry.sets.map((s, i) => {
        const ps = last && last.sets[i], nth = entry.sets.slice(0, i + 1).filter((x) => x.t !== "W").length;
        return `<div class="set k-${type} ${s.done ? "done" : ""} ${flags[i] ? "isPr" : ""}">
          <button class="ty ${s.t}" data-act="type" data-id="${entry.id}" data-i="${i}" aria-label="세트 종류 바꾸기 (일반·워밍업·실패·드롭)">${s.t === "N" ? nth : s.t}${flags[i] ? `<span class="badge">PR</span>` : ""}</button>
          ${cols.map(([f]) => `<input class="${f === "rpe" ? "rpe" : ""}" id="${f}-${entry.id}-${i}" inputmode="decimal" value="${setCellVal(s, f)}" placeholder="${ps ? (setCellVal(ps, f) === "" ? "" : setCellVal(ps, f)) : f === "rpe" ? "-" : ""}" data-bind="setf" data-f="${f}" data-id="${entry.id}" data-i="${i}" aria-label="${i + 1}세트 ${f}">`).join("")}
          <button class="chk" aria-pressed="${s.done}" data-act="done" data-id="${entry.id}" data-i="${i}" aria-label="${i + 1}세트 완료">✓</button>
          <button class="x" data-act="delset" data-id="${entry.id}" data-i="${i}" aria-label="${i + 1}세트 삭제">×</button>
        </div>`; }).join("")}
    </div>
    <div class="row tools">
      <button class="btn sm" data-act="addset" data-id="${entry.id}">+ 세트</button>
      ${["wr", "bwp"].includes(type) ? `<button class="btn sm ghost" data-act="warmup" data-id="${entry.id}">워밍업 계산</button>` : ""}
      ${isBar ? `<button class="btn sm ghost" data-act="plates" data-id="${entry.id}" aria-pressed="${S.plateFor === entry.id}">원판</button>` : ""}
      ${next ? `<button class="btn sm ghost" data-act="superset" data-id="${entry.id}">${linked ? "슈퍼세트 해제" : "다음 종목과 슈퍼세트"}</button>` : ""}
      <span class="grow"></span>
      <button class="btn sm ${conf ? "danger" : "ghost"}" data-act="delex" data-id="${entry.id}">${conf ? "정말 삭제" : "삭제"}</button>
    </div>
    ${platePanel}
    <input class="note" id="note-${entry.id}" type="text" value="${esc(entry.note)}" placeholder="메모 (자세, 기구 번호 등)" data-bind="note" data-id="${entry.id}" aria-label="메모">
    <div class="ex-foot" id="foot-${entry.id}">${exFoot(st, type)}</div>
  </section>`;
}
function exFoot(st, type) {
  if (type === "time") return `<span>최장 <b>${fmtSec(st.sec)}</b></span>`;
  if (type === "dist") return `<span>최장 <b>${r1(st.km)}</b> km</span>`;
  if (type === "bw") return `<span>최다 <b>${st.reps}</b>회</span><span>볼륨 <b>${Math.round(st.vol).toLocaleString()}</b> kg <span class="xs">(체중 포함)</span></span>`;
  return `<span>볼륨 <b>${Math.round(st.vol).toLocaleString()}</b> kg${type !== "wr" ? ` <span class="xs">(체중 포함)</span>` : ""}</span>${type !== "bwa" ? `<span>최고 <b>${st.top}</b> kg</span>` : ""}<span>추정 1RM <b>${r1(st.best)}</b> kg</span>`;
}
function exEditPanel(e) {
  const muscleOpts = Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}" ${k === e.primary ? "selected" : ""}>${v}</option>`).join("");
  return `<form class="panel stack exEdit" data-ex="${esc(e.id)}" autocomplete="off">
    ${e.custom ? `<div class="field"><label for="ee-name">이름</label><input id="ee-name" type="text" value="${esc(e.name)}"></div>
    <div class="grid2"><div class="field"><label for="ee-type">기록 방식</label><select id="ee-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${k === e.type ? "selected" : ""}>${v}</option>`).join("")}</select></div>
    <div class="field"><label for="ee-eq">기구</label><select id="ee-eq">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}" ${k === e.equip ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>` : ""}
    <div class="grid3">
      <div class="field"><label for="ee-min">목표 최소 횟수</label><input id="ee-min" inputmode="numeric" value="${e.repMin}"></div>
      <div class="field"><label for="ee-max">목표 최대 횟수</label><input id="ee-max" inputmode="numeric" value="${e.repMax}"></div>
      <div class="field"><label for="ee-inc">증량 단위 kg</label><input id="ee-inc" inputmode="decimal" value="${e.inc}"></div>
    </div>
    <div class="field"><label for="ee-prim">주 근육</label><select id="ee-prim">${muscleOpts}</select></div>
    <div class="xs muted">최대 횟수를 모든 세트에서 채우면 다음번에 증량 단위만큼 무게를 올리라고 추천합니다.</div>
    <div class="row"><button class="btn primary sm" type="submit">저장</button><button class="btn sm ghost" type="button" data-act="editex" data-id="">닫기</button></div>
  </form>`;
}
function pickerResults() {
  const q = norm(S.pickQ); let list;
  if (!q && !S.pickPart) {
    const rec = recentExIds(); list = rec.length ? rec.map(ex) : allEx(D()).slice(0, 12);
  } else {
    list = allEx(D()).filter((e) => (!S.pickPart || partOfEx(e) === S.pickPart) && (!q || norm(e.name).includes(q) || (e.aliases || []).some((a) => norm(a).includes(q))));
  }
  const head = !q && !S.pickPart ? `<div class="xs muted">${recentExIds().length ? "최근 한 종목" : "자주 하는 종목"}</div>` : `<div class="xs muted">${list.length}개</div>`;
  return head + (list.slice(0, 40).map((e) => `<button class="pick" data-act="addex" data-id="${esc(e.id)}"><span class="grow"><b>${esc(e.name)}</b>${e.custom ? ` <span class="xs muted">내 종목</span>` : ""}</span><span class="xs muted">${esc(partOfEx(e))} · ${esc(EQUIP[e.equip] || "")}</span></button>`).join("")
    || `<div class="small muted">찾는 종목이 없습니다. 아래에서 새로 만들 수 있습니다.</div>`);
}
function vWorkout() {
  const day = getDay(S.date), ws = dayStats(day), isToday = S.date === todayStr(), labels = groupLabels(day);
  const prevDay = Object.keys(D().days).filter((d) => d < S.date && D().days[d].entries.length).sort().pop();
  const sess = day.session
    ? `<section class="card sess">${sessionActive(day) ? `<span class="live" aria-hidden="true"></span>` : ""}<span class="clock" id="sessClock">${fmtClock(ws.dur)}</span>
        <span class="grow small muted">${sessionActive(day) ? "운동 중" : "운동 시간"}</span>
        ${sessionActive(day) ? `<button class="btn sm primary" data-act="endsess">운동 종료</button>` : isToday ? `<button class="btn sm" data-act="resumesess">다시 시작</button>` : ""}</section>`
    : isToday ? `<section class="card sess"><span class="grow small muted">첫 세트를 완료하면 운동 시간이 자동으로 측정됩니다.</span><button class="btn sm" data-act="startsess">지금 시작</button></section>` : "";
  const open = S.pickerOpen || !day.entries.length;
  const picker = open ? `<section class="card stack picker">
      <div class="row"><input id="pickQ" type="search" class="grow" placeholder="종목 검색 (예: 벤치, 랫풀, 스쿼트)" value="${esc(S.pickQ)}" data-bind="pickq" aria-label="종목 검색" style="flex:1 1 180px">${day.entries.length ? `<button class="btn sm ghost" data-act="togglepicker">닫기</button>` : ""}</div>
      <div class="chips"><button class="chip ${!S.pickPart ? "on" : ""}" data-act="pickpart" data-p="">전체</button>${PARTS.map((p) => `<button class="chip ${S.pickPart === p ? "on" : ""}" data-act="pickpart" data-p="${p}">${p}</button>`).join("")}</div>
      <div class="picklist" id="pickList">${pickerResults()}</div>
      ${S.creating ? `<form id="newExForm" class="panel stack" autocomplete="off">
        <div class="field"><label for="nx-name">새 종목 이름</label><input id="nx-name" type="text" value="${esc(S.pickQ)}" required></div>
        <div class="grid3"><div class="field"><label for="nx-type">기록 방식</label><select id="nx-type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div>
        <div class="field"><label for="nx-part">부위</label><select id="nx-part">${PARTS.map((p) => `<option ${S.pickPart === p ? "selected" : ""}>${p}</option>`).join("")}</select></div>
        <div class="field"><label for="nx-eq">기구</label><select id="nx-eq">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></div></div>
        <div class="row"><button class="btn primary sm" type="submit">만들고 추가</button><button class="btn sm ghost" type="button" data-act="creating">취소</button></div></form>`
      : `<button class="btn sm ghost" data-act="creating">+ 새 종목 만들기</button>`}
    </section>` : "";
  return `${sess}
  <div class="sec-title">루틴<span class="lnk xs">${day.entries.length ? `<button class="btn sm ghost" data-act="saveroutine">${S.saveRoutine ? "취소" : "현재 운동을 루틴으로 저장"}</button>` : ""}</span></div>
  <section class="card stack">
    ${S.saveRoutine ? `<form id="routineForm" class="row" autocomplete="off"><input id="routineName" type="text" class="grow" placeholder="루틴 이름 (예: 등·이두)" required style="flex:1 1 160px"><button class="btn primary" type="submit">저장</button></form>` : ""}
    ${D().routines.length ? `<div class="chips">${D().routines.map((r) => `<button class="chip" data-act="startroutine" data-id="${r.id}">${esc(r.name)} <span class="xs muted">${r.items.length}종목</span></button>`).join("")}</div><div class="xs muted">누르면 루틴 종목이 추가되고, 지난 기록을 바탕으로 오늘 무게·횟수가 채워집니다.</div>`
    : `<div class="small muted">자주 하는 분할 운동을 루틴으로 저장해 두면 한 번에 불러올 수 있습니다.</div>`}
    ${!day.entries.length && prevDay ? `<button class="btn" data-act="copyprev" data-from="${prevDay}">${fmtDate(prevDay)} 운동 불러오기 (${D().days[prevDay].entries.length}종목)</button>` : ""}
  </section>
  ${picker}
  ${day.entries.map((e, i) => exCard(e, i, day, labels)).join("")}
  ${day.entries.length && !open ? `<button class="btn block" data-act="togglepicker">+ 종목 추가</button>` : ""}
  ${day.entries.length ? `<div class="xs muted">세트 번호를 누르면 일반 → 워밍업(W) → 실패(F) → 드롭(D)으로 바뀝니다. 워밍업은 볼륨·신기록에서 빠집니다. 추정 1RM = kg × (1 + 횟수/30) (Epley).</div>` : ""}`;
}

/* ----- food view (same as v2) ----- */
function vFood() {
  const day = getDay(S.date), t = targets(S.date), ft = foodTotals(day.foods), mealLabel = MEALS.find((m) => m.k === S.meal).label;
  const groups = MEALS.map((m) => {
    const items = day.foods.filter((x) => x.meal === m.k); if (!items.length) return "";
    const st = foodTotals(items), saving = S.saveMeal === m.k;
    return `<div class="meal-h"><span>${m.label} <span class="sub">${Math.round(st.kcal)} kcal · 단백질 ${r1(st.p)} g · 탄수 ${r1(st.c)} g</span></span>
      <button class="btn sm ghost" data-act="savemeal" data-meal="${m.k}">${saving ? "취소" : "내 식사로 저장"}</button></div>
      ${saving ? `<form class="row mealForm" data-meal="${m.k}" autocomplete="off" style="padding-bottom:8px"><input id="mealName-${m.k}" type="text" class="grow" placeholder="이름 (예: 아침 단백질 세트)" required style="flex:1 1 150px"><button class="btn primary sm" type="submit">저장</button></form>` : ""}
      ${items.map((x) => {
        const k = factor(x);
        const ctl = x.basis === "g" ? `<span class="gram"><input id="g-${x.id}" inputmode="numeric" value="${x.g}" data-bind="grams" data-id="${x.id}" aria-label="먹은 양 g"><span class="xs muted">g</span></span>`
          : `<span class="stepper"><button data-act="qty" data-id="${x.id}" data-d="-0.5" aria-label="수량 줄이기">−</button><span>×${x.qty}</span><button data-act="qty" data-id="${x.id}" data-d="0.5" aria-label="수량 늘리기">+</button></span>`;
        return `<div class="food"><div class="name">${esc(x.name)}<div class="meta" id="meta-${x.id}">${foodMeta(x, k)}</div></div><div class="row" style="gap:4px;flex-wrap:nowrap">${ctl}<button class="x" data-act="delfood" data-id="${x.id}" aria-label="삭제">×</button></div></div>`;
      }).join("")}`;
  }).join("");
  return `
  <section class="card stack">
    <div class="metric"><div class="metric-head"><span class="small">칼로리</span><span><b>${Math.round(ft.kcal).toLocaleString()}</b> <span class="muted small">/ ${Math.round(t.kcal).toLocaleString()} kcal</span></span></div>${bar(ft.kcal, t.kcal, "")}</div>
    <div class="metric"><div class="metric-head"><span class="small">단백질</span><span><b style="color:var(--accent)">${r1(ft.p)}</b> <span class="muted small">/ ${Math.round(t.protein)} g</span></span></div>${bar(ft.p, t.protein, "p")}</div>
    <div class="metric"><div class="metric-head"><span class="small">탄수화물</span><span><b style="color:var(--carb)">${r1(ft.c)}</b> <span class="muted small">/ ${Math.round(t.carbG)} g</span></span></div>${bar(ft.c, t.carbG, "c")}</div>
  </section>
  <div class="seg" role="group" aria-label="끼니 선택">${MEALS.map((m) => `<button data-act="meal" data-meal="${m.k}" aria-pressed="${S.meal === m.k}">${m.label}</button>`).join("")}</div>
  ${D().myMeals.length ? `<div class="sec-title">내 식사 → ${mealLabel}</div><section class="card"><div class="chips">${D().myMeals.map((m) => `<button class="chip combo" data-act="addcombo" data-id="${m.id}">${esc(m.name)} <span class="pp">${r1(foodTotals(m.items).p)}g</span></button>`).join("")}</div></section>` : ""}
  <div class="sec-title">빠른 추가 → ${mealLabel}</div>
  <section class="card stack">
    <div class="chips">${D().myFoods.map((f) => `<button class="chip" data-act="quick" data-id="${f.id}">${esc(f.name)}${f.basis === "g" ? ` <span class="xs muted">${f.lastG || 100}g</span>` : ""} <span class="pp">${r1(f.basis === "g" ? f.p * (f.lastG || 100) / 100 : f.p)}g</span></button>`).join("") || `<span class="muted small">저장된 음식이 없습니다.</span>`}</div>
    <div class="xs muted">파란 숫자는 단백질입니다. 기본 음식 값은 대략값이니 설정에서 제품 라벨 값으로 고쳐 주세요.</div>
  </section>
  <div class="sec-title">${fmtDate(S.date)} 먹은 것</div>
  <section class="card">${groups || `<div class="empty" style="padding:6px">아직 기록이 없습니다. 끼니를 고른 뒤 위 버튼이나 아래 직접 입력으로 추가하세요.</div>`}</section>
  <div class="sec-title">직접 입력 → ${mealLabel}</div>
  <form class="card stack" id="addFoodForm" autocomplete="off">
    <div class="field"><label for="fName">음식 이름</label><input id="fName" type="text" placeholder="예: 편의점 닭가슴살 1팩" required></div>
    <div class="seg" role="group" aria-label="영양 정보 기준"><button type="button" data-act="fbasis" data-b="sv" aria-pressed="${S.fBasis !== "g"}">1회분 기준</button><button type="button" data-act="fbasis" data-b="g" aria-pressed="${S.fBasis === "g"}">100 g당 기준</button></div>
    <div class="grid3">
      <div class="field"><label for="fKcal">칼로리 kcal</label><input id="fKcal" inputmode="decimal" required></div>
      <div class="field"><label for="fP">단백질 g</label><input id="fP" inputmode="decimal"></div>
      <div class="field"><label for="fC">탄수 g</label><input id="fC" inputmode="decimal"></div>
    </div>
    ${S.fBasis === "g" ? `<div class="field"><label for="fG">먹은 양 g</label><input id="fG" inputmode="numeric" value="100"></div>` : ""}
    <label class="row small"><input type="checkbox" id="fSave" checked> 내 음식에도 저장</label>
    <button class="btn primary" type="submit">추가</button>
  </form>`;
}
const foodMeta = (x, k) => `${Math.round(x.kcal * k)} kcal · <span class="pv">단백질 ${r1(x.p * k)} g</span> · 탄수 ${r1(x.c * k)} g`;

/* ----- history view ----- */
function niceStep(raw) { if (raw <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
function barChart(labels, vals, target, color) {
  const W = 340, H = 150, L = 34, R = 6, T = 10, B = 22, max = Math.max(target * 1.15, ...vals, 1);
  const step = niceStep(max / 3), top = Math.ceil(max / step) * step, y = (v) => T + (H - T - B) * (1 - v / top), bw = (W - L - R) / vals.length;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let v = 0; v <= top + 1e-9; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`;
  vals.forEach((v, i) => { const x = L + i * bw + bw * 0.18, w = bw * 0.64; if (v > 0) s += `<rect x="${x}" y="${y(v)}" width="${w}" height="${y(0) - y(v)}" rx="2" fill="${color}" opacity="${i === vals.length - 1 ? 1 : 0.7}"/>`; if (i % 2 === 1 || vals.length <= 7) s += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${labels[i]}</text>`; });
  if (target > 0) s += `<line x1="${L}" x2="${W - R}" y1="${y(target)}" y2="${y(target)}" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="4 3"/>`;
  return s + `</svg>`;
}
function lineChart(labels, series, unit) {
  const W = 340, H = 160, L = 38, R = 12, T = 18, B = 22, all = series.flatMap((s) => s.vals);
  let lo = Math.min(...all), hi = Math.max(...all); if (hi - lo < 1) { hi += 1; lo -= 1; }
  const step = niceStep((hi - lo) / 3); lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const n = labels.length, x = (i) => L + (W - L - R) * (n === 1 ? 0.5 : i / (n - 1)), y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">`;
  for (let v = lo; v <= hi + 1e-9; v += step) s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${r1(v)}</text>`;
  const every = Math.ceil(n / 6); labels.forEach((lb, i) => { if (i % every === 0 || i === n - 1) s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${lb}</text>`; });
  for (const se of series) { s += `<polyline fill="none" stroke="${se.color}" stroke-width="2" stroke-linejoin="round" points="${se.vals.map((v, i) => `${x(i)},${y(v)}`).join(" ")}"/>`; const li = se.vals.length - 1; s += `<circle cx="${x(li)}" cy="${y(se.vals[li])}" r="3.5" fill="${se.color}"/>`; }
  const last = series[0].vals[series[0].vals.length - 1];
  s += `<text x="${x(n - 1) - 6}" y="${y(last) - 8}" text-anchor="end" style="fill:var(--fg);font-size:12px;font-weight:600">${r1(last)} ${unit}</text>`;
  return s + `</svg>`;
}
function calendar() {
  const [y, m] = S.calMonth.split("-").map(Number), first = new Date(y, m - 1, 1), daysIn = new Date(y, m, 0).getDate(), today = todayStr();
  let cells = ""; for (let i = 0; i < first.getDay(); i++) cells += `<button class="out" tabindex="-1" aria-hidden="true"></button>`;
  for (let d = 1; d <= daysIn; d++) {
    const key = `${y}-${pad(m)}-${pad(d)}`, day = D().days[key], sets = day ? day.entries.reduce((a, e) => a + e.sets.filter(isWorking).length, 0) : 0;
    cells += `<button class="${(sets >= 12 ? "w2" : sets > 0 ? "w1" : "") + (key === today ? " today" : "")}" data-act="openday" data-d="${key}" aria-label="${m}월 ${d}일${sets ? ` 운동 ${sets}세트` : ""}">${d}${day && day.foods.length ? `<span class="fd"></span>` : ""}</button>`;
  }
  const count = Object.keys(D().days).filter((k) => k.startsWith(S.calMonth) && D().days[k].entries.some((e) => e.sets.some(isWorking))).length;
  return `<div class="row" style="justify-content:space-between;margin-bottom:8px"><button class="icon-btn" data-act="calprev" aria-label="이전 달">‹</button>
    <b class="num" style="font-size:20px">${y}.${pad(m)} <span class="small muted" style="font-family:var(--font-body);font-weight:400">운동 ${count}일</span></b><button class="icon-btn" data-act="calnext" aria-label="다음 달">›</button></div>
    <div class="cal">${"일월화수목금토".split("").map((w) => `<span class="wd">${w}</span>`).join("")}${cells}</div>
    <div class="legend" style="margin-top:8px"><span><span class="dot" style="background:var(--accent-soft);border:1px solid var(--line)"></span>운동</span><span><span class="dot" style="background:var(--accent)"></span>12세트 이상</span><span><span class="dot" style="background:var(--carb)"></span>식단 기록</span></div>`;
}
function partWeek(end) {
  const res = {}; PARTS.forEach((p) => { res[p] = { sets: 0, vol: 0 }; });
  for (let i = 0; i < 7; i++) { const day = D().days[shiftDate(end, -i)]; if (!day) continue; const bw = bwAt(day.date);
    for (const e of day.entries) { const x = ex(e.exId), p = partOfEx(x); if (!res[p]) continue; for (const s of e.sets) if (isWorking(s)) { res[p].sets++; res[p].vol += entryStats({ sets: [s] }, x.type, bw).vol; } } }
  return res;
}
function bestOf(exId) { let w = 0, e = 0; for (const d of Object.values(D().days)) for (const en of d.entries) if (en.exId === exId) for (const s of en.sets) if (isWorking(s)) { w = Math.max(w, num(s.kg)); e = Math.max(e, e1rm(s.kg, s.reps)); } return { w, e }; }
function vHistory() {
  const today = todayStr(), t = targets(today), dates = []; for (let i = 13; i >= 0; i--) dates.push(shiftDate(today, -i));
  const kc = dates.map((d) => D().days[d] ? foodTotals(D().days[d].foods).kcal : 0), pr = dates.map((d) => D().days[d] ? foodTotals(D().days[d].foods).p : 0);
  const exIds = [...usedExIds()].filter((id) => Object.values(D().days).some((d) => d.entries.some((e) => e.exId === id))).sort((a, b) => ex(a).name.localeCompare(ex(b).name, "ko"));
  if (!S.histEx || !exIds.includes(S.histEx)) S.histEx = exIds[0] || null;
  let exChart = "", legend = "";
  if (S.histEx) {
    const x = ex(S.histEx), strength = ["wr", "bwp", "bwa"].includes(x.type);
    const pts = Object.keys(D().days).sort().map((d) => { const en = D().days[d].entries.find((e) => e.exId === S.histEx); if (!en) return null; const st = entryStats(en, x.type, bwAt(d)); const main = strength ? st.best : x.type === "time" ? st.sec : x.type === "dist" ? st.km : st.reps; return main ? { d, main, top: st.top } : null; }).filter(Boolean).slice(-20);
    const unit = strength ? "kg" : x.type === "time" ? "초" : x.type === "dist" ? "km" : "회";
    exChart = pts.length >= 2 ? lineChart(pts.map((p) => shortDate(p.d)), strength && x.type !== "bwa" ? [{ vals: pts.map((p) => p.main), color: "var(--accent)" }, { vals: pts.map((p) => p.top), color: "var(--muted)" }] : [{ vals: pts.map((p) => p.main), color: "var(--accent)" }], unit) : `<div class="empty" style="padding:8px">이 종목 기록이 2회 이상 쌓이면 그래프가 그려집니다.</div>`;
    legend = strength ? `<div class="legend"><span><span class="dot" style="background:var(--accent)"></span>추정 1RM${x.type !== "wr" ? "(체중 포함)" : ""}</span>${x.type !== "bwa" ? `<span><span class="dot" style="background:var(--muted)"></span>최고 중량</span>` : ""}</div>` : "";
  }
  const pw = partWeek(today), maxSets = Math.max(1, ...PARTS.map((p) => pw[p].sets));
  const b3 = BIG3.map((b) => ({ ...b, ...bestOf(b.id) })), b3w = b3.reduce((a, b) => a + b.w, 0), b3e = b3.reduce((a, b) => a + b.e, 0);
  const metricInfo = { w: ["체중", "kg", "var(--fat)"], fat: ["체지방률", "%", "var(--carb)"], mm: ["골격근량", "kg", "var(--accent)"] };
  const bpts = Object.keys(D().days).filter((d) => D().days[d].body[S.bodyMetric]).sort().slice(-30);
  const recent = Object.keys(D().days).filter((d) => hasContent(D().days[d])).sort().reverse().slice(0, 30);
  return `<section class="card">${calendar()}</section>
  <div class="sec-title">최근 7일 부위별 세트</div>
  <section class="card stack">${PARTS.filter((p) => pw[p].sets || p !== "유산소").map((p) => `<div class="hbar"><span>${p}</span><span class="track"><i style="width:${pw[p].sets / maxSets * 100}%"></i></span><span class="val">${pw[p].sets}세트 · ${r1(pw[p].vol / 1000)}t</span></div>`).join("")}
    <div class="xs muted">워밍업을 뺀 완료 세트, 주 근육 기준입니다.</div></section>
  <div class="sec-title">3대 합계</div>
  <section class="card stack"><div class="b3">${b3.map((b) => `<div class="stat"><div class="k">${b.k}</div><div class="v">${b.w || "—"}</div><div class="xs muted">${b.e ? `1RM 추정 ${r1(b.e)}` : "기록 없음"}</div></div>`).join("")}</div>
    <div class="metric-head"><span class="small muted">합계 (최고 중량)</span><span><b>${b3w}</b> kg <span class="small muted">· 추정 1RM 합 ${r1(b3e)} kg</span></span></div></section>
  <div class="sec-title">종목별 성장</div>
  <section class="card stack">${exIds.length ? `<select id="histEx" data-bind="histex" aria-label="종목 선택">${exIds.map((id) => `<option value="${esc(id)}" ${id === S.histEx ? "selected" : ""}>${esc(ex(id).name)}</option>`).join("")}</select>${exChart}${legend}` : `<div class="empty" style="padding:8px">운동을 기록하면 종목별 추이가 여기에 표시됩니다.</div>`}</section>
  <div class="sec-title">최근 14일 칼로리</div>
  <section class="card">${barChart(dates.map(shortDate), kc, t.kcal, "var(--fg)")}<div class="legend"><span><span class="dot" style="background:var(--fg)"></span>섭취 kcal</span><span><span class="dot" style="background:var(--warn)"></span>목표 ${Math.round(t.kcal)}</span></div></section>
  <div class="sec-title">최근 14일 단백질</div>
  <section class="card">${barChart(dates.map(shortDate), pr, t.protein, "var(--accent)")}<div class="legend"><span><span class="dot" style="background:var(--accent)"></span>섭취 g</span><span><span class="dot" style="background:var(--warn)"></span>목표 ${Math.round(t.protein)} g</span></div></section>
  <div class="sec-title">체성분 추이</div>
  <section class="card stack"><div class="seg" role="group" aria-label="체성분 항목">${Object.entries(metricInfo).map(([k, v]) => `<button data-act="bodymetric" data-k="${k}" aria-pressed="${S.bodyMetric === k}">${v[0]}</button>`).join("")}</div>
    ${bpts.length >= 2 ? lineChart(bpts.map(shortDate), [{ vals: bpts.map((d) => num(D().days[d].body[S.bodyMetric])), color: metricInfo[S.bodyMetric][2] }], metricInfo[S.bodyMetric][1]) : `<div class="empty" style="padding:8px">요약 화면에서 ${metricInfo[S.bodyMetric][0]}을 2번 이상 기록하면 추이가 그려집니다.</div>`}</section>
  <div class="sec-title">날짜별 기록</div>
  <section class="card">${recent.length ? `<div class="hist-row hd"><span>날짜</span><span>kcal</span><span>단백질</span><span>세트</span><span>시간</span></div>` + recent.map((d) => { const day = D().days[d], ft = foodTotals(day.foods), ws = dayStats(day); return `<button class="hist-row" data-act="openday" data-d="${d}"><span>${fmtDate(d)}</span><span class="num">${Math.round(ft.kcal)}</span><span class="num" style="color:var(--accent)">${r1(ft.p)}</span><span class="num">${ws.done}${ws.prs ? `<span style="color:var(--pr);font-size:11px"> PR</span>` : ""}</span><span class="num">${ws.dur >= 60000 ? Math.round(ws.dur / 60000) + "m" : "—"}</span></button>`; }).join("") : `<div class="empty" style="padding:8px">기록이 쌓이면 날짜별로 모아 보여 줍니다.</div>`}</section>`;
}

/* ----- settings view ----- */
function vSettings() {
  const st = D().settings, t = targets(todayStr()), sexAdd = st.sex === "f" ? "− 161" : "+ 5", lastB = D().lastBackup ? new Date(D().lastBackup) : null, imp = S.pendingImport;
  const used = usedExIds(), customs = Object.values(D().customEx);
  return `
  ${!isStandalone() ? `<section class="card stack"><b>홈 화면에 설치</b>${installEvt ? `<button class="btn primary" data-act="install">앱으로 설치하기</button>` : `<div class="small muted">Chrome 오른쪽 위 ⋮ 메뉴 → <b>홈 화면에 추가</b> 또는 <b>앱 설치</b>를 누르세요.</div>`}</section>` : ""}
  <div class="sec-title">신체 정보와 목표</div>
  <section class="card stack">
    <div class="grid2">
      <div class="field"><label for="sSex">성별</label><select id="sSex" data-bind="set" data-k="sex"><option value="m" ${st.sex === "m" ? "selected" : ""}>남</option><option value="f" ${st.sex === "f" ? "selected" : ""}>여</option></select></div>
      <div class="field"><label for="sAge">나이</label><input id="sAge" inputmode="numeric" data-bind="set" data-k="age" value="${st.age}"></div>
      <div class="field"><label for="sH">키 (cm)</label><input id="sH" inputmode="decimal" data-bind="set" data-k="height" value="${st.height}"></div>
      <div class="field"><label for="sW">기본 체중 (kg)</label><input id="sW" inputmode="decimal" data-bind="set" data-k="weight" value="${st.weight}"></div>
    </div>
    <div class="field"><label for="sAct">활동량</label><select id="sAct" data-bind="set" data-k="activity">${ACTIVITY.map((a) => `<option value="${a.v}" ${num(st.activity) === a.v ? "selected" : ""}>${a.label}</option>`).join("")}</select></div>
    <div class="grid2">
      <div class="field"><label for="sGoal">목표</label><select id="sGoal" data-bind="set" data-k="goal">${GOALS.map((g) => `<option value="${g.v}" ${num(st.goal) === g.v ? "selected" : ""}>${g.label}</option>`).join("")}</select></div>
      <div class="field"><label for="sGpk">단백질 g/kg</label><input id="sGpk" inputmode="decimal" data-bind="set" data-k="gPerKg" value="${st.gPerKg}"></div>
      <div class="field"><label for="sFat">탄수 목표 계산용 지방 비율 %</label><input id="sFat" inputmode="numeric" data-bind="set" data-k="fatPct" value="${st.fatPct}"></div>
      <div class="field"><label for="sOv">목표 kcal 직접 지정</label><input id="sOv" inputmode="numeric" data-bind="set" data-k="kcalOverride" value="${st.kcalOverride ?? ""}" placeholder="자동 ${Math.round(t.auto)}"></div>
    </div>
  </section>
  <div class="sec-title">계산 과정</div>
  <section class="card stack"><div class="calc">
    <div><b>① 기초대사량 BMR</b> (Mifflin–St Jeor)</div><code>10×${t.w} + 6.25×${t.h} − 5×${t.a} ${sexAdd} = ${Math.round(t.bmr)} kcal</code>
    <div style="margin-top:4px"><b>② 활동대사량 TDEE</b> = BMR × 활동계수</div><code>${Math.round(t.bmr)} × ${st.activity} = ${Math.round(t.tdee)} kcal</code>
    <div style="margin-top:4px"><b>③ 목표 칼로리</b> = TDEE + 목표 보정</div><code>${Math.round(t.tdee)} ${num(st.goal) >= 0 ? "+" : "−"} ${Math.abs(num(st.goal))} = ${Math.round(t.auto)} kcal${st.kcalOverride ? ` → 직접 지정 ${Math.round(t.kcal)} 사용` : ""}</code>
    <div style="margin-top:4px"><b>④ 단백질</b> = 체중 × g/kg</div><code>${t.w} × ${st.gPerKg} = ${Math.round(t.protein)} g</code>
    <div style="margin-top:4px"><b>⑤ 탄수화물 목표</b> = 목표 kcal에서 단백질과 지방 몫(${st.fatPct}%)을 뺀 나머지</div><code>탄수 (${Math.round(t.kcal)} − ${Math.round(t.protein)}×4 − ${Math.round(t.fatG)}×9)÷4 = ${Math.round(t.carbG)} g</code>
  </div><div class="xs muted">체중은 ${t.src} 값을 사용합니다. 공식 값은 추정치이므로 2–3주 체중 변화를 보고 조정하세요.</div></section>
  <div class="sec-title">운동 설정</div>
  <section class="card stack">
    <div class="grid2"><div class="field"><label for="sBar">바벨 무게 kg</label><input id="sBar" inputmode="decimal" data-bind="set" data-k="barKg" value="${st.barKg}"></div></div>
    <label class="row small"><input type="checkbox" data-bind="flag" data-k="prefillRec" ${st.prefillRec ? "checked" : ""}> 종목을 추가할 때 추천 무게·횟수로 미리 채우기</label>
    <label class="row small"><input type="checkbox" data-bind="flag" data-k="wakeLock" ${st.wakeLock ? "checked" : ""}> 운동 중에는 화면이 꺼지지 않게</label>
  </section>
  <div class="sec-title">내 종목 (${customs.length})</div>
  <section class="card">${customs.map((c) => `<div class="list-item"><div class="grow"><b>${esc(c.name)}</b><div class="xs muted">${esc(partOfEx(c))} · ${esc(TYPES[c.type])}${used.has(c.id) ? " · 기록 있음" : ""}</div></div>${used.has(c.id) ? "" : `<button class="btn sm ${S.confirm === c.id ? "danger" : "ghost"}" data-act="delcustom" data-id="${esc(c.id)}">${S.confirm === c.id ? "정말 삭제" : "삭제"}</button>`}</div>`).join("") || `<div class="small muted">운동 화면의 종목 검색에서 "새 종목 만들기"로 추가한 종목이 여기에 모입니다.</div>`}</section>
  <div class="sec-title">루틴 (${D().routines.length})</div>
  <section class="card">${D().routines.map((r) => `<div class="list-item"><div class="grow"><b>${esc(r.name)}</b><div class="xs muted">${r.items.map((i) => esc(ex(i.exId).name)).join(" · ")}</div></div><button class="btn sm ${S.confirm === r.id ? "danger" : "ghost"}" data-act="delroutine" data-id="${r.id}">${S.confirm === r.id ? "정말 삭제" : "삭제"}</button></div>`).join("") || `<div class="small muted">운동 화면에서 "현재 운동을 루틴으로 저장"을 누르면 여기에 모입니다.</div>`}</section>
  <div class="sec-title">내 식사 (${D().myMeals.length})</div>
  <section class="card">${D().myMeals.map((m) => { const s = foodTotals(m.items); return `<div class="list-item"><div class="grow"><b>${esc(m.name)}</b><div class="xs muted">${m.items.map((i) => esc(i.name)).join(" · ")} · ${Math.round(s.kcal)} kcal · 단백질 ${r1(s.p)} g</div></div><button class="btn sm ${S.confirm === m.id ? "danger" : "ghost"}" data-act="delcombo" data-id="${m.id}">${S.confirm === m.id ? "정말 삭제" : "삭제"}</button></div>`; }).join("") || `<div class="small muted">식단 화면에서 끼니 옆 "내 식사로 저장"을 누르면 여기에 모입니다.</div>`}</section>
  <div class="sec-title">내 음식 (${D().myFoods.length})</div>
  <section class="card">${D().myFoods.map((f) => S.editFood === f.id ? `<form class="list-item stack editFood" data-id="${f.id}" style="display:grid" autocomplete="off">
      <input id="ef-name" type="text" value="${esc(f.name)}" aria-label="이름">
      <div class="seg" role="group"><button type="button" data-act="efbasis" data-b="sv" aria-pressed="${(S.efBasis || f.basis) !== "g"}">1회분</button><button type="button" data-act="efbasis" data-b="g" aria-pressed="${(S.efBasis || f.basis) === "g"}">100 g당</button></div>
      <div class="grid3"><div class="field"><label for="ef-k">kcal</label><input id="ef-k" inputmode="decimal" value="${f.kcal}"></div><div class="field"><label for="ef-p">단백질</label><input id="ef-p" inputmode="decimal" value="${f.p}"></div><div class="field"><label for="ef-c">탄수</label><input id="ef-c" inputmode="decimal" value="${f.c}"></div></div>
      <div class="row"><button class="btn primary sm" type="submit">저장</button><button class="btn sm ghost" type="button" data-act="editfood" data-id="">취소</button><span class="grow"></span><button class="btn sm ${S.confirm === f.id ? "danger" : "ghost"}" type="button" data-act="delmy" data-id="${f.id}">${S.confirm === f.id ? "정말 삭제" : "삭제"}</button></div></form>`
    : `<div class="list-item"><div class="grow">${esc(f.name)}<div class="xs muted">${f.basis === "g" ? "100 g당 " : "1회 "}${f.kcal} kcal · <span style="color:var(--accent);font-weight:700">단백질 ${f.p} g</span> · 탄수 ${f.c} g</div></div><button class="btn sm ghost" data-act="editfood" data-id="${f.id}">수정</button></div>`).join("") || `<div class="small muted">식단 화면에서 직접 입력한 음식이 여기에 모입니다.</div>`}</section>
  <div class="sec-title">백업과 내보내기</div>
  <section class="card stack">
    <div class="small">기록은 이 휴대폰 안(IndexedDB)에만 저장됩니다. 휴대폰을 바꾸거나 브라우저 데이터를 지우기 전에 백업 파일을 저장해 두세요.</div>
    <div class="xs muted">마지막 백업: ${lastB ? `${lastB.getFullYear()}.${pad(lastB.getMonth() + 1)}.${pad(lastB.getDate())}` : "없음"} · 기록 ${Object.keys(D().days).filter((d) => hasContent(D().days[d])).length}일</div>
    <div class="grid2"><button class="btn primary" data-act="export">백업 파일 저장</button><button class="btn" data-act="copybackup">백업 코드 복사</button></div>
    <div class="grid2"><button class="btn" data-act="importfile">백업 파일 열기</button><button class="btn" data-act="togglepaste">${S.showPaste ? "닫기" : "백업 코드 붙여넣기"}</button></div>
    ${S.showPaste ? `<textarea id="pasteBox" placeholder="백업 코드를 여기에 붙여넣으세요"></textarea><button class="btn primary" data-act="readpaste">불러오기</button>` : ""}
    ${imp ? `<div class="banner" style="border-style:solid"><span class="grow">불러온 백업: 기록 ${imp.days}일 · 루틴 ${imp.routines}개 · 내 음식 ${imp.foods}개. 어떻게 적용할까요?</span>
      <div class="row"><button class="btn sm primary" data-act="applyimport" data-mode="merge">합치기</button><button class="btn sm danger" data-act="applyimport" data-mode="replace">전체 교체</button><button class="btn sm ghost" data-act="cancelimport">취소</button></div>
      <div class="xs muted" style="flex-basis:100%">합치기: 같은 날짜는 백업 내용으로 바뀌고 나머지는 유지됩니다. 전체 교체: 지금 기록을 지우고 백업으로 바꿉니다.</div></div>` : ""}
    <div class="grid2"><button class="btn" data-act="csvwork">운동 기록 CSV</button><button class="btn" data-act="csvfood">식단 기록 CSV</button></div>
    <div class="xs muted">CSV는 엑셀에서 바로 열립니다.</div>
  </section>
  <div class="xs muted" style="text-align:center">헬스 노트 v${APP_VERSION} · 종목 ${allEx(D()).length}개</div>`;
}

/* ---------- actions ---------- */
function go(tab) { if (tab === S.tab) return; S.tab = tab; S.confirm = null; history.pushState({ tab }, ""); render(); window.scrollTo(0, 0); }
window.addEventListener("popstate", (e) => { S.tab = (e.state && e.state.tab) || "summary"; S.confirm = null; render(); });
history.replaceState({ tab: S.tab }, "");
document.querySelector(".tabs").addEventListener("click", (e) => { const b = e.target.closest(".tab"); if (b) go(b.dataset.tab); });
$("#prevDay").onclick = () => { S.date = shiftDate(S.date, -1); S.confirm = null; S.editEx = null; render(); };
$("#nextDay").onclick = () => { S.date = shiftDate(S.date, 1); S.confirm = null; S.editEx = null; render(); };
$("#todayBtn").onclick = () => { S.date = todayStr(); render(); };

const findEntry = (id) => getDay(S.date).entries.find((e) => e.id === id);
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`; };
const backupText = () => JSON.stringify({ app: "health-note", v: 3, exportedAt: new Date().toISOString(), data: D() });
function stageImport(text) {
  try {
    const data = store.normalize(JSON.parse(text.trim()));
    S.pendingImport = { data, days: Object.keys(data.days).filter((d) => hasContent(data.days[d])).length, routines: data.routines.length, foods: data.myFoods.length };
    S.showPaste = false;
  } catch (e) { toast("불러올 수 없습니다: " + (e.message || "형식 오류")); }
  render();
}
function csvWorkouts() {
  const rows = [["날짜", "종목", "부위", "기록 방식", "세트", "세트 종류", "kg", "횟수", "초", "km", "RPE", "완료", "메모"]];
  for (const d of Object.keys(D().days).sort()) for (const e of D().days[d].entries) { const x = ex(e.exId); e.sets.forEach((s, i) => rows.push([d, x.name, partOfEx(x), TYPES[x.type], i + 1, { N: "일반", W: "워밍업", F: "실패", D: "드롭" }[s.t], s.kg, s.reps, s.sec, s.km, s.rpe, s.done ? "O" : "", i === 0 ? e.note : ""])); }
  return csv(rows);
}
function csvFoods() {
  const rows = [["날짜", "끼니", "음식", "기준", "수량", "g", "kcal", "단백질 g", "탄수 g"]];
  for (const d of Object.keys(D().days).sort()) for (const f of D().days[d].foods) { const k = factor(f); rows.push([d, MEALS.find((m) => m.k === f.meal).label, f.name, f.basis === "g" ? "100g당" : "1회분", f.basis === "g" ? "" : f.qty, f.basis === "g" ? f.g : "", Math.round(f.kcal * k), r1(f.p * k), r1(f.c * k)]); }
  return csv(rows);
}

$view.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-act]"); if (!b || b.disabled) return;
  const act = b.dataset.act, day = getDay(S.date);
  if (!["delex", "delmy", "delroutine", "delcombo", "delcustom"].includes(act)) S.confirm = null;
  const confirmDel = (id, fn) => { if (S.confirm === id) { fn(); S.confirm = null; return true; } S.confirm = id; render(); return false; };
  switch (act) {
    case "goto": go(b.dataset.tab); return;
    case "install": if (installEvt) { installEvt.prompt(); installEvt.userChoice.finally(() => { installEvt = null; render(); }); } return;
    case "dismissmig": D().migratedFrom.seen = true; break;
    case "startsess": day.session = { start: Date.now(), end: null }; break;
    case "endsess": if (day.session) day.session.end = Date.now(); toast(`운동 종료 · ${fmtDur(dayStats(day).dur)}`); break;
    case "resumesess": if (day.session) day.session.end = null; break;
    case "togglepicker": S.pickerOpen = !S.pickerOpen; S.creating = false; render(); if (S.pickerOpen) setTimeout(() => { const el = $("#pickQ"); if (el) el.focus(); }, 0); return;
    case "pickpart": S.pickPart = b.dataset.p || null; render(); return;
    case "creating": S.creating = !S.creating; render(); return;
    case "addex": { const r = addEntry(day, b.dataset.id); S.pickerOpen = false; S.pickQ = ""; S.creating = false; toast(r.from === "rec" ? "지난 기록으로 오늘 추천값을 채웠습니다." : r.from === "last" ? `지난 ${shortDate(r.last.date)} 세트를 채웠습니다.` : `${ex(b.dataset.id).name} 추가`); break; }
    case "moveex": { const i = day.entries.findIndex((e) => e.id === b.dataset.id), j = i + num(b.dataset.d); if (j < 0 || j >= day.entries.length) return; [day.entries[i], day.entries[j]] = [day.entries[j], day.entries[i]]; break; }
    case "editex": S.editEx = b.dataset.id || null; render(); return;
    case "superset": {
      const i = day.entries.findIndex((e) => e.id === b.dataset.id), a = day.entries[i], n = day.entries[i + 1];
      if (a.group && n.group === a.group) n.group = null;
      else { const used = new Set(day.entries.map((e) => e.group).filter(Boolean)); const g = a.group || "ABCDEFGH".split("").find((c) => !used.has(c)) || "Z"; a.group = g; n.group = g; }
      break;
    }
    case "applyrec": { const en = findEntry(b.dataset.id), rec = recommend(lastSession(en.exId, S.date), ex(en.exId), S.date); if (!rec) return; const done = en.sets.filter((s) => s.done); en.sets = [...done, ...rec.sets.slice(done.length).map(fromTpl)]; toast("추천값을 적용했습니다."); break; }
    case "addset": { const en = findEntry(b.dataset.id), last = en.sets[en.sets.length - 1]; en.sets.push(last ? { ...fromTpl(last), t: last.t === "D" ? "D" : "N" } : blankSet()); break; }
    case "warmup": {
      const en = findEntry(b.dataset.id), x = ex(en.exId), work = en.sets.find((s) => s.t !== "W" && num(s.kg));
      if (!work) { toast("본 세트 무게를 먼저 입력하세요."); return; }
      const ws = warmups(num(work.kg), x.equip, num(x.inc) || 2.5, num(D().settings.barKg) || 20);
      if (!ws.length) { toast("이 무게에는 워밍업 세트가 필요 없습니다."); return; }
      en.sets = [...ws.map((w) => ({ ...blankSet("W"), kg: w.kg, reps: w.reps })), ...en.sets.filter((s) => s.t !== "W" || s.done)];
      toast(`워밍업 ${ws.length}세트를 넣었습니다.`); break;
    }
    case "plates": S.plateFor = S.plateFor === b.dataset.id ? null : b.dataset.id; render(); return;
    case "delset": findEntry(b.dataset.id).sets.splice(+b.dataset.i, 1); break;
    case "type": { const s = findEntry(b.dataset.id).sets[+b.dataset.i]; s.t = SET_CYCLE[s.t] || "N"; break; }
    case "done": {
      const en = findEntry(b.dataset.id), i = +b.dataset.i, s = en.sets[i], x = ex(en.exId);
      s.done = !s.done; s.at = s.done ? Date.now() : null;
      if (s.done) {
        if (!hasValues(s)) { const last = lastSession(en.exId, S.date), ps = last && last.sets[i]; if (ps) Object.assign(s, { kg: ps.kg, reps: ps.reps, sec: ps.sec, km: ps.km }); }
        if (S.date === todayStr()) { if (!day.session) day.session = { start: Date.now(), end: null }; else if (day.session.end) day.session.end = null; }
        pbCache = new Map(); const f = prFlags(en, S.date)[i];
        if (f) toast(`신기록! ${x.name} ${f.map((k) => PR_LABEL[k]).join(" · ")}`, true);
      }
      break;
    }
    case "delex": if (!confirmDel(b.dataset.id, () => { day.entries = day.entries.filter((x) => x.id !== b.dataset.id); })) return; break;
    case "copyprev": { const src = D().days[b.dataset.from]; for (const e of src.entries) addEntry(day, e.exId, e.sets); const lb = groupLabels(src); src.entries.forEach((e, k) => { if (lb[e.id]) day.entries[day.entries.length - src.entries.length + k].group = e.group; }); toast(`${shortDate(b.dataset.from)} 종목을 불러왔습니다.`); break; }
    case "saveroutine": S.saveRoutine = !S.saveRoutine; render(); if (S.saveRoutine) setTimeout(() => { const el = $("#routineName"); if (el) el.focus(); }, 0); return;
    case "startroutine": { const r = D().routines.find((x) => x.id === b.dataset.id); for (const it of r.items) addEntry(day, it.exId, it.sets); toast(`${r.name} 루틴 ${r.items.length}종목을 추가했습니다.`); break; }
    case "delroutine": if (!confirmDel(b.dataset.id, () => { D().routines = D().routines.filter((x) => x.id !== b.dataset.id); })) return; break;
    case "delcustom": if (!confirmDel(b.dataset.id, () => { delete D().customEx[b.dataset.id]; delete D().exPrefs[b.dataset.id]; })) return; break;
    case "meal": S.meal = b.dataset.meal; render(); return;
    case "fbasis": S.fBasis = b.dataset.b; render(); return;
    case "quick": {
      const f = D().myFoods.find((x) => x.id === b.dataset.id);
      if (f.basis === "g") { day.foods.push(normFoodEntry({ ref: f.id, name: f.name, meal: S.meal, basis: "g", kcal: f.kcal, p: f.p, c: f.c, f: f.f, g: f.lastG || 100 })); toast(`${f.name} ${f.lastG || 100} g 추가 · 단백질 ${r1(f.p * (f.lastG || 100) / 100)} g`); }
      else { const e = day.foods.find((x) => x.ref === f.id && x.meal === S.meal && x.basis === "sv"); if (e) e.qty = num(e.qty) + 1; else day.foods.push(normFoodEntry({ ref: f.id, name: f.name, meal: S.meal, basis: "sv", kcal: f.kcal, p: f.p, c: f.c, f: f.f, qty: 1 })); toast(`${f.name} 추가 · 단백질 ${f.p} g`); }
      break;
    }
    case "addcombo": { const m = D().myMeals.find((x) => x.id === b.dataset.id); for (const it of m.items) day.foods.push(normFoodEntry({ ...it, id: uid(), meal: S.meal })); toast(`${m.name} 추가 · 단백질 ${r1(foodTotals(m.items).p)} g`); break; }
    case "delcombo": if (!confirmDel(b.dataset.id, () => { D().myMeals = D().myMeals.filter((x) => x.id !== b.dataset.id); })) return; break;
    case "savemeal": S.saveMeal = S.saveMeal === b.dataset.meal ? null : b.dataset.meal; render(); return;
    case "qty": { const x = day.foods.find((y) => y.id === b.dataset.id); x.qty = Math.max(0.5, r1(num(x.qty) + num(b.dataset.d))); break; }
    case "delfood": day.foods = day.foods.filter((x) => x.id !== b.dataset.id); break;
    case "editfood": S.editFood = b.dataset.id || null; S.efBasis = null; render(); return;
    case "efbasis": S.efBasis = b.dataset.b; render(); return;
    case "delmy": if (!confirmDel(b.dataset.id, () => { D().myFoods = D().myFoods.filter((x) => x.id !== b.dataset.id); S.editFood = null; })) return; break;
    case "openday": S.date = b.dataset.d; go("summary"); return;
    case "calprev": case "calnext": { const [y, m] = S.calMonth.split("-").map(Number), t = new Date(y, m - 1 + (act === "calnext" ? 1 : -1), 1); S.calMonth = `${t.getFullYear()}-${pad(t.getMonth() + 1)}`; render(); return; }
    case "bodymetric": S.bodyMetric = b.dataset.k; render(); return;
    case "export": download(`health-note-backup-${stamp()}.json`, backupText(), "application/json"); D().lastBackup = Date.now(); toast("백업 파일을 저장했습니다. 다운로드 폴더를 확인하세요."); break;
    case "csvwork": download(`health-note-workouts-${stamp()}.csv`, csvWorkouts(), "text/csv;charset=utf-8"); toast("운동 기록 CSV를 저장했습니다."); return;
    case "csvfood": download(`health-note-foods-${stamp()}.csv`, csvFoods(), "text/csv;charset=utf-8"); toast("식단 기록 CSV를 저장했습니다."); return;
    case "copybackup": {
      const done = () => { D().lastBackup = Date.now(); save(); toast("백업 코드를 복사했습니다. 메모 앱 등에 붙여넣어 두세요."); render(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(backupText()).then(done, () => toast("복사하지 못했습니다. 백업 파일 저장을 이용해 주세요."));
      else toast("복사하지 못했습니다. 백업 파일 저장을 이용해 주세요.");
      return;
    }
    case "importfile": $("#importFile").click(); return;
    case "togglepaste": S.showPaste = !S.showPaste; render(); return;
    case "readpaste": stageImport(($("#pasteBox") || {}).value || ""); return;
    case "cancelimport": S.pendingImport = null; render(); return;
    case "applyimport": {
      const inc = S.pendingImport.data;
      if (b.dataset.mode === "replace") S.data = inc;
      else {
        for (const [k, v] of Object.entries(inc.days)) if (hasContent(v)) D().days[k] = v;
        const ids = (arr) => new Set(arr.map((x) => x.id));
        const rIds = ids(D().routines); inc.routines.forEach((r) => { if (!rIds.has(r.id)) D().routines.push(r); });
        const fIds = ids(D().myFoods), fNames = new Set(D().myFoods.map((x) => x.name)); inc.myFoods.forEach((f) => { if (!fIds.has(f.id) && !fNames.has(f.name)) D().myFoods.push(f); });
        const mIds = ids(D().myMeals); inc.myMeals.forEach((m) => { if (!mIds.has(m.id)) D().myMeals.push(m); });
        Object.assign(D().customEx, inc.customEx); Object.assign(D().exPrefs, inc.exPrefs);
      }
      S.pendingImport = null; flush(); toast("백업을 적용했습니다."); render(); return;
    }
  }
  pbCache = new Map(); save(); render();
});
$("#importFile").addEventListener("change", (e) => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const rd = new FileReader(); rd.onload = () => stageImport(String(rd.result || "")); rd.onerror = () => toast("파일을 읽지 못했습니다."); rd.readAsText(f); e.target.value = "";
});
$view.addEventListener("input", (e) => {
  const el = e.target, bind = el.dataset.bind; if (!bind) return;
  const day = getDay(S.date);
  if (bind === "setf") {
    const en = findEntry(el.dataset.id), s = en.sets[+el.dataset.i], f = el.dataset.f, v = el.value.trim() === "" ? "" : num(el.value);
    if (f === "min") s.sec = v === "" ? "" : Math.round(v * 60); else s[f] = v;
    const foot = document.getElementById("foot-" + en.id); if (foot) { const x = ex(en.exId); foot.innerHTML = exFoot(entryStats(en, x.type, bwAt(S.date)), x.type); }
    save();
  } else if (bind === "note") { findEntry(el.dataset.id).note = el.value; save(); }
  else if (bind === "body") { day.body[el.dataset.k] = el.value.trim() === "" ? null : num(el.value); save(); }
  else if (bind === "grams") { const x = day.foods.find((y) => y.id === el.dataset.id); x.g = num(el.value); const f = D().myFoods.find((m) => m.id === x.ref); if (f && x.g > 0) f.lastG = x.g; const m = document.getElementById("meta-" + x.id); if (m) m.innerHTML = foodMeta(x, factor(x)); save(); }
  else if (bind === "pickq") { S.pickQ = el.value; const l = $("#pickList"); if (l) l.innerHTML = pickerResults(); }
});
$view.addEventListener("change", (e) => {
  const el = e.target, bind = el.dataset.bind; if (!bind) return;
  if (bind === "set") { const k = el.dataset.k; let v = el.value; if (k === "kcalOverride") v = v.trim() === "" ? null : num(v); else if (k !== "sex") v = num(v); D().settings[k] = v; save(); el.tagName === "SELECT" ? render() : requestRender(); }
  else if (bind === "flag") { D().settings[el.dataset.k] = el.checked; save(); render(); }
  else if (bind === "histex") { S.histEx = el.value; render(); }
});
$view.addEventListener("submit", (e) => {
  e.preventDefault();
  const day = getDay(S.date), form = e.target, val = (id) => (document.getElementById(id) || {}).value || "";
  if (form.id === "routineForm") {
    const name = val("routineName").trim(); if (!name) return;
    const items = day.entries.map((en) => ({ exId: en.exId, sets: en.sets.map((s) => ({ t: s.t, kg: s.kg, reps: s.reps, sec: s.sec, km: s.km })) }));
    const old = D().routines.find((r) => r.name === name); if (old) old.items = items; else D().routines.push({ id: uid(), name, items });
    S.saveRoutine = false; toast(`루틴 "${name}"을 ${old ? "덮어썼습니다" : "저장했습니다"}.`);
  } else if (form.id === "newExForm") {
    const name = val("nx-name").trim(); if (!name) return;
    const existing = store.findExByName(D(), name);
    let id = existing;
    if (!existing) { id = "c:" + uid(); const equip = val("nx-eq") || "other"; D().customEx[id] = { id, name, type: val("nx-type") || "wr", equip, primary: PART_MUSCLE[val("nx-part")] || "chest", secondary: [], aliases: [], custom: true }; }
    addEntry(day, id); S.pickerOpen = false; S.creating = false; S.pickQ = "";
    toast(existing ? `이미 있는 종목 "${ex(id).name}"을 추가했습니다.` : `새 종목 "${name}"을 만들었습니다.`);
  } else if (form.classList.contains("exEdit")) {
    const id = form.dataset.ex, x = ex(id), repMin = Math.max(1, num(val("ee-min")) || 8), repMax = Math.max(repMin, num(val("ee-max")) || 12), inc = num(val("ee-inc")) || EQUIP_INC[x.equip] || 2.5, primary = val("ee-prim") || x.primary;
    if (x.custom && D().customEx[id]) Object.assign(D().customEx[id], { name: val("ee-name").trim() || x.name, type: val("ee-type") || x.type, equip: val("ee-eq") || x.equip });
    D().exPrefs[id] = { repMin, repMax, inc, primary };
    S.editEx = null; toast("종목 설정을 저장했습니다.");
  } else if (form.classList.contains("mealForm")) {
    const mk = form.dataset.meal, name = val("mealName-" + mk).trim(); if (!name) return;
    D().myMeals.push({ id: uid(), name, items: day.foods.filter((x) => x.meal === mk).map((x) => normFoodEntry({ ...x, id: uid() })) });
    S.saveMeal = null; toast(`"${name}"을 내 식사로 저장했습니다.`);
  } else if (form.id === "addFoodForm") {
    const name = val("fName").trim(); if (!name) return;
    const basis = S.fBasis === "g" ? "g" : "sv", item = { name, basis, kcal: num(val("fKcal")), p: num(val("fP")), c: num(val("fC")), f: 0 };
    const g = basis === "g" ? (num(val("fG")) || 100) : null, ref = uid();
    if (document.getElementById("fSave").checked) D().myFoods.push(normMyFood({ id: ref, ...item, lastG: g || undefined }));
    day.foods.push(normFoodEntry({ ref, ...item, meal: S.meal, qty: 1, g })); toast(`${name} 추가`);
  } else if (form.classList.contains("editFood")) {
    const f = D().myFoods.find((x) => x.id === form.dataset.id);
    Object.assign(f, normMyFood({ id: f.id, name: val("ef-name").trim() || f.name, basis: S.efBasis || f.basis, kcal: val("ef-k"), p: val("ef-p"), c: val("ef-c"), f: f.f, lastG: f.lastG }));
    S.editFood = null; S.efBasis = null; toast("내 음식을 수정했습니다. 이미 기록한 날짜에는 반영되지 않습니다.");
  }
  pbCache = new Map(); save(); render();
});

/* ---------- boot ---------- */
render();
store.loadData().then(({ data, migrated }) => {
  S.data = data; S.ready = true; render();
  if (migrated) toast("기존 기록을 v3로 옮겼습니다.");
}).catch((err) => { S.ready = true; S.storageOk = false; render(); console.error(err); });
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => {});
window.__hn = { S, store, D }; // test hook
