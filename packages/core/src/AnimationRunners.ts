import Animated, { Easing } from "react-native-reanimated";

import { SpringConfig } from "./Animations";

const {
  Clock,
  Value,
  block,
  cond,
  stopClock,
  set,
  startClock,
  clockRunning,
  not,
  and,
  timing: reTiming,
  decay: reDecay,
  spring: reSpring,
  SpringUtils,
  eq,
  neq,
} = Animated;

const defaultSpringConfig = SpringUtils.makeDefaultConfig();

interface AnimateParams<S, C> {
  clock: Animated.Clock;
  fn: (
    clock: Animated.Clock,
    state: S,
    config: C
  ) => Animated.Adaptable<number>;
  state: S;
  config: C;
  from: Animated.Adaptable<number>;
}

interface TimingAnimation {
  state: Animated.TimingState;
  config: Animated.TimingConfig;
}

interface SpringAnimation {
  state: Animated.SpringState;
  config: Animated.SpringConfig;
}

interface DecayAnimation {
  state: Animated.DecayState;
  config: Animated.DecayConfig;
}

type Animation = SpringAnimation | DecayAnimation | TimingAnimation;

const animate = <T extends Animation>({
  fn,
  clock,
  state,
  config,
  from,
}: AnimateParams<T["state"], T["config"]>) =>
  block([
    cond(not(clockRunning(clock)), [
      set(state.finished, 0),
      set(state.time, 0),
      set(state.position, from),
      startClock(clock),
    ]),
    fn(clock, state, config),
    cond(state.finished, stopClock(clock)),
    state.position,
  ]);

export interface TimingParams {
  clock?: Animated.Clock;
  from?: Animated.Adaptable<number>;
  to?: Animated.Adaptable<number>;
  duration?: Animated.Adaptable<number>;
  easing?: Animated.EasingFunction;
}

export const timing = (params: TimingParams) => {
  const { clock, easing, duration, from, to } = {
    clock: new Clock(),
    easing: Easing.linear,
    duration: 250,
    from: 0,
    to: 1,
    ...params,
  };

  const state: Animated.TimingState = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    frameTime: new Value(0),
  };

  const config = {
    toValue: new Value(0),
    duration,
    easing,
  };

  return block([
    cond(not(clockRunning(clock)), [
      set(config.toValue, to),
      set(state.frameTime, 0),
    ]),
    animate<TimingAnimation>({
      clock,
      fn: reTiming,
      state,
      config,
      from,
    }),
  ]);
};

export interface DecayParams {
  clock?: Animated.Clock;
  from?: Animated.Adaptable<number>;
  velocity?: Animated.Adaptable<number>;
  deceleration?: Animated.Adaptable<number>;
}

export const decay = (params: DecayParams) => {
  const { clock, from, velocity, deceleration } = {
    clock: new Clock(),
    velocity: new Value(0),
    deceleration: 0.998,
    from: 0,
    ...params,
  };

  const state: Animated.DecayState = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    velocity: new Value(0),
  };

  const config: Animated.DecayConfig = {
    deceleration,
  };

  return block([
    cond(not(clockRunning(clock)), [set(state.velocity, velocity)]),
    animate<DecayAnimation>({
      clock,
      fn: reDecay,
      state,
      config,
      from,
    }),
  ] as ReadonlyArray<Animated.Node<number>>);
};

export interface SpringParams {
  clock?: Animated.Clock;
  from?: Animated.Adaptable<number>;
  to: Animated.Adaptable<number>;
  velocity?: Animated.Adaptable<number>;
  config?: SpringConfig;
}

export const spring = (params: SpringParams) => {
  const { clock, from, velocity, config: springConfig, to } = {
    clock: new Clock(),
    velocity: new Value(0),
    from: 0,
    ...params,
  };

  const state: Animated.SpringState = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    velocity: new Value(0),
  };

  const config = {
    ...defaultSpringConfig,
    toValue: new Value(0),
    ...springConfig,
  };

  return block([
    cond(not(clockRunning(clock)), [
      set(config.toValue, to),
      set(state.velocity, velocity),
    ]),
    animate<SpringAnimation>({
      clock,
      fn: reSpring,
      state,
      config,
      from,
    }),
  ] as ReadonlyArray<Animated.Node<number>>);
};

