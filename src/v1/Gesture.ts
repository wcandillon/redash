import { Platform } from "react-native";
import {
  FlingGestureHandlerEventPayload,
  ForceTouchGestureHandlerEventPayload,
  GestureHandlerStateChangeNativeEvent,
  LongPressGestureHandlerEventPayload,
  PanGestureHandlerEventPayload,
  PinchGestureHandlerEventPayload,
  RotationGestureHandlerEventPayload,
  State,
  TapGestureHandlerEventPayload,
} from "react-native-gesture-handler";
import Animated, { diff, lessThan, or } from "react-native-reanimated";

import { snapPoint } from "./Animations";
import { vec } from "./Vectors";

const {
  proc,
  Clock,
  Value,
  event,
  add,
  block,
  cond,
  eq,
  multiply,
  set,
  stopClock,
  and,
  not,
  clockRunning,
  startClock,
  neq,
  call,
  decay: reDecay,
  spring: reSpring,
  onChange,
  debug,
} = Animated;

// See: https://github.com/kmagiera/react-native-gesture-handler/issues/553
export const pinchBegan = proc((state: Animated.Node<State>) =>
  Platform.OS === "android"
    ? cond(eq(diff(state), State.ACTIVE - State.BEGAN), eq(state, State.ACTIVE))
    : eq(state, State.BEGAN)
);

export const pinchActive = proc(
  (state: Animated.Node<State>, numberOfPointers: Animated.Node<number>) =>
    and(
      eq(state, State.ACTIVE),
      eq(numberOfPointers, 2),
      Platform.OS === "android" ? not(pinchBegan(state)) : 1
    )
);

export const pinchEnd = proc(
  (state: Animated.Node<State>, numberOfPointers: Animated.Node<number>) =>
    Platform.OS === "android"
      ? or(eq(state, State.END), lessThan(numberOfPointers, 2))
      : eq(state, State.END)
);

export const withScaleOffset = (
  value: Animated.Node<number>,
  state: Animated.Node<State>,
  offset: Animated.Value<number> = new Value(1)
) =>
  cond(
    eq(state, State.END),
    [set(offset, multiply(offset, value)), offset],
    multiply(offset, value)
  );

export const withOffset = (
  value: Animated.Node<number>,
  state: Animated.Node<State>,
  offset: Animated.Value<number> = new Value(0)
) =>
  cond(
    eq(state, State.END),
    [set(offset, add(offset, value)), offset],
    add(offset, value)
  );

interface PrivateSpringConfig extends Animated.SpringConfig {
  toValue: Animated.Value<number>;
}

type SpringConfig = Omit<Animated.SpringConfig, "toValue">;

export interface WithSpringParams {
  value: Animated.Adaptable<number>;
  velocity: Animated.Adaptable<number>;
  state: Animated.Node<State>;
  snapPoints: Animated.Adaptable<number>[];
  offset?: Animated.Value<number>;
  config?: SpringConfig;
  onSnap?: (value: readonly number[]) => void;
}

export const withSpring = (props: WithSpringParams) => {
  const {
    value,
    velocity,
    state,
    snapPoints,
    offset,
    config: springConfig,
    onSnap,
  } = {
    offset: new Value(0),
    ...props,
  };
  const clock = new Clock();
  const springState: Animated.SpringState = {
    finished: new Value(0),
    velocity: new Value(0),
    position: new Value(0),
    time: new Value(0),
  };

  const config: PrivateSpringConfig = {
    toValue: new Value(0),
    damping: 6,
    mass: 1,
    stiffness: 64,
    overshootClamping: false,
    restSpeedThreshold: 0.01,
    restDisplacementThreshold: 0.01,
    ...springConfig,
  };

  const gestureAndAnimationIsOver = new Value(1);
  const isSpringInterrupted = and(eq(state, State.BEGAN), clockRunning(clock));
  const finishSpring = [
    set(offset, springState.position),
    stopClock(clock),
    set(gestureAndAnimationIsOver, 1),
  ];
  const snap = onSnap
    ? [cond(clockRunning(clock), call([springState.position], onSnap))]
    : [];
  return block([
    cond(isSpringInterrupted, finishSpring),
    cond(gestureAndAnimationIsOver, set(springState.position, offset)),
    cond(neq(state, State.END), [
      set(gestureAndAnimationIsOver, 0),
      set(springState.finished, 0),
      set(springState.position, add(offset, value)),
    ]),
    cond(and(eq(state, State.END), not(gestureAndAnimationIsOver)), [
      cond(and(not(clockRunning(clock)), not(springState.finished)), [
        set(springState.velocity, velocity),
        set(springState.time, 0),
        set(
          config.toValue,
          snapPoint(springState.position, velocity, snapPoints)
        ),
        startClock(clock),
      ]),
      reSpring(clock, springState, config),
      cond(springState.finished, [...snap, ...finishSpring]),
    ]),
    springState.position,
  ]);
};

