// SKY LEGENDS: LAST FLIGHT — bootstrap, game states and the main loop.
// One job: own the frame. It wires input, physics, missions, audio and the
// renderer together, and draws the menu, pause and end screens.

import { MISSIONS, VIEW } from './config.js';
import { makePlane, stepFlight } from './flight.js';
import { makeInput, attachInput, consumeOrbit, wasPressed, clearPressed } from './input.js';
import { makeGame, startMission, stepMissions, currentObjective, missionSummary } from './missions.js';
import { makeAudio, ensureAudio, updateAudio, playRingChime, playThud, playCrash, playWarning, setMuted } from './audio.js';
import { buildClouds } from './world.js';
import {
  makeRenderer, cameraBasis, chaseCamera, cockpitCamera,
  drawSky, drawTerrain, drawRunway, drawRings, drawClouds, drawAircraft,
} from './render.js';
import { drawTopHud, drawWarnings, drawInstrumentStrip, drawCockpit } from './hud.js';
import { shotFromUrl, selftestFromUrl, applyShot, runSelfTest } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = VIEW.width, H = VIEW.height;
canvas.width = W; canvas.height = H;

const renderer = makeRenderer();
const clouds = buildClouds();
const input = makeInput();
const audio = makeAudio();
const game = makeGame();
let plane = makePlane(MISSIONS[0].start);
let menuOrbit = 0;
let lastNow = performance.now() / 1000;
let clock = 0; // seconds since load, drives blinking and popups
let warnCooldown = 0;
let stallWarnedAt = -10;

const shotName = shotFromUrl();
const SHOT_MODE = !!shotName;
if (SHOT_MODE) {
  applyShot(game, plane, shotName);
  document.title = `shot:${shotName}`;
}

attachInput(input, canvas, {
  onPause: () => {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  },
  onRestart: () => { if (game.state !== 'menu') restartMission(); },
  onCamera: () => {
    game.camera = game.camera === 'chase' ? 'cockpit' : 'chase';
    input.orbitYaw = 0; input.orbitPitch = 0.12;
  },
  onMute: () => { game.muted = !game.muted; setMuted(audio, game.muted); },
  onConfirm: () => {
    ensureAudio(audio);
    if (game.state === 'menu') startMission(game, plane, 0);
    else if (game.state === 'complete') nextMission();
    else if (game.state === 'crashed') restartMission();
  },
});

function restartMission() {
  plane = makePlane(MISSIONS[game.missionIndex].start);
  startMission(game, plane, game.missionIndex, game.freeFlight);
}

function nextMission() {
  const next = (game.missionIndex + 1) % MISSIONS.length;
  plane = makePlane(MISSIONS[next].start);
  startMission(game, plane, next);
}

function startFreeFlight() {
  plane = makePlane(MISSIONS[0].start);
  startMission(game, plane, 0, true);
}

window.addEventListener('keydown', (e) => {
  ensureAudio(audio);
  if (game.state === 'menu') {
    if (e.code === 'Digit1') { plane = makePlane(MISSIONS[0].start); startMission(game, plane, 0); }
    if (e.code === 'Digit2') { plane = makePlane(MISSIONS[1].start); startMission(game, plane, 1); }
    if (e.code === 'Digit3') { plane = makePlane(MISSIONS[2].start); startMission(game, plane, 2); }
    if (e.code === 'KeyF') startFreeFlight();
  }
});
canvas.addEventListener('pointerdown', () => ensureAudio(audio));

function menuCamera(t) {
  const a = t * 0.045;
  const pos = [1100 + Math.cos(a) * 950, 520, 400 + Math.sin(a) * 950];
  const look = [1100, 40, 400];
  let f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1;
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const { r, u } = cameraBasis({ fwd: f });
  return { pos, fwd: f, right: r, up: u };
}