export const delay = (node: Animated.Node<number>, duration: number) => {
  const clock = new Clock();
  return block([
    timing({ clock, from: 0, to: 1, duration }),
    cond(not(clockRunning(clock)), node),
  ]);
};

export interface LoopProps {
  clock?: Animated.Clock;
  easing?: Animated.EasingFunction;
  duration?: number;
  boomerang?: boolean;
  autoStart?: boolean;
}

export const loop = (loopConfig: LoopProps) => {
  const { clock, easing, duration, boomerang, autoStart } = {
    clock: new Clock(),
    easing: Easing.linear,
    duration: 250,
    boomerang: false,
    autoStart: true,
    ...loopConfig,
  };
  const state = {
    finished: new Value(0),
    position: new Value(0),
    time: new Value(0),
    frameTime: new Value(0),
  };
  const config = {
    toValue: new Value(1),
    duration,
    easing,
  };

  return block([
    cond(and(not(clockRunning(clock)), autoStart ? 1 : 0), startClock(clock)),
    reTiming(clock, state, config),
    cond(state.finished, [
      set(state.finished, 0),
      set(state.time, 0),
      set(state.frameTime, 0),
      boomerang
        ? set(config.toValue, cond(config.toValue, 0, 1))
        : set(state.position, 0),
    ]),
    state.position,
  ]);
};

interface ResetParams {
  state: Animated.TimingState;
  from?: Animated.Adaptable<number>;
  to?: Animated.Adaptable<number>;
  config: Animated.TimingConfig;
  clock: Animated.Clock;
};
const resetAndStart = (params: ResetParams) => {
  const { state, from, to, config, clock } = { from: 0, to: 1, ...params };
  return block([
    set(state.finished, 0),
    set(state.time, 0),
    set(state.position, from),
    set(state.frameTime, 0),
    set(config.toValue, to),
    startClock(clock),
  ]);
};

const getTimingState = (): Animated.TimingState => ({
  finished: new Value(0),
  position: new Value(0),
  frameTime: new Value(0),
  time: new Value(0),
});

interface DelayTimingParams {
  from?: Animated.Adaptable<number>;
  to?: Animated.Adaptable<number>;
  duration?: Animated.Adaptable<number>;
  delay?: Animated.Adaptable<number>;
  easing?: Animated.EasingFunction;
};
export default function delayTiming(params: DelayTimingParams) {
  const { duration, from, to, delay, easing } = {
    duration: 400,
    from: 0,
    to: 1,
    delay: 0,
    easing: Easing.linear,
    ...params,
  };

  const clock = new Clock();
  const state = getTimingState();
  const config: Animated.TimingConfig = {
    duration,
    toValue: new Value(0),
    easing,
  };

  const delayClock = new Clock();
  const delayState = getTimingState();

  const delayConfig: Animated.TimingConfig = {
    duration: delay,
    toValue: new Value(1),
    easing: Easing.linear,
  };

  return cond(
    neq(delay, 0),
    [
      cond(
        and(eq(delayState.finished, 0), not(clockRunning(delayClock))),
        resetAndStart({
          state: delayState,
          clock: delayClock,
          config: delayConfig,
        }),
      ),
      reTiming(delayClock, delayState, delayConfig),
      cond(delayState.finished, stopClock(delayClock)),
      cond(
        and(eq(delayState.finished, 1), not(clockRunning(clock))),
        resetAndStart({ state, clock, config, from, to }),
      ),
      reTiming(clock, state, config),
      cond(state.finished, stopClock(clock)),
      cond(delayState.finished, state.position, from),
    ],
    [
      cond(
        not(clockRunning(clock)),
        resetAndStart({ state, clock, config, from, to }),
      ),
      reTiming(clock, state, config),
      cond(state.finished, stopClock(clock)),
      state.position,
    ],
  );
}
