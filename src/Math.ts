import { Vector } from "./Vectors";

/**
 * @summary Convert a boolean value into a number.
 * This can be useful in reanimated since 0 and 1 are used for conditional statements.
 * @worklet
 */
export const bin = (value: boolean): 0 | 1 => {
  "worklet";
  return value ? 1 : 0;
};

/**
 * @summary generate a step function by comparing two values
 * @worklet
 */
export const step = (value: number, edge: number) => {
  "worklet";
  return value < edge ? 0 : 1;
};

/**
 * @summary Perform Hermite interpolation between two values
 * @worklet
 */
export const smoothstep = (value: number, edge0: number, edge1: number) => {
  "worklet";
  // Scale, bias and saturate x to 0..1 range
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  // Evaluate polynomial
  return x * x * (3 - 2 * x);
};

/**
 * Linear interpolation
 * @param value
 * @param x
 * @param y
 * @worklet
 */
export const mix = (value: number, x: number, y: number) => {
  "worklet";
  return x * (1 - value) + y * value;
};

/**
 * @summary Transforms an angle from radians to degrees.
 * @worklet
 */
export const toDeg = (rad: number) => {
  "worklet";
  return (rad * 180) / Math.PI;
};

/**
 * @summary Transforms an angle from degrees to radians.
 * @worklet
 */
export const toRad = (deg: number) => {
  "worklet";
  return (deg * Math.PI) / 180;
};

/**
 *
 * @summary Returns the average value
 * @worklet
 */
export const avg = (values: number[]) => {
  "worklet";
  return values.reduce((a, v) => a + v, 0) / values.length;
};

/**
 * @summary Returns true if node is within lowerBound and upperBound.
 * @worklet
 */
export const between = (
  value: number,
  lowerBound: number,
  upperBound: number,
  inclusive = true
) => {
  "worklet";
  if (inclusive) {
    return value >= lowerBound && value <= upperBound;
  }
  return value > lowerBound && value < upperBound;
};

/**
 *  @summary Clamps a node with a lower and upper bound.
 *  @example
    clamp(-1, 0, 100); // 0
    clamp(1, 0, 100); // 1
    clamp(101, 0, 100); // 100
  * @worklet
  */
export const clamp = (
  value: number,
  lowerBound: number,
  upperBound: number
) => {
  "worklet";
  return Math.min(Math.max(lowerBound, value), upperBound);
};

/**
 * @description Returns the coordinate of a cubic bezier curve. t is the length of the curve from 0 to 1.
 * cubicBezier(0, p0, p1, p2, p3) equals p0 and cubicBezier(1, p0, p1, p2, p3) equals p3.
 * p0 and p3 are respectively the starting and ending point of the curve. p1 and p2 are the control points.
 * @worklet
 */
export const cubicBezier = (
  t: number,
  from: number,
  c1: number,
  c2: number,
  to: number
) => {
  "worklet";
  const term = 1 - t;
  const a = 1 * term ** 3 * t ** 0 * from;
  const b = 3 * term ** 2 * t ** 1 * c1;
  const c = 3 * term ** 1 * t ** 2 * c2;
  const d = 1 * term ** 0 * t ** 3 * to;
  return a + b + c + d;
};

/**
 * @summary Computes animation node rounded to precision.
 * @worklet
 */
export const round = (value: number, precision = 0) => {
  "worklet";
  const p = Math.pow(10, precision);
  return Math.round(value * p) / p;
};

// https://stackoverflow.com/questions/27176423/function-to-solve-cubic-equation-analytically
const cuberoot = (x: number) => {
  "worklet";
  const y = Math.pow(Math.abs(x), 1 / 3);
  return x < 0 ? -y : y;
};

const solveCubic = (a: number, b: number, c: number, d: number) => {
  "worklet";
  if (Math.abs(a) < 1e-8) {
    // Quadratic case, ax^2+bx+c=0
    a = b;
    b = c;
    c = d;
    if (Math.abs(a) < 1e-8) {
      // Linear case, ax+b=0
      a = b;
      b = c;
      if (Math.abs(a) < 1e-8) {
        // Degenerate case
        return [];
      }
      return [-b / a];
    }

    const D = b * b - 4 * a * c;
    if (Math.abs(D) < 1e-8) {
      return [-b / (2 * a)];
    } else if (D > 0) {
      return [(-b + Math.sqrt(D)) / (2 * a), (-b - Math.sqrt(D)) / (2 * a)];
    }
    return [];
  }

  // Convert to depressed cubic t^3+pt+q = 0 (subst x = t - b/3a)
  const p = (3 * a * c - b * b) / (3 * a * a);
  const q = (2 * b * b * b - 9 * a * b * c + 27 * a * a * d) / (27 * a * a * a);
  let roots;

  if (Math.abs(p) < 1e-8) {
    // p = 0 -> t^3 = -q -> t = -q^1/3
    roots = [cuberoot(-q)];
  } else if (Math.abs(q) < 1e-8) {
    // q = 0 -> t^3 + pt = 0 -> t(t^2+p)=0
    roots = [0].concat(p < 0 ? [Math.sqrt(-p), -Math.sqrt(-p)] : []);
  } else {
    const D = (q * q) / 4 + (p * p * p) / 27;
    if (Math.abs(D) < 1e-8) {
      // D = 0 -> two roots
      roots = [(-1.5 * q) / p, (3 * q) / p];
    } else if (D > 0) {
      // Only one real root
      const u = cuberoot(-q / 2 - Math.sqrt(D));
      roots = [u - p / (3 * u)];
    } else {
      // D < 0, three roots, but needs to use complex numbers/trigonometric solution
      const u = 2 * Math.sqrt(-p / 3);
      const t = Math.acos((3 * q) / p / u) / 3; // D < 0 implies p < 0 and acos argument in [-1..1]
      const k = (2 * Math.PI) / 3;
      roots = [u * Math.cos(t), u * Math.cos(t - k), u * Math.cos(t - 2 * k)];
    }
  }

  // Convert back from depressed cubic
  for (let i = 0; i < roots.length; i++) {
    roots[i] -= b / (3 * a);
  }

  return roots;
};

/**
 *  @summary Given a cubic Bèzier curve, return the y value for x.
 *  @example
    const x = 116;
    const from = vec.create(59, 218);
    const c1 = vec.create(131, 39);
    const c2 = vec.create(204, 223);
    const to = vec.create(227, 89);
    // y= 139
    const y = cubicBezierYForX(x, from, c1, c2, to)));
  * @worklet
  */
export const cubicBezierYForX = (
  x: number,
  a: Vector,
  b: Vector,
  c: Vector,
  d: Vector,
  precision = 2
) => {
  "worklet";
  const pa = -a.x + 3 * b.x - 3 * c.x + d.x;
  const pb = 3 * a.x - 6 * b.x + 3 * c.x;
  const pc = -3 * a.x + 3 * b.x;
  const pd = a.x - x;
  // eslint-disable-next-line prefer-destructuring
  const t = solveCubic(pa, pb, pc, pd)
    .map((root) => round(root, precision))
    .filter((root) => root >= 0 && root <= 1)[0];
  return cubicBezier(t, a.y, b.y, c.y, d.y);
};

/**
 * @summary Euclidean distance between two vectors
 * @worklet
 */
export const dist = (v1: Vector, v2: Vector) => {
  "worklet";
  return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
};

/**
 * @summary Returns true if a approximates b. Default precision is 0.001
 * @worklet
 */
export const approximates = (a: number, b: number, precision = 0.001) => {
  "worklet";
  return Math.abs(a - b) <= precision;
};