function drawMenu(t) {
  const cam = menuCamera(t);
  drawSky(ctx, cam, W, H, t);
  drawTerrain(ctx, renderer, cam, W, H);
  drawRunway(ctx, cam, W, H, t);
  drawClouds(ctx, renderer, cam, clouds, W, H);
  drawAircraft(ctx, renderer, cam, plane, t);
  // Title block.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,20,0.45)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 360, 84, 720, 150, 16); ctx.fill();
  ctx.fillStyle = '#ffb340';
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.fillText('M A K E . F U N   P R E S E N T S', W / 2, 116);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '700 64px system-ui, sans-serif';
  ctx.fillText('SKY LEGENDS', W / 2, 172);
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('—  LAST FLIGHT  —', W / 2, 208);
  // Mission list.
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 300, 268, 600, 218, 14); ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = '600 15px system-ui, sans-serif';
  const rows = [
    ['1', 'RING RUNNER', 'Thread 5 sky rings over the archipelago'],
    ['2', 'ISLAND EXPRESS', 'Timed sprint through 4 gates — stay low, stay fast'],
    ['3', 'SUNSET LANDING', 'Bring the Kestrel-9 home to Runway 09'],
    ['F', 'FREE FLIGHT', 'No clock, no rings — just you and the sunset'],
  ];
  rows.forEach(([key, name, desc], i) => {
    const y = 300 + i * 46;
    ctx.fillStyle = '#ffb340';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(`[${key}]`, W / 2 - 270, y);
    ctx.fillStyle = '#f4f6f8';
    ctx.font = '700 17px system-ui, sans-serif';
    ctx.fillText(name, W / 2 - 226, y);
    ctx.fillStyle = '#c8d2dc';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(desc, W / 2 - 226, y + 18);
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8b98a5';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('W/S pitch · A/D roll · Q/E yaw · Shift/Ctrl throttle · Space brake · Mouse camera · C cockpit · P pause', W / 2, 516);
  ctx.fillStyle = '#ffb340';
  ctx.font = '700 18px system-ui, sans-serif';
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  ctx.globalAlpha = pulse;
  ctx.fillText('Press ENTER or 1 / 2 / 3 to fly', W / 2, 556);
  ctx.globalAlpha = 1;
}

function drawEndScreen(title, lines, accent) {
  ctx.fillStyle = 'rgba(8,10,14,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,20,0.85)';
  ctx.beginPath(); ctx.roundRect(W / 2 - 320, 190, 640, 300, 16); ctx.fill();
  ctx.fillStyle = accent;
  ctx.font = '700 40px system-ui, sans-serif';
  ctx.fillText(title, W / 2, 250);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '600 17px system-ui, sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, W / 2, 296 + i * 30));
  ctx.fillStyle = '#ffb340';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText('R — fly again    ·    ENTER — next mission', W / 2, 448);
}

function frame(nowMs) {
  const now = nowMs / 1000;
  let dt = Math.min(0.05, now - lastNow);
  lastNow = now;
  clock = now;
  consumeOrbit(input);

  if (game.state === 'menu') {
    menuOrbit = now;
    drawMenu(now);
    requestAnimationFrame(frame);
    return;
  }

  const cam = game.camera === 'cockpit'
    ? cockpitCamera(plane, input)
    : chaseCamera(plane, input, null);

  if (game.state === 'playing' && !SHOT_MODE) {
    const events = stepFlight(plane, input, dt);
    const missionEvents = stepMissions(game, plane, events, dt, now);
    // Warnings.
    const warnings = [];
    if (plane.stalled) warnings.push({ text: '⚠ STALL — NOSE DOWN, ADD THROTTLE', color: '#ff5a4e', blink: true });
    if (plane.fuel < 25 && plane.fuel > 0) warnings.push({ text: 'LOW FUEL', color: '#ffb340', blink: true });
    if (plane.fuel <= 0) warnings.push({ text: 'FUEL EMPTY', color: '#ff5a4e', blink: true });
    if (plane.y < 60 && !plane.onGround && plane.speed > 30) {
      const ground = 0;
      if (plane.y < 40) warnings.push({ text: 'TERRAIN — PULL UP', color: '#ff5a4e', blink: true });
    }
    game.warnings = warnings;
    // Audio events.
    for (const e of [...events, ...missionEvents]) {
      if (e === 'ring') playRingChime(audio);
      if (e === 'thud' || e === 'landing' || e === 'perfect-landing') playThud(audio);
      if (e === 'crash' || e === 'ditch') playCrash(audio);
      if (e === 'stall-warn' && now - stallWarnedAt > 1.2) { playWarning(audio); stallWarnedAt = now; }
    }
    updateAudio(audio, plane, dt);
    if (warnCooldown > 0) warnCooldown -= dt;
  }

  drawSky(ctx, cam, W, H, now);
  drawTerrain(ctx, renderer, cam, W, H);
  drawRunway(ctx, cam, W, H, now);
  if (game.state !== 'menu') drawRings(ctx, cam, game.rings, game.nextRing, now);
  drawClouds(ctx, renderer, cam, clouds, W, H);
  if (game.camera === 'chase') drawAircraft(ctx, renderer, cam, plane, now);

  const objective = currentObjective(game);
  drawTopHud(ctx, W, plane, game.score, MISSIONS[game.missionIndex].name);
  if (game.camera === 'cockpit') drawCockpit(ctx, W, H, plane, game.score, objective);
  else drawInstrumentStrip(ctx, W, H, plane, game.score, objective);
  drawWarnings(ctx, W, H, game.warnings || [], game.popups, now);

  if (game.state === 'paused') {
    drawEndScreen('PAUSED', ['Take a breath, pilot. The sunset will wait.', `Score so far: ${game.score}`], '#6fd8ff');
  } else if (game.state === 'complete') {
    const s = missionSummary(game);
    const lines = [
      `${s.name} — COMPLETE`,
      `Time ${s.time.toFixed(1)}s · Rings ${s.rings} · Score ${s.score}`,
      game.achievements.size ? `Achievements: ${[...game.achievements].join(', ')}` : 'No achievements yet — fly again for more',
    ];
    drawEndScreen('MISSION COMPLETE', lines, '#7dff9a');
  } else if (game.state === 'crashed') {
    const s = missionSummary(game);
    drawEndScreen('FLIGHT OVER', [
      plane.damage >= 100 ? 'The Kestrel-9 is out of the sky.' : (game.message || 'The flight ended on the ground.'),
      `Score ${s.score} · Rings ${s.rings}`,
      'The sunset is still there. Fly it again.',
    ], '#ff5a4e');
  }

  clearPressed(input);
  requestAnimationFrame(frame);
}

if (selftestFromUrl()) {
  const result = runSelfTest();
  window.__skySelfTest = result;
} else {
  requestAnimationFrame(frame);
}
