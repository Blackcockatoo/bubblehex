/**
 * Bubble Hex physics use internal canvas pixels, pixels/second and seconds.
 * CSS only scales the final 960×720 canvas and never participates in physics.
 */
export const CANVAS_WIDTH = 960;
export const CANVAS_HEIGHT = 720;
export const TILE_SIZE = 32;
export const PLAYER_WIDTH = 34;
export const PLAYER_HEIGHT = 48;
export const PLATFORM_THICKNESS = 18;

// Measured from the authored scaffold set: the common useful rise is 90–122 px.
export const STANDARD_PLATFORM_GAP = TILE_SIZE * 3.25; // 104 px
export const TARGET_JUMP_HEIGHT = STANDARD_PLATFORM_GAP * 1.45; // 150.8 px
export const TIME_TO_APEX = 0.38;
export const GRAVITY = (2 * TARGET_JUMP_HEIGHT) / (TIME_TO_APEX * TIME_TO_APEX);
export const JUMP_VELOCITY = -GRAVITY * TIME_TO_APEX;
export const DOUBLE_JUMP_MULTIPLIER = 0.9;
export const DOUBLE_JUMP_VELOCITY = JUMP_VELOCITY * DOUBLE_JUMP_MULTIPLIER;
export const MAX_JUMPS = 2;
export const COYOTE_TIME = 0.1;
export const JUMP_BUFFER_TIME = 0.12;
export const MAX_FRAME_DELTA = 1 / 30;

export const MAX_RUN_SPEED = TILE_SIZE * 8.75;
export const POWER_RUN_SPEED = TILE_SIZE * 10.25;
export const GROUND_ACCELERATION = TILE_SIZE * 52;
export const AIR_ACCELERATION = TILE_SIZE * 34;
export const GROUND_DECELERATION = TILE_SIZE * 55;
export const AIR_DECELERATION = TILE_SIZE * 12;

export const theoreticalJumpHeight = (velocity = JUMP_VELOCITY, gravity = GRAVITY) =>
  (velocity * velocity) / (2 * gravity);

export const theoreticalDoubleJumpHeight = () =>
  theoreticalJumpHeight() + theoreticalJumpHeight(DOUBLE_JUMP_VELOCITY);

export type Reachability = "single" | "double" | "unreachable";

export const classifyVerticalGap = (gap: number): Reachability => {
  if (gap <= theoreticalJumpHeight() - 3) return "single";
  if (gap <= theoreticalDoubleJumpHeight() - 8) return "double";
  return "unreachable";
};

export const solveDescendingCrossTime = (rise: number, velocity = JUMP_VELOCITY) => {
  const discriminant = velocity * velocity - 2 * GRAVITY * rise;
  if (discriminant < 0) return 0;
  return (-velocity + Math.sqrt(discriminant)) / GRAVITY;
};

