// Pure calculation helpers for Health Note v3 (no DOM, unit-tested in tests/calc.test.mjs).

export function num(v) { const n = parseFloat(String(v ?? "").replace(",", ".")); return Number.isFinite(n) ? n : 0; }
export function r1(n) { return Math.round(n * 10) / 10; }
export function roundTo(x, inc) { if (!inc) return r1(x); return Math.round(Math.round(x / inc) * inc * 1000) / 1000; }
export function floorTo(x, inc) { if (!inc) return r1(x); return Math.round(Math.floor(x / inc + 1e-9) * inc * 1000) / 1000; }

/* ---------- dates ---------- */
export function parseD(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
export function daysBetween(a, b) { return Math.round((parseD(b) - parseD(a)) / 86400000); }

/* ---------- sets ---------- */
// Set types: N normal, W warm-up, F failure, D drop. Warm-ups never count toward stats.
export const isWorking = (s) => !!s && s.done && s.t !== "W";
export function e1rm(kg, reps) { kg = num(kg); reps = num(reps); if (!kg || !reps) return 0; return reps === 1 ? kg : kg * (1 + reps / 30); } // Epley

// Effective load in kg for strength stats; null where load is not meaningful.
export function setLoad(s, type, bw) {
  const kg = num(s.kg);
  if (type === "wr") return kg;
  if (type === "bwp") return num(bw) + kg;
  if (type === "bwa") return Math.max(0, num(bw) - kg);
  if (type === "bw") return num(bw);
  return null;
}
export function setVolume(s, type, bw) { const load = setLoad(s, type, bw); return load == null ? 0 : load * num(s.reps); }

export function entryStats(entry, type, bw) {
  let vol = 0, best = 0, top = 0, reps = 0, sec = 0, km = 0, done = 0;
  for (const s of entry.sets) {
    if (s.done) done++;
    if (!isWorking(s)) continue;
    vol += setVolume(s, type, bw);
    const load = setLoad(s, type, bw);
    if (load != null && num(s.reps)) best = Math.max(best, e1rm(load, s.reps));
    if (type === "wr" || type === "bwp") top = Math.max(top, num(s.kg));
    reps = Math.max(reps, num(s.reps)); sec = Math.max(sec, num(s.sec)); km = Math.max(km, num(s.km));
  }
  return { vol, best, top, reps, sec, km, done, total: entry.sets.length };
}

// One comparable "score" per set for personal records, by exercise type.
export function prScores(s, type, bw) {
  if (type === "wr" || type === "bwp") return { e: e1rm(setLoad(s, type, bw), s.reps), w: num(s.kg) };
  if (type === "bw") return { r: num(s.reps) };
  if (type === "time") return { sec: num(s.sec) };
  if (type === "dist") return { km: num(s.km) };
  return {};
}

/* ---------- progression (double progression) ----------
   last: { date, sets:[{t,kg,reps,done}] } = the most recent previous session of this exercise.
   ex: { type, repMin, repMax, inc }. today: "YYYY-MM-DD".
   Returns { sets:[{t,kg,reps}], up:boolean, note } or null when there is nothing to base it on. */
export function recommend(last, ex, today) {
  if (!last || !["wr", "bwp", "bwa"].includes(ex.type)) return null;
  const work = last.sets.filter((s) => s.t !== "W" && s.t !== "D" && num(s.reps) > 0 && (s.done || s.kg !== "" ));
  if (!work.length) return null;
  const repMin = num(ex.repMin) || 8, repMax = Math.max(num(ex.repMax) || 12, repMin), inc = num(ex.inc) || 2.5;
  const allTop = work.every((s) => num(s.reps) >= repMax);
  const gap = today ? daysBetween(last.date, today) : 0;
  const heavy = Math.max(...work.map((s) => num(s.kg)));
  let up = false, note;
  const sets = last.sets.map((s) => {
    if (s.t === "W" || s.t === "D") return { t: s.t, kg: s.kg, reps: s.reps };
    let kg = num(s.kg), reps = num(s.reps);
    if (allTop) {
      if (ex.type === "bwa") { kg = Math.max(0, kg - inc); reps = repMin; }
      else if (num(s.kg) === heavy) { kg += inc; reps = repMin; }
      // lighter back-off / pyramid sets stay as they were
    } else if (reps < repMin) reps = repMin;
    else reps = Math.min(repMax, reps + 1);
    return { t: s.t === "F" ? "N" : s.t, kg: roundTo(kg, inc), reps };
  });
  if (allTop) { up = true; note = ex.type === "bwa" ? `모든 세트 ${repMax}회 달성 → 보조 ${inc} kg 줄이기` : `모든 세트 ${repMax}회 달성 → ${inc} kg 올리기`; }
  else note = `같은 무게로 ${repMax}회까지 횟수 늘리기`;
  if (gap > 14 && ex.type !== "bwa") {
    for (const s of sets) if (s.t !== "W" && s.t !== "D") s.kg = floorTo(num(s.kg) * 0.9, inc);
    note = `${gap}일 쉬었으니 10% 낮춰 시작`; up = false;
  }
  return { sets, up, note, repMin, repMax };
}

/* ---------- plates & warm-ups ---------- */
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export function plates(target, bar = 20, avail = DEFAULT_PLATES) {
  target = num(target); bar = num(bar);
  if (target <= bar) return { perSide: [], rest: r1(Math.max(0, target - bar)), under: target < bar };
  let side = (target - bar) / 2; const out = [];
  for (const p of [...avail].sort((a, b) => b - a)) { while (side + 1e-9 >= p) { out.push(p); side -= p; } }
  return { perSide: out, rest: r1(side * 2), under: false };
}
// Warm-up ramp toward the first working weight; barbell starts with the empty bar.
export function warmups(workKg, equip, inc = 2.5, bar = 20) {
  workKg = num(workKg); if (!workKg) return [];
  const barbell = equip === "barbell" || equip === "smith";
  const steps = barbell ? [[0.5, 8], [0.7, 5], [0.85, 2]] : [[0.5, 10], [0.75, 5]];
  const out = []; let prev = 0;
  if (barbell && workKg > bar * 1.5) { out.push({ kg: bar, reps: 10 }); prev = bar; }
  for (const [p, reps] of steps) {
    const kg = floorTo(workKg * p, inc);
    if (kg > prev && kg < workKg && (!barbell || kg > bar)) { out.push({ kg, reps }); prev = kg; }
  }
  return out;
}

/* ---------- nutrition & body ---------- */
export function bmr({ sex, w, h, a }) { return 10 * w + 6.25 * h - 5 * a + (sex === "f" ? -161 : 5); } // Mifflin–St Jeor
export function factor(x) { return x.basis === "g" ? num(x.g) / 100 : num(x.qty || 1); }
export function foodTotals(list) {
  const t = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const x of list) { const k = factor(x); t.kcal += num(x.kcal) * k; t.p += num(x.p) * k; t.c += num(x.c) * k; t.f += num(x.f) * k; }
  return t;
}

/* ---------- CSV ---------- */
export function csv(rows) {
  const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
