import Animated from "react-native-reanimated";
import parseSVG from "parse-svg-path";
import absSVG from "abs-svg-path";
import normalizeSVG from "normalize-svg-path";
import { find } from "./Array";
import { string } from "./String";
import { cubicBezier } from "./Math";
import cubicBezierLength from "./CubicBezierLength";

const {
  Value,
  lessOrEq,
  greaterOrEq,
  and,
  cond,
  interpolate,
  Extrapolate
} = Animated;

// const COMMAND = 0;
const MX = 1;
const MY = 2;
const CX1 = 1;
const CY1 = 2;
const CX2 = 3;
const CY2 = 4;
const CX = 5;
const CY = 6;

type SVGMoveCommand = ["M", number, number];
type SVGCurveCommand = ["C", number, number, number, number, number, number];
type SVGNormalizedCommands = [SVGMoveCommand, ...SVGCurveCommand[]];
type BezierPoint = "p0x" | "p0y" | "p1x" | "p1y" | "p2x" | "p2y" | "p3x" | "p3y"; 

interface Point {
  x: number;
  y: number;
}

interface BezierCubicCurve {
  length: number;
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
}

type InterpolationConfig = Parameters<typeof interpolate>[1];
export type PathInterpolationConfig = { outputRange: ReadonlyArray<ReanimatedPath | string> } & Exclude<InterpolationConfig, "outputRange">;

export interface ReanimatedPath {
  totalLength: number;
  segments: { start: number; end: number }[];
  length: number[];
  start: number[];
  end: number[];
  p0x: number[];
  p0y: number[];
  p1x: number[];
  p1y: number[];
  p2x: number[];
  p2y: number[];
  p3x: number[];
  p3y: number[];
}

export const parsePath = (d: string): ReanimatedPath => {
  const [move, ...curves]: SVGNormalizedCommands = normalizeSVG(
    absSVG(parseSVG(d))
  );
  const parts: BezierCubicCurve[] = curves.map((curve, index) => {
    const prevCurve = curves[index - 1];
    const p0 =
      index === 0
        ? { x: move[MX], y: move[MY] }
        : { x: prevCurve[CX], y: prevCurve[CY] };
    const p1 = { x: curve[CX1], y: curve[CY1] };
    const p2 = { x: curve[CX2], y: curve[CY2] };
    const p3 = { x: curve[CX], y: curve[CY] };
    const length = cubicBezierLength(p0, p1, p2, p3);
    return {
      p0,
      p1,
      p2,
      p3,
      length
    };
  });
  const segments = parts.map((part, index) => {
    const start = parts.slice(0, index).reduce((acc, p) => acc + p.length, 0);
    const end = start + part.length;
    return {
      start,
      end
    };
  });
  return {
    segments,
    totalLength: parts.reduce((acc, part) => acc + part.length, 0),
    length: parts.map(part => part.length),
    start: segments.map(segment => segment.start),
    end: segments.map(segment => segment.end),
    p0x: parts.map(part => part.p0.x),
    p0y: parts.map(part => part.p0.y),
    p1x: parts.map(part => part.p1.x),
    p1y: parts.map(part => part.p1.y),
    p2x: parts.map(part => part.p2.x),
    p2y: parts.map(part => part.p2.y),
    p3x: parts.map(part => part.p3.x),
    p3y: parts.map(part => part.p3.y)
  };
};

export const getPointAtLength = (
  path: ReanimatedPath,
  length: Animated.Node<number>
): { x: Animated.Node<number>; y: Animated.Node<number> } => {
  const notFound: Animated.Node<number> = new Value(-1);
  const index = path.segments.reduce(
    (acc, p, i) =>
      cond(and(greaterOrEq(length, p.start), lessOrEq(length, p.end)), i, acc),
    notFound
  );
  const start = find(path.start, index);
  const end = find(path.end, index);

  const p0x = find(path.p0x, index);
  const p1x = find(path.p1x, index);
  const p2x = find(path.p2x, index);
  const p3x = find(path.p3x, index);

  const p0y = find(path.p0y, index);
  const p1y = find(path.p1y, index);
  const p2y = find(path.p2y, index);
  const p3y = find(path.p3y, index);
  const t = interpolate(length, {
    inputRange: [start, end],
    outputRange: [0, 1]
  });
  return {
    x: cubicBezier(t, p0x, p1x, p2x, p3x),
    y: cubicBezier(t, p0y, p1y, p2y, p3y)
  };
};

export const interpolatePath = (
  value: Animated.Adaptable<number>,
  { inputRange, outputRange, ...config }: PathInterpolationConfig
): Animated.Node<string> => {
  const paths = outputRange.map(path =>
    typeof path === "string" ? parsePath(path) : path
  );
  const path = paths[0];
  const commands = path.segments.map((_, index) => {
    const interpolatePoint = (point: BezierPoint) => interpolate(value, {
      inputRange,
      outputRange: paths.map(p => p[point][index]),
      ...config
    });
    
    const mx = interpolatePoint("p0x");
    const my = interpolatePoint("p0y");

    const p1x = interpolatePoint("p1x");
    const p1y = interpolatePoint("p1y");

    const p2x = interpolatePoint("p2x");
    const p2y = interpolatePoint("p2y");

    const p3x = interpolatePoint("p3x");
    const p3y = interpolatePoint("p3y");

    return string`${
      index === 0 ? string`M${mx},${my} ` : ""
    }C${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y}`;
  });
  return string`${commands}`;
};

export const bInterpolatePath = (
  value: Animated.Value<number>,
  path1: ReanimatedPath | string,
  path2: ReanimatedPath | string
): Animated.Node<string> =>
  interpolatePath(value, {
    inputRange: [0, 1],
    outputRange: [path1, path2]
  });