interface WithDecayParams {
  value: Animated.Adaptable<number>;
  velocity: Animated.Adaptable<number>;
  state: Animated.Node<State>;
  offset?: Animated.Value<number>;
  deceleration?: number;
}

export const withDecay = (config: WithDecayParams) => {
  const { value, velocity, state, offset, deceleration } = {
    offset: new Value(0),
    deceleration: 0.998,
    ...config,
  };
  const clock = new Clock();
  const decayState = {
    finished: new Value(0),
    velocity: new Value(0),
    position: new Value(0),
    time: new Value(0),
  };

  const isDecayInterrupted = and(eq(state, State.BEGAN), clockRunning(clock));
  const finishDecay = [set(offset, decayState.position), stopClock(clock)];

  return block([
    cond(isDecayInterrupted, finishDecay),
    cond(neq(state, State.END), [
      set(decayState.finished, 0),
      set(decayState.position, add(offset, value)),
    ]),
    cond(eq(state, State.END), [
      cond(and(not(clockRunning(clock)), not(decayState.finished)), [
        set(decayState.velocity, velocity),
        set(decayState.time, 0),
        startClock(clock),
      ]),
      reDecay(clock, decayState, { deceleration }),
      cond(decayState.finished, finishDecay),
    ]),
    decayState.position,
  ]);
};

export const onScrollEvent = (contentOffset: {
  x?: Animated.Node<number>;
  y?: Animated.Node<number>;
}) =>
  event([
    {
      nativeEvent: {
        contentOffset,
      },
    },
  ]);

type NativeEvent = GestureHandlerStateChangeNativeEvent &
  (
    | PanGestureHandlerEventPayload
    | TapGestureHandlerEventPayload
    | LongPressGestureHandlerEventPayload
    | RotationGestureHandlerEventPayload
    | FlingGestureHandlerEventPayload
    | PinchGestureHandlerEventPayload
    | ForceTouchGestureHandlerEventPayload
  );

type Adaptable<T> = { [P in keyof T]: Animated.Adaptable<T[P]> };

export const onGestureEvent = (
  nativeEvent: Partial<Adaptable<NativeEvent>>
) => {
  const gestureEvent = event([{ nativeEvent }]);
  return {
    onHandlerStateChange: gestureEvent,
    onGestureEvent: gestureEvent,
  };
};

export const tapGestureHandler = () => {
  const state = new Value(State.UNDETERMINED);
  const position = vec.createValue(0);
  const absolutePosition = vec.createValue(0);
  const gestureHandler = onGestureEvent({
    state,
    x: position.x,
    y: position.y,
    absoluteX: absolutePosition.x,
    absoluteY: absolutePosition.y,
  });
  return {
    gestureHandler,
    position,
    absolutePosition,
    state,
  };
};

export const panGestureHandler = () => {
  const position = vec.createValue(0);
  const translation = vec.createValue(0);
  const velocity = vec.createValue(0);
  const state = new Value(State.UNDETERMINED);
  const gestureHandler = onGestureEvent({
    x: position.x,
    translationX: translation.x,
    velocityX: velocity.x,
    y: position.y,
    translationY: translation.y,
    velocityY: velocity.y,
    state,
  });
  return {
    position,
    translation,
    velocity,
    state,
    gestureHandler,
  };
};

export const pinchGestureHandler = () => {
  const focal = vec.createValue(0, 0);
  const scale = new Value(1);
  const numberOfPointers = new Value(0);
  const state = new Value(State.UNDETERMINED);
  const gestureHandler = onGestureEvent({
    numberOfPointers,
    focalX: focal.x,
    focalY: focal.y,
    scale,
    state,
  });
  return {
    numberOfPointers,
    scale,
    state,
    gestureHandler,
    focal,
  };
};

export const rotationGestureHandler = () => {
  const anchor = vec.createValue(0, 0);
  const rotation = new Value(0);
  const state = new Value(State.UNDETERMINED);
  const gestureHandler = onGestureEvent({
    anchorX: anchor.x,
    anchorY: anchor.y,
    rotation,
    state,
  });
  return {
    rotation,
    state,
    gestureHandler,
    anchor,
  };
};

export const scrollHandler = () => {
  const x = new Value(0);
  const y = new Value(0);
  const onScroll = onScrollEvent({ x, y });
  return {
    x,
    y,
    scrollHandler: {
      onScroll,
      scrollEventThrottle: 1,
    },
  };
};

export const debugGestureState = (
  label: string,
  state: Animated.Node<State>
) => {
  const d = (value: string): Animated.Node<number> =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    debug(label, new Value(value));
  return onChange(
    state,
    cond(
      eq(state, State.UNDETERMINED),
      d("UNDETERMINED"),
      cond(
        eq(state, State.BEGAN),
        d("BEGAN"),
        cond(
          eq(state, State.ACTIVE),
          d("ACTIVE"),
          cond(
            eq(state, State.END),
            d("END"),
            cond(eq(state, State.CANCELLED), d("CANCELLED"), d("FAILED"))
          )
        )
      )
    )
  );
};
