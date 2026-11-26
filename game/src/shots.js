// Deterministic screenshot scenes and the self-test for SKY LEGENDS.
// One job: put the game into an exact, repeatable state for a screenshot
// (?shot=cover|cockpit|rings|landing), and prove the core systems work
// (?selftest=1 writes PASS/FAIL lines into #selftest and the page title).

import { MISSIONS } from './config.js';
import { degToRad } from './random.js';
import { terrainHeight, groundHeight, onRunway } from './world.js';
import { makePlane, stepFlight, ringPassDistance } from './flight.js';
import { makeGame, startMission, stepMissions } from './missions.js';
import { chaseCamera, makeProjector } from './render.js';

// A shot preset: mission, camera, and the aircraft's exact state.
export const SHOTS = {
  cover: {
    mission: 0, camera: 'chase', nextRing: 0,
    plane: { x: 1300, y: 140, z: 230, headingDeg: 82, pitch: 0.04, roll: -0.12, speed: 62, throttle: 0.72 },
  },
  cockpit: {
    mission: 2, camera: 'cockpit', nextRing: 0,
    plane: { x: 1850, y: 130, z: 400, headingDeg: 270, pitch: -0.05, roll: 0, speed: 66, throttle: 0.6 },
  },
  rings: {
    mission: 0, camera: 'chase', nextRing: 0,
    plane: { x: 1250, y: 135, z: 250, headingDeg: 70, pitch: 0.02, roll: 0.08, speed: 58, throttle: 0.66 },
  },
  landing: {
    mission: 2, camera: 'chase', nextRing: 2,
    plane: { x: 820, y: 25, z: 400, headingDeg: 90, pitch: -0.06, roll: 0, speed: 44, throttle: 0.3 },
  },
};

export function shotFromUrl() {
  const q = new URLSearchParams(window.location.search);
  return q.get('shot') || null;
}

export function selftestFromUrl() {
  return new URLSearchParams(window.location.search).has('selftest');
}

// Apply a shot preset to a fresh game + plane. Returns the preset.
export function applyShot(game, plane, name) {
  const preset = SHOTS[name] || SHOTS.cover;
  const mission = MISSIONS[preset.mission];
  startMission(game, plane, preset.mission);
  game.camera = preset.camera;
  game.nextRing = preset.nextRing;
  for (let i = 0; i < preset.nextRing; i++) game.rings[i].passed = true;
  const p = preset.plane;
  plane.x = p.x; plane.y = p.y; plane.z = p.z;
  plane.heading = degToRad(p.headingDeg);
  plane.pitch = p.pitch; plane.roll = p.roll;
  plane.speed = p.speed; plane.throttle = p.throttle;
  plane.onGround = false;
  plane.fuel = 78;
  return preset;
}

// ---- self-test: proves the world, the physics and the missions work ----
export function runSelfTest() {
  const lines = [];
  function check(name, ok, detail = '') {
    lines.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  }
  try {
    // 1. Runway ground is level at the published height.
    const rh = groundHeight(1100, 400);
    check('runway-level', Math.abs(rh - 14) < 2, `height=${rh.toFixed(1)}`);
    check('runway-hitbox', onRunway(1100, 400) && !onRunway(1100, 900));
    // 2. Ocean is ocean, islands are land.
    check('ocean', terrainHeight(0, -1900) < 0, `h=${terrainHeight(0, -1900).toFixed(1)}`);
    check('island-peak', terrainHeight(300, 400) > 100, `h=${terrainHeight(300, 400).toFixed(1)}`);
    // 3. Takeoff: full throttle + pitch up leaves the ground.
    const pl = makePlane(MISSIONS[0].start);
    const idle = { pitch: 0, roll: 0, yaw: 0, throttleUp: false, throttleDown: false, brake: false };
    for (let i = 0; i < 60 * 8; i++) {
      const input = { ...idle, throttleUp: true, pitch: i > 60 * 3 ? 1 : 0 };
      stepFlight(pl, input, 1 / 60);
    }
    check('takeoff', pl.y > 60 && pl.airTime > 0, `y=${pl.y.toFixed(0)} speed=${pl.speed.toFixed(0)}`);
    // 4. Ring pass detection: sitting in a ring's centre counts.
    const g = makeGame();
    const pl2 = makePlane(MISSIONS[0].start);
    startMission(g, pl2, 0);
    const ring = g.rings[0];
    pl2.x = ring.x; pl2.y = ring.y; pl2.z = ring.z;
    const d = ringPassDistance(pl2, ring);
    check('ring-geometry', Math.abs(d.along) < 1 && d.radial < 1, `along=${d.along.toFixed(1)} radial=${d.radial.toFixed(1)}`);
    stepMissions(g, pl2, [], 1 / 60, 0);
    check('ring-scores', g.nextRing === 1 && g.score >= 250, `next=${g.nextRing} score=${g.score}`);
    // 5. Landing: a gentle approach onto the strip touches down.
    const pl3 = makePlane({ x: 950, y: 22, z: 400, headingDeg: 90, speed: 40, throttle: 0.2 });
    for (let i = 0; i < 60 * 8 && !pl3.landed && !pl3.crashed; i++) {
      pl3.pitch = -0.04; // hold a gentle descent onto the strip
      stepFlight(pl3, idle, 1 / 60);
    }
    check('landing', pl3.landed && !pl3.crashed, `landed=${pl3.landed} crashed=${pl3.crashed}`);
    // 6. Projection: a point ahead of the chase camera lands on screen.
    const pl4 = makePlane(MISSIONS[0].start);
    pl4.y = 150;
    const cam = chaseCamera(pl4, { chaseDistance: 13, orbitYaw: 0, orbitPitch: 0.12 }, null);
    const project = makeProjector(cam, 1280, 720);
    const ahead = project(pl4.x + 100, 150, pl4.z - 100);
    check('projection', !!ahead && ahead.x > 0 && ahead.x < 1280 && ahead.y > 0 && ahead.y < 720,
      ahead ? `x=${ahead.x.toFixed(0)} y=${ahead.y.toFixed(0)} d=${ahead.d.toFixed(0)}` : 'null');
    // 7. Crash: flying into a mountainside ends the flight.
    const pl5 = makePlane({ x: 300, y: 320, z: 400, headingDeg: 0, speed: 60, throttle: 0.8 });
    pl5.pitch = -0.5;
    for (let i = 0; i < 60 * 6 && !pl5.crashed; i++) stepFlight(pl5, idle, 1 / 60);
    check('crash', pl5.crashed === true, `crashed=${pl5.crashed}`);
  } catch (err) {
    lines.push(`FAIL exception — ${err.message}`);
  }
  const passed = lines.filter((l) => l.startsWith('PASS')).length;
  const summary = `SELFTEST: ${passed}/${lines.length} PASS`;
  const el = document.getElementById('selftest');
  if (el) el.textContent = [summary, ...lines].join('\n');
  document.title = summary;
  return { passed, total: lines.length, lines };
}
