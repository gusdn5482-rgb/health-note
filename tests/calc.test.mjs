// Run: node tests/calc.test.mjs
import assert from "node:assert/strict";
import { e1rm, recommend, plates, warmups, entryStats, setVolume, csv, roundTo, foodTotals, bmr } from "../js/calc.js";
import { EXERCISES } from "../js/exercises.js";

let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const S = (kg, reps, t = "N", done = true) => ({ kg, reps, t, done });

t("Epley e1RM", () => { assert.equal(Math.round(e1rm(100, 5) * 10) / 10, 116.7); assert.equal(e1rm(100, 1), 100); assert.equal(e1rm(0, 5), 0); });
t("roundTo handles 2.5 steps", () => { assert.equal(roundTo(61.2, 2.5), 60); assert.equal(roundTo(63.8, 2.5), 65); });

const bench = { type: "wr", repMin: 8, repMax: 12, inc: 2.5 };
t("progression: all sets at top -> +inc, reps reset", () => {
  const r = recommend({ date: "2026-11-01", sets: [S(20, 10, "W"), S(60, 12), S(60, 12), S(60, 12)] }, bench, "2026-11-04");
  assert.equal(r.up, true);
  assert.deepEqual(r.sets.map((s) => [s.t, s.kg, s.reps]), [["W", 20, 10], ["N", 62.5, 8], ["N", 62.5, 8], ["N", 62.5, 8]]);
});
t("progression: pyramid keeps lighter sets", () => {
  const r = recommend({ date: "2026-10-27", sets: [S(40, 15), S(60, 12), S(60, 12), S(40, 20)] }, bench, "2026-11-04");
  assert.deepEqual(r.sets.map((s) => [s.kg, s.reps]), [[40, 15], [62.5, 8], [62.5, 8], [40, 20]]);
});
t("progression: not all at top -> same kg, reps +1 capped", () => {
  const r = recommend({ date: "2026-11-01", sets: [S(60, 12), S(60, 10), S(60, 7)] }, bench, "2026-11-04");
  assert.equal(r.up, false);
  assert.deepEqual(r.sets.map((s) => [s.kg, s.reps]), [[60, 12], [60, 11], [60, 8]]);
});
t("progression: >14 day gap -> 10% lower, floored to inc", () => {
  const r = recommend({ date: "2026-10-01", sets: [S(60, 10), S(60, 10)] }, bench, "2026-11-04");
  assert.deepEqual(r.sets.map((s) => s.kg), [52.5, 52.5]);
});
t("progression: assisted pull-up lowers assistance", () => {
  const r = recommend({ date: "2026-11-01", sets: [S(30, 12), S(30, 12)] }, { type: "bwa", repMin: 8, repMax: 12, inc: 5 }, "2026-11-04");
  assert.deepEqual(r.sets.map((s) => [s.kg, s.reps]), [[25, 8], [25, 8]]);
});
t("progression: none for time/dist or without history", () => {
  assert.equal(recommend(null, bench, "2026-11-04"), null);
  assert.equal(recommend({ date: "2026-11-01", sets: [S(0, 0)] }, { type: "time" }, "2026-11-04"), null);
});
t("plates per side", () => {
  assert.deepEqual(plates(100, 20).perSide, [25, 15]);
  assert.deepEqual(plates(62.5, 20).perSide, [20, 1.25]);
  assert.equal(plates(15, 20).under, true);
});
t("warm-up ramp for 100 kg barbell", () => {
  assert.deepEqual(warmups(100, "barbell", 2.5, 20), [{ kg: 20, reps: 10 }, { kg: 50, reps: 8 }, { kg: 70, reps: 5 }, { kg: 85, reps: 2 }]);
  assert.deepEqual(warmups(20, "dumbbell", 2), [{ kg: 10, reps: 10 }, { kg: 14, reps: 5 }]);
});
t("volume by type (bodyweight 70)", () => {
  assert.equal(setVolume(S(60, 10), "wr", 70), 600);
  assert.equal(setVolume(S(10, 5), "bwp", 70), 400);
  assert.equal(setVolume(S(20, 10), "bwa", 70), 500);
  assert.equal(setVolume(S("", 10), "bw", 70), 700);
  const st = entryStats({ sets: [S(20, 10, "W"), S(60, 10), S(60, 8, "F")] }, "wr", 70);
  assert.equal(st.vol, 1080); assert.equal(st.top, 60); assert.equal(st.done, 3);
});
t("CSV escaping + BOM", () => { assert.equal(csv([["a", 'b,"c"'], [1, null]]), '﻿a,"b,""c"""\r\n1,'); });
t("food totals g + serving", () => {
  const ft = foodTotals([{ basis: "g", g: 150, kcal: 165, p: 31, c: 0, f: 3.6 }, { basis: "sv", qty: 1, kcal: 120, p: 24, c: 3, f: 1.5 }]);
  assert.equal(ft.kcal, 367.5); assert.equal(Math.round(ft.p * 10) / 10, 70.5);
});
t("BMR Mifflin–St Jeor", () => { assert.equal(bmr({ sex: "m", w: 70, h: 175, a: 22 }), 1688.75); });
t("exercise ids unique, types valid", () => {
  const ids = new Set(EXERCISES.map((e) => e.id)); assert.equal(ids.size, EXERCISES.length);
  for (const e of EXERCISES) assert.ok(["wr", "bw", "bwp", "bwa", "time", "dist"].includes(e.type), e.name);
});
console.log(`${n} tests passed, ${EXERCISES.length} exercises`);
