// Storage + data model for Health Note v3.
// The whole state is one JSON document kept in IndexedDB (falls back to localStorage).
// v1 (Claude artifact) and v2 (localStorage "healthnote.v2") data are migrated; the v2 copy is left untouched.
import { EXERCISES, EQUIP_INC, PART_MUSCLE, MUSCLE_PART } from "./exercises.js";
import { num } from "./calc.js";

export const V2_KEY = "healthnote.v2";
const LS_FALLBACK = "healthnote.v3";
const DB_NAME = "healthnote", STORE = "kv", KEY = "state";

export const MEALS = [{ k: "b", label: "아침" }, { k: "l", label: "점심" }, { k: "d", label: "저녁" }, { k: "s", label: "간식" }];
export const DEFAULT_SETTINGS = {
  sex: "m", age: 22, height: 175, weight: 70, activity: 1.55, goal: 0, gPerKg: 1.6, kcalOverride: null, fatPct: 25,
  wakeLock: true, barKg: 20, prefillRec: true
};
// Approximate reference values (USDA FoodData Central basis); packaged products vary.
export const DEFAULT_FOODS = [
  { id: "f-chicken", name: "닭가슴살(익힘)", basis: "g", kcal: 165, p: 31, c: 0, f: 3.6, lastG: 100 },
  { id: "f-egg", name: "계란 1개", basis: "sv", kcal: 72, p: 6.3, c: 0.4, f: 4.8 },
  { id: "f-whey", name: "프로틴 1스쿱(30g)", basis: "sv", kcal: 120, p: 24, c: 3, f: 1.5 },
  { id: "f-rice", name: "흰쌀밥 210g", basis: "sv", kcal: 273, p: 5.7, c: 59, f: 0.6 },
  { id: "f-banana", name: "바나나 1개", basis: "sv", kcal: 105, p: 1.3, c: 27, f: 0.4 },
  { id: "f-yogurt", name: "그릭요거트(무가당)", basis: "g", kcal: 59, p: 10, c: 3.6, f: 0.4, lastG: 100 },
  { id: "f-milk", name: "우유 200ml", basis: "sv", kcal: 125, p: 6.5, c: 9.6, f: 6.6 }
];
const G_BASIS_V1 = { "f-chicken": "닭가슴살(익힘)", "f-yogurt": "그릭요거트(무가당)" };
const SET_TYPES = ["N", "W", "F", "D"];

export function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
export const norm = (s) => String(s || "").replace(/\s+/g, "").toLowerCase();

export function defaultData() {
  return { v: 3, settings: { ...DEFAULT_SETTINGS }, days: {}, routines: [], myFoods: DEFAULT_FOODS.map((x) => ({ ...x })), myMeals: [],
    customEx: {}, exPrefs: {}, lastBackup: null, migratedFrom: null };
}

/* ---------- exercise lookup ---------- */
const BUILTIN = new Map(EXERCISES.map((e) => [e.id, e]));
const BY_NAME = new Map();
for (const e of EXERCISES) { BY_NAME.set(norm(e.name), e.id); for (const a of e.aliases) if (!BY_NAME.has(norm(a))) BY_NAME.set(norm(a), e.id); }

export function getEx(data, id) {
  const base = BUILTIN.get(id) || data.customEx[id];
  if (!base) return { id, name: "삭제된 종목", type: "wr", equip: "other", primary: "chest", secondary: [], custom: true, repMin: 8, repMax: 12, inc: 2.5, missing: true };
  const pref = data.exPrefs[id] || {};
  return { repMin: 8, repMax: 12, inc: EQUIP_INC[base.equip] ?? 2.5, ...base, ...pref };
}
export function allEx(data) { return [...EXERCISES, ...Object.values(data.customEx)].map((e) => getEx(data, e.id)); }
export function findExByName(data, name) {
  const n = norm(name); if (!n) return null;
  if (BY_NAME.has(n)) return BY_NAME.get(n);
  const c = Object.values(data.customEx).find((e) => norm(e.name) === n);
  return c ? c.id : null;
}
export function partOfEx(ex) { return MUSCLE_PART[ex.primary] || "기타"; }

