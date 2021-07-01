import {
  mix,
  round,
  bin,
  cubicBezier,
  clamp,
  between,
  toRad,
  toDeg,
  cubicBezierYForX,
  dist,
  approximates,
  step,
  smoothstep,
} from "../Math";
import { vec } from "../Vectors";

test("bin()", () => {
  expect(bin(true)).toBe(1);
  expect(bin(false)).toBe(0);
});

test("round()", () => {
  expect(round(5.123, 0)).toBe(5);
  expect(round(5.123, 1)).toBe(5.1);
  expect(round(5.123, 2)).toBe(5.12);
  expect(round(5.123, 3)).toBe(5.123);
});

test("mix()", () => {
  expect(mix(0, 10, 20)).toBe(10);
  expect(mix(1, 10, 20)).toBe(20);
  expect(mix(0.5, 10, 20)).toBe(15);
  expect(mix(0.25, 10, 20)).toBe(12.5);
  expect(mix(0.8, 10, 20)).toBe(18);
  expect(mix(1.5, 10, 20)).toBe(25);
});

test("cubicBezier()", () => {
  expect(cubicBezier(1, 0, 0.1, 0.1, 1)).toBe(1);
  expect(cubicBezier(0, 0, 0.1, 0.1, 1)).toBe(0);
});

test("clamp()", () => {
  expect(clamp(-1, 0, 100)).toBe(0);
  expect(clamp(1, 0, 100)).toBe(1);
  expect(clamp(101, 0, 100)).toBe(100);
});

test("between()", () => {
  expect(between(-1, 0, 100)).toBe(false);
  expect(between(0, 0, 100)).toBe(true);
  expect(between(0, 0, 100, false)).toBe(false);
});

test("toRad()", () => {
  expect(toRad(180)).toBe(Math.PI);
  expect(toDeg(Math.PI)).toBe(180);
  expect(toDeg(Math.PI / 4)).toBe(45);
});

test("cubicBezierYForX()", () => {
  const x = 198;
  const y = 94;
  const a = vec.create(20, 250);
  const b = vec.create(30, 20);
  const c = vec.create(203, 221);
  const d = vec.create(220, 20);
  expect(Math.round(cubicBezierYForX(x, a, b, c, d))).toBe(y);
});

test("cubicBezierYForX2()", () => {
  const x = 116;
  const y = 139;
  const a = vec.create(59, 218);
  const b = vec.create(131, 39);
  const c = vec.create(204, 223);
  const d = vec.create(227, 89);
  expect(Math.round(cubicBezierYForX(x, a, b, c, d))).toBe(y);
});

test("dist()", () => {
  const v1 = { x: 0, y: 0 };
  const v2 = { x: 100, y: 100 };
  expect(dist(v1, v2)).toBe(Math.sqrt(100 ** 2 + 100 ** 2));
});

test("approximates()", () => {
  expect(approximates(1, 1)).toBe(true);
  expect(approximates(1, 1.001)).toBe(true);
  expect(approximates(1, 1.0011)).toBe(false);
  expect(approximates(1, 2, 1)).toBe(true);
});

test("step()", () => {
  expect(step(1.5, 1)).toBe(1);
  expect(step(0.5, 1)).toBe(0);
});

test("smoothstep()", () => {
  expect(smoothstep(1.5, 1, 2)).toBe(0.5);
  expect(smoothstep(0.5, 1, 2)).toBe(0);
});
