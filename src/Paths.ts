import Animated, { interpolate } from "react-native-reanimated";
import parseSVG from "parse-svg-path";
import absSVG from "abs-svg-path";
import normalizeSVG from "normalize-svg-path";

import { Vector } from "./Vectors";
import { cartesian2Polar } from "./Coordinates";
import { cubicBezierYForX } from "./Math";

type SVGCloseCommand = ["Z"];
type SVGMoveCommand = ["M", number, number];
type SVGCurveCommand = ["C", number, number, number, number, number, number];
type SVGNormalizedCommands = [
  SVGMoveCommand,
  ...(SVGCurveCommand | SVGCloseCommand)[]
];

interface Curve {
  to: Vector;
  c1: Vector;
  c2: Vector;
}

export type Path = {
  move: Vector;
  curves: Curve[];
  close: boolean;
};

/**
 * @summary Serialize a path into an SVG path string
 * @worklet
 */
export const serialize = (path: Path) => {
  "worklet";
  return `M${path.move.x},${path.move.y} ${path.curves
    .map((c) => `C${c.c1.x},${c.c1.y} ${c.c2.x},${c.c2.y} ${c.to.x},${c.to.y}`)
    .join(" ")}${path.close ? "Z" : ""}`;
};

/**
 * @description ⚠️ this function cannot run on the UI thread. It must be executed on the JS thread
 * @summary Parse an SVG path into a sequence of Bèzier curves.
 * The SVG is normalized to have absolute values and to be approximated to a sequence of Bèzier curves.
 */
export const parse = (d: string): Path => {
  const segments: SVGNormalizedCommands = normalizeSVG(absSVG(parseSVG(d)));
  const path = createPath({ x: segments[0][1], y: segments[0][2] });
  segments.forEach((segment) => {
    if (segment[0] === "Z") {
      close(path);
    } else if (segment[0] === "C") {
      addCurve(path, {
        c1: {
          x: segment[1],
          y: segment[2],
        },
        c2: {
          x: segment[3],
          y: segment[4],
        },
        to: {
          x: segment[5],
          y: segment[6],
        },
      });
    }
  });
  return path;
};

/**
 * @summary Interpolate between paths.
 * @worklet
 */
export const interpolatePath = (
  value: number,
  inputRange: number[],
  outputRange: Path[],
  extrapolate = Animated.Extrapolate.CLAMP
) => {
  "worklet";
  const path = {
    move: {
      x: interpolate(
        value,
        inputRange,
        outputRange.map((p) => p.move.x),
        extrapolate
      ),
      y: interpolate(
        value,
        inputRange,
        outputRange.map((p) => p.move.y),
        extrapolate
      ),
    },
    curves: outputRange[0].curves.map((_, index) => ({
      c1: {
        x: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].c1.x),
          extrapolate
        ),
        y: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].c1.y),
          extrapolate
        ),
      },
      c2: {
        x: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].c2.x),
          extrapolate
        ),
        y: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].c2.y),
          extrapolate
        ),
      },
      to: {
        x: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].to.x),
          extrapolate
        ),
        y: interpolate(
          value,
          inputRange,
          outputRange.map((p) => p.curves[index].to.y),
          extrapolate
        ),
      },
    })),
    close: outputRange[0].close,
  };
  return serialize(path);
};

/**
 * @summary Interpolate two paths with an animation value that goes from 0 to 1
 * @worklet
 */
export const mixPath = (
  value: number,
  p1: Path,
  p2: Path,
  extrapolate = Animated.Extrapolate.CLAMP
) => {
  "worklet";
  return interpolatePath(value, [0, 1], [p1, p2], extrapolate);
};

/**
 * @summary Create a new path
 * @worklet
 */
export const createPath = (move: Vector): Path => {
  "worklet";
  return {
    move,
    curves: [],
    close: false,
  };
};

/**
 * @summary Add an arc command to a path
 * @worklet
 */
export const addArc = (path: Path, corner: Vector, to: Vector) => {
  "worklet";
  const last = path.curves[path.curves.length - 1];
  const from = last ? last.to : path.move;
  const arc = 9 / 16;
  path.curves.push({
    c1: {
      x: (corner.x - from.x) * arc + from.x,
      y: (corner.y - from.y) * arc + from.y,
    },
    c2: {
      x: (corner.x - to.x) * arc + to.x,
      y: (corner.y - to.y) * arc + to.y,
    },
    to,
  });
};

/**
 * @summary Add a cubic Bèzier curve command to a path.
 * @worklet
 */
export const addCurve = (path: Path, c: Curve) => {
  "worklet";
  path.curves.push({
    c1: c.c1,
    c2: c.c2,
    to: c.to,
  });
};

/**
 * @summary Add a line command to a path.
 * @worklet
 */
export const addLine = (path: Path, to: Vector) => {
  "worklet";
  const last = path.curves[path.curves.length - 1];
  const from = last ? last.to : path.move;
  path.curves.push({
    c1: from,
    c2: to,
    to,
  });
};

/**
 * @summary Add a quadratic Bèzier curve command to a path.
 * @worklet
 */
export const addQuadraticCurve = (path: Path, cp: Vector, to: Vector) => {
  "worklet";
  const last = path.curves[path.curves.length - 1];
  const from = last ? last.to : path.move;
  path.curves.push({
    c1: {
      x: from.x / 3 + (2 / 3) * cp.x,
      y: from.y / 3 + (2 / 3) * cp.y,
    },
    c2: {
      x: to.x / 3 + (2 / 3) * cp.x,
      y: to.y / 3 + (2 / 3) * cp.y,
    },
    to,
  });
};

/**
 * @summary Add a close command to a path.
 * @worklet
 */