/* ---------- normalisers ---------- */
function normSet(s) {
  const v = (x) => (x === "" || x == null ? "" : num(x));
  return { t: SET_TYPES.includes(s.t) ? s.t : "N", kg: v(s.kg), reps: v(s.reps), sec: v(s.sec), km: v(s.km), rpe: v(s.rpe), done: !!s.done, at: s.at || null };
}
export function normFoodEntry(x) {
  const basis = x.basis === "g" ? "g" : "sv";
  return { id: x.id || uid(), ref: x.ref || null, name: String(x.name || "음식"), meal: MEALS.some((m) => m.k === x.meal) ? x.meal : "s", basis,
    kcal: num(x.kcal), p: num(x.p), c: num(x.c), f: num(x.f), qty: basis === "sv" ? (num(x.qty) || 1) : 1, g: basis === "g" ? (num(x.g) || 100) : null };
}
export function normMyFood(f) {
  const basis = f.basis === "g" ? "g" : "sv";
  return { id: f.id || uid(), name: String(f.name || "음식"), basis, kcal: num(f.kcal), p: num(f.p), c: num(f.c), f: num(f.f), lastG: basis === "g" ? (num(f.lastG) || 100) : undefined };
}
function normEntry(e) { return { id: e.id || uid(), exId: String(e.exId), group: e.group || null, note: e.note || "", sets: (e.sets || []).map(normSet) }; }
export function normDay(date, d) {
  d = d || {};
  return {
    date,
    entries: (d.entries || []).map(normEntry),
    foods: (d.foods || []).map(normFoodEntry),
    body: { w: d.body?.w ?? null, fat: d.body?.fat ?? null, mm: d.body?.mm ?? null },
    session: d.session && d.session.start ? { start: d.session.start, end: d.session.end || null } : null
  };
}

/* ---------- migration from v1/v2 ---------- */
const PART_KO = ["가슴", "등", "하체", "어깨", "팔", "코어"];
function guessMuscle(name) {
  const n = norm(name);
  if (/전완|손목|그립/.test(n)) return "forearm";
  if (/레그레이즈|플랭크|크런치|롤아웃|복근|싯업|코어/.test(n)) return "abs";
  if (/스쿼트|레그|런지|카프|굿모닝|하체|스플릿/.test(n)) return "quads";
  if (/힙|둔근|글루트/.test(n)) return "glutes";
  if (/트라이셉|삼두|푸시다운|푸쉬다운|킥백/.test(n)) return "triceps";
  if (/이두|바이셉|컬/.test(n)) return "biceps";
  if (/후면|리어|페이스풀/.test(n)) return "rdelt";
  if (/레터럴|레레|사레레/.test(n)) return "sdelt";
  if (/오버헤드|오버해드|숄더|밀리터리|어깨/.test(n)) return "fdelt";
  if (/로우|풀업|친업|풀다운|랫|턱걸이|등/.test(n)) return "lats";
  if (/벤치|체스트|플라이|펙덱|딥스|푸시업|가슴/.test(n)) return "chest";
  return null;
}
function legacyExId(data, name, part, report) {
  const found = findExByName(data, name);
  if (found) return found;
  const id = "c:" + uid();
  const primary = PART_KO.includes(part) ? PART_MUSCLE[part] : (guessMuscle(name) || "chest");
  data.customEx[id] = { id, name: String(name || "이름 없는 종목"), type: "wr", equip: "other", primary, secondary: [], aliases: [], custom: true };
  report.custom.push(name);
  return id;
}
function legacySets(sets, ex, bw, report, name) {
  return (sets || []).map((s) => {
    const out = normSet(s);
    // v2 had kg × reps only. Bodyweight exercises logged with the body weight in kg: keep the reps, convert the load.
    if ((ex.type === "bw" || ex.type === "bwp") && out.kg !== "" && out.kg >= bw * 0.6) {
      out.kg = ex.type === "bwp" ? Math.max(0, Math.round(out.kg - bw)) : "";
      report.bodyweight.add(name);
    }
    return out;
  });
}
export function migrateLegacy(o) {
  const data = defaultData();
  const report = { custom: [], bodyweight: new Set(), from: "" };
  const isV2 = o.v === 2 || (o.app === "health-note" && o.v === 2);
  const src = isV2 ? (o.data || o) : null;
  data.settings = { ...DEFAULT_SETTINGS, ...(isV2 ? src.settings : o.profile && o.profile.settings) };
  delete data.settings.rest; delete data.settings.sound; delete data.settings.vibrate;
  const bw = num(data.settings.weight) || 70;
  const exParts = (isV2 && src.exParts) || {};
  const foodsSrc = isV2 ? src.myFoods : (o.profile && o.profile.myFoods);
  if (Array.isArray(foodsSrc)) data.myFoods = foodsSrc.map((f) => G_BASIS_V1[f.id] && !isV2 ? normMyFood({ ...f, name: G_BASIS_V1[f.id], basis: "g", lastG: 100 }) : normMyFood(f));
  for (const [date, d] of Object.entries((isV2 ? src.days : o.days) || {})) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const day = normDay(date, isV2 ? d : null);
    day.entries = (d.workouts || []).map((w) => {
      const exId = legacyExId(data, w.name, w.part || exParts[w.name], report);
      return { id: w.id || uid(), exId, group: null, note: w.note || "", sets: legacySets(w.sets, getEx(data, exId), bw, report, w.name) };
    });
    if (!isV2) {
      day.foods = (d.foods || []).map((x) => G_BASIS_V1[x.ref] ? normFoodEntry({ ...x, name: G_BASIS_V1[x.ref], basis: "g", g: (num(x.qty) || 1) * 100, meal: "s" }) : normFoodEntry({ ...x, basis: "sv", meal: "s" }));
      day.body.w = d.bodyWeight ?? null;
    }
    data.days[date] = day;
  }
  if (isV2) {
    data.routines = (src.routines || []).map((r) => ({ id: r.id || uid(), name: String(r.name || "루틴"), items: (r.items || []).map((it) => {
      const exId = legacyExId(data, it.name, it.part, report);
      return { exId, sets: legacySets(it.sets, getEx(data, exId), bw, report, it.name).map(({ t, kg, reps }) => ({ t, kg, reps })) };
    }) }));
    data.myMeals = (src.myMeals || []).map((m) => ({ id: m.id || uid(), name: String(m.name || "내 식사"), items: (m.items || []).map(normFoodEntry) }));
    data.lastBackup = src.lastBackup || null;
  }
  data.migratedFrom = { v: isV2 ? 2 : 1, at: Date.now(), custom: report.custom, bodyweight: [...report.bodyweight] };
  return data;
}
export function normalize(o) {
  if (!o || typeof o !== "object") throw new Error("형식이 올바르지 않습니다.");
  const d = o.app === "health-note" && o.data ? o.data : o;
  if (d.v === 3) {
    const out = defaultData();
    out.settings = { ...DEFAULT_SETTINGS, ...(d.settings || {}) };
    for (const [k, v] of Object.entries(d.days || {})) if (/^\d{4}-\d{2}-\d{2}$/.test(k)) out.days[k] = normDay(k, v);
    out.routines = (d.routines || []).map((r) => ({ id: r.id || uid(), name: String(r.name || "루틴"), items: (r.items || []).map((it) => ({ exId: String(it.exId), sets: (it.sets || []).map((s) => ({ t: s.t || "N", kg: s.kg ?? "", reps: s.reps ?? "", sec: s.sec ?? "", km: s.km ?? "" })) })) }));
    out.myFoods = Array.isArray(d.myFoods) ? d.myFoods.map(normMyFood) : out.myFoods;
    out.myMeals = (d.myMeals || []).map((m) => ({ id: m.id || uid(), name: String(m.name || "내 식사"), items: (m.items || []).map(normFoodEntry) }));
    out.customEx = { ...(d.customEx || {}) }; out.exPrefs = { ...(d.exPrefs || {}) };
    out.lastBackup = d.lastBackup || null; out.migratedFrom = d.migratedFrom || null;
    return out;
  }
  if (d.v === 2 || d.days || d.profile) return migrateLegacy(o.app === "health-note" ? o : d);
  throw new Error("헬스 노트 백업 파일이 아닙니다.");
}

