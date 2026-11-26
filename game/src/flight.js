// The flight model of SKY LEGENDS: arcade handling with real consequences.
// One job: turn pilot inputs into motion, and motion into fuel, damage, stalls
// and landings. No rendering here, only numbers.

import { FLIGHT, RUNWAY, WORLD } from './config.js';
import { clamp, wrapAngle, degToRad } from './random.js';
import { groundHeight, onRunway, isWater } from './world.js';

export function makePlane(start) {
  return {
    x: start.x, y: start.y, z: start.z,
    heading: degToRad(start.headingDeg),
    pitch: 0, roll: 0,
    speed: start.speed ?? 0,
    throttle: start.throttle ?? 0,
    fuel: FLIGHT.fuelCapacity,
    damage: 0,
    verticalSpeed: 0,
    stalled: false,
    onGround: true,
    crashed: false,
    landed: false,
    airTime: 0,
    lowTime: 0, // seconds spent below 50 m while airborne
  };
}

export function forwardVector(heading) {
  return { x: Math.sin(heading), z: -Math.cos(heading) };
}

// One physics step. `input` holds pitch/roll/yaw in [-1, 1], throttleUp/Down
// and brake booleans. Returns an array of event strings for the game to react to.
export function stepFlight(p, input, dt) {
  const events = [];
  if (p.crashed || p.landed) return events;

  // --- throttle ---
  if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.55, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.7, 0, 1);
  if (p.fuel <= 0) p.throttle = 0;

  // --- attitude ---
  const targetRoll = clamp(p.roll + input.roll * FLIGHT.rollRate * dt, -FLIGHT.maxRoll, FLIGHT.maxRoll);
  p.roll = targetRoll;
  p.pitch = clamp(p.pitch + input.pitch * FLIGHT.pitchRate * dt, -FLIGHT.maxPitch, FLIGHT.maxPitch);
  // Banked turn: roll steers the heading. Rudder adds a little at any speed.
  const turnRate = Math.sin(p.roll) * 0.55 * clamp(p.speed / 60, 0.25, 1) + input.yaw * FLIGHT.yawRate * 0.45;
  p.heading = wrapAngle(p.heading + turnRate * dt);
  // Wings level themselves gently when the stick is centred.
  if (Math.abs(input.roll) < 0.05) p.roll *= Math.max(0, 1 - dt * 0.55);
  if (Math.abs(input.pitch) < 0.05) p.pitch *= Math.max(0, 1 - dt * 0.35);

  // --- speed ---
  const thrust = p.throttle * FLIGHT.maxThrustAccel;
  const drag = FLIGHT.drag * p.speed * p.speed + (input.brake ? FLIGHT.brakeDrag * p.speed : 0);
  p.speed = clamp(p.speed + (thrust - drag) * dt, 0, FLIGHT.maxSpeed);

  // --- stall ---
  p.stalled = p.speed < FLIGHT.minFlySpeed && !p.onGround;
  if (p.stalled) {
    p.pitch = Math.max(p.pitch - dt * 0.5, -0.4); // nose drops
    events.push('stall');
  }

  // --- position ---
  const fwd = forwardVector(p.heading);
  const climb = Math.sin(p.pitch) * p.speed;
  const sink = p.stalled ? 9 : Math.max(0, (FLIGHT.minFlySpeed - p.speed)) * 0.12;
  p.verticalSpeed = climb - sink;
  p.x += fwd.x * Math.cos(p.pitch) * p.speed * dt;
  p.z += fwd.z * Math.cos(p.pitch) * p.speed * dt;
  p.y += p.verticalSpeed * dt;

  // --- fuel ---
  p.fuel = Math.max(0, p.fuel - p.throttle * FLIGHT.fuelBurn * dt);

  // --- ground / water contact ---
  // The "ground" over water is the surface (y = 0), so a low pass ends in a
  // ditch instead of sinking through to the seabed.
  const water = isWater(p.x, p.z);
  const ground = water ? WORLD.oceanLevel : groundHeight(p.x, p.z);
  const clearance = FLIGHT.groundClearance;
  if (p.y <= ground + clearance) {
    const onStrip = onRunway(p.x, p.z, 0);
    const sinkRate = -p.verticalSpeed;
    const headingErr = Math.abs(wrapAngle(p.heading - degToRad(RUNWAY.headingDeg)));
    const aligned = headingErr < FLIGHT.landingMaxHeadingErr || headingErr > Math.PI - FLIGHT.landingMaxHeadingErr;
    if (p.onGround) {
      // Rolling on the ground: liftoff only when fast and pulling up.
      if (p.speed > FLIGHT.minFlySpeed && p.verticalSpeed > 0.5) {
        p.onGround = false;
      } else {
        p.y = ground + clearance;
        p.verticalSpeed = 0;
      }
    } else if (onStrip && p.speed > 12 && sinkRate <= FLIGHT.landingMaxSink && Math.abs(p.roll) < FLIGHT.landingMaxRoll && aligned) {
      // Touchdown: roll out along the strip.
      p.y = ground + clearance;
      p.onGround = true;
      p.landed = true;
      p.pitch = 0; p.roll = 0;
      events.push(sinkRate <= 2 ? 'perfect-landing' : 'landing');
    } else if (onStrip && p.speed > 12 && sinkRate <= FLIGHT.landingMaxSink + 2.5) {
      // Hard touchdown on the strip: damage, but the airframe survives.
      p.y = ground + clearance;
      p.onGround = true;
      p.damage = Math.min(100, p.damage + 35);
      events.push('hard-landing');
      if (p.damage >= 100) { p.crashed = true; events.push('crash'); }
    } else if (!water && p.speed > 12 && sinkRate <= 3.5 && Math.abs(p.roll) < 0.3) {
      // Gentle field landing away from the strip: down, but not destroyed.
      p.y = ground + clearance;
      p.onGround = true;
      p.landed = true;
      p.pitch = 0; p.roll = 0;
      events.push('landing');
    } else {
      p.crashed = true;
      events.push(water ? 'ditch' : 'crash');
    }
  } else if (p.y > ground + clearance + 3 || p.verticalSpeed > 1) {
    // Clearly clear of the ground: airborne.
    p.onGround = false;
    p.airTime += dt;
    if (p.y < 50) p.lowTime += dt; else p.lowTime = 0;
  }
  // Otherwise the aircraft is hovering just above the strip (e.g. at spawn):
  // it stays on its gear until it clearly lifts off.

  // --- soft world edge: steer back with a warning instead of a wall ---
  const r = Math.hypot(p.x, p.z);
  if (r > 2050) {
    const back = Math.atan2(-p.x, p.z); // heading toward centre
    p.heading = wrapAngle(p.heading + wrapAngle(back - p.heading) * dt * 0.8);
    events.push('edge');
  }
  return events;
}

// Distance from a point to the centre of a ring, and whether the aircraft is
// inside the ring's disc (within its radius, near its plane).
export function ringPassDistance(plane, ring) {
  const dx = plane.x - ring.x, dy = plane.y - ring.y, dz = plane.z - ring.z;
  const along = dx * ring.fx + dz * ring.fz; // distance along the ring's facing axis
  const radial = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
  return { along, radial };
}