export const close = (path: Path) => {
  "worklet";
  path.close = true;
};

interface SelectedCurve {
  from: Vector;
  curve: Curve;
}

interface NullableSelectedCurve {
  from: Vector;
  curve: Curve | null;
}

/**
 * @worklet
 */
const curveIsFound = (c: NullableSelectedCurve): c is SelectedCurve => {
  "worklet";
  return c.curve !== null;
};

/**
 * @summary Return the curves at x. This function assumes that only one curve is available at x
 * @worklet
 */
export const selectCurve = (path: Path, x: number): SelectedCurve | null => {
  "worklet";
  const result: NullableSelectedCurve = {
    from: path.move,
    curve: null,
  };
  for (let i = 0; i < path.curves.length; i++) {
    const c = path.curves[i];
    const contains =
      result.from.x > c.to.x
        ? x >= c.to.x && x <= result.from.x
        : x >= result.from.x && x <= c.to.x;
    if (contains) {
      result.curve = c;
      break;
    }
    result.from = c.to;
  }
  if (!curveIsFound(result)) {
    return null;
  }
  return result;
};

/**
 * @summary Return the y value of a path given its x coordinate
 * @example
    const p1 = parse(
      "M150,0 C150,0 0,75 200,75 C75,200 200,225 200,225 C225,200 200,150 0,150"
    );
    // 75
    getYForX(p1, 200))
    // ~151
    getYForX(p1, 50)
 * @worklet
 */
export const getYForX = (path: Path, x: number, precision = 2) => {
  "worklet";
  const c = selectCurve(path, x);
  if (c === null) {
    return null;
  }
  return cubicBezierYForX(
    x,
    c.from,
    c.curve.c1,
    c.curve.c2,
    c.curve.to,
    precision
  );
};

const controlPoint = (
  current: Vector,
  previous: Vector,
  next: Vector,
  reverse: boolean,
  smoothing: number
) => {
  "worklet";
  const p = previous || current;
  const n = next || current;
  // Properties of the opposed-line
  const lengthX = n.x - p.x;
  const lengthY = n.y - p.y;

  const o = cartesian2Polar({ x: lengthX, y: lengthY });
  // If is end-control-point, add PI to the angle to go backward
  const angle = o.theta + (reverse ? Math.PI : 0);
  const length = o.radius * smoothing;
  // The control point position is relative to the current point
  const x = current.x + Math.cos(angle) * length;
  const y = current.y + Math.sin(angle) * length;
  return { x, y };
};

const exhaustiveCheck = (a: never): never => {
  throw new Error(`Unexhaustive handling for ${a}`);
};

/**
 * @summary Link points via a smooth cubic Bézier curves
 * from https://github.com/rainbow-me/rainbow
 * @worklet
 */
export const curveLines = (
  points: Vector<number>[],
  smoothing: number,
  strategy: "complex" | "bezier" | "simple"
) => {
  "worklet";
  const path = createPath(points[0]);
  // build the d attributes by looping over the points
  for (let i = 0; i < points.length; i++) {
    if (i === 0) {
      continue;
    }
    const point = points[i];
    const next = points[i + 1];
    const prev = points[i - 1];
    const cps = controlPoint(prev, points[i - 2], point, false, smoothing);
    const cpe = controlPoint(point, prev, next, true, smoothing);
    switch (strategy) {
      case "simple":
        const cp = {
          x: (cps.x + cpe.x) / 2,
          y: (cps.y + cpe.y) / 2,
        };
        addQuadraticCurve(path, cp, point);
        break;
      case "bezier":
        const p0 = points[i - 2] || prev;
        const p1 = points[i - 1];
        const cp1x = (2 * p0.x + p1.x) / 3;
        const cp1y = (2 * p0.y + p1.y) / 3;
        const cp2x = (p0.x + 2 * p1.x) / 3;
        const cp2y = (p0.y + 2 * p1.y) / 3;
        const cp3x = (p0.x + 4 * p1.x + point.x) / 6;
        const cp3y = (p0.y + 4 * p1.y + point.y) / 6;
        path.curves.push({
          c1: { x: cp1x, y: cp1y },
          c2: { x: cp2x, y: cp2y },
          to: { x: cp3x, y: cp3y },
        });
        if (i === points.length - 1) {
          path.curves.push({
            to: points[points.length - 1],
            c1: points[points.length - 1],
            c2: points[points.length - 1],
          });
        }
        break;
      case "complex":
        path.curves.push({
          to: point,
          c1: cps,
          c2: cpe,
        });
        break;
      default:
        exhaustiveCheck(strategy);
    }
  }
  return path;
};

const getPointAtT = (from: Vector, to: Vector, t: number): Vector => {
  const x = (1 - t) * from.x + t * to.x;
  const y = (1 - t) * from.y + t * to.y;

  return { x, y };
};

export const splitCurve = (
  from: Vector,
  c1: Vector,
  c2: Vector,
  to: Vector,
  t: number
): Array<Curve> => {
  const helperPoints: Vector[] = [];

  helperPoints.push(getPointAtT(from, c1, t));
  helperPoints.push(getPointAtT(c1, c2, t));
  helperPoints.push(getPointAtT(c2, to, t));

  helperPoints.push(getPointAtT(helperPoints[0], helperPoints[1], t));
  helperPoints.push(getPointAtT(helperPoints[1], helperPoints[2], t));

  helperPoints.push(getPointAtT(helperPoints[3], helperPoints[4], t));

  const curves = [
    { c1: helperPoints[0], c2: helperPoints[3], to: helperPoints[5] },
    { c1: helperPoints[4], c2: helperPoints[2], to },
  ];

  return curves;
};