/* ---------- persistence ---------- */
let dbp = null;
function idb() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    if (!("indexedDB" in window)) return rej(new Error("no idb"));
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function idbGet() { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction(STORE).objectStore(STORE).get(KEY); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function idbPut(v) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(v, KEY); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }

export let backend = "idb";
// Returns { data, migrated: null | {v, custom, bodyweight} }.
export async function loadData() {
  let raw = null;
  try { raw = await idbGet(); } catch (e) { backend = "ls"; }
  if (!raw && backend === "ls") { try { raw = JSON.parse(localStorage.getItem(LS_FALLBACK) || "null"); } catch (e) {} }
  if (raw) return { data: normalize(raw), migrated: null };
  let legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(V2_KEY) || "null"); } catch (e) {}
  if (legacy) { const data = normalize(legacy); await saveData(data); return { data, migrated: data.migratedFrom }; }
  return { data: defaultData(), migrated: null };
}
export async function saveData(data) {
  for (const k of Object.keys(data.days)) { const d = data.days[k]; if (!d.entries.length && !d.foods.length && !d.body.w && !d.body.fat && !d.body.mm && !d.session) delete data.days[k]; }
  const snapshot = JSON.parse(JSON.stringify(data));
  if (backend === "idb") { try { await idbPut(snapshot); return true; } catch (e) { backend = "ls"; } }
  try { localStorage.setItem(LS_FALLBACK, JSON.stringify(snapshot)); return true; } catch (e) { return false; }
}
