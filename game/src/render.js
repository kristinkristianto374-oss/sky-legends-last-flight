// The renderer of SKY LEGENDS: a small 3D projection engine on a 2D canvas.
// One job: turn the world, the aircraft and the flight state into pictures.
// No game logic here — only projection and drawing.

import { COLORS, VIEW, RUNWAY, WORLD } from './config.js';
import { clamp, lerp, degToRad } from './random.js';
import { buildTerrainGrid, groundHeight, sunDirection, SUN } from './world.js';
import { aircraftFaces, aircraftToWorld, exhaustWorld } from './aircraft.js';

// ---- colour helpers (colours are [r, g, b] arrays) ----
function css(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mix(a, b, t) { return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
function hexRgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

const C = {};
for (const [k, v] of Object.entries(COLORS)) C[k] = hexRgb(v);
const FOG = C.fog;

function fogMix(c, depth, maxFog = 0.7) {
  const t = clamp((depth - 1200) / 2900, 0, maxFog);
  return mix(c, FOG, t);
}

function terrainBaseColor(y, land) {
  if (!land) {
    const depth = clamp(-y / 26, 0, 1);
    return mix(C.waterShallow, C.waterDeep, depth);
  }
  if (y < 3) return C.sand;
  if (y < 48) return mix(C.grass, C.forest, clamp((y - 3) / 45, 0, 1) * 0.7);
  if (y < 190) return mix(C.forest, C.rock, clamp((y - 48) / 142, 0, 1) * 0.8);
  if (y < 270) return C.rock;
  return C.snow;
}

export function makeRenderer() {
  const grid = buildTerrainGrid();
  const sun = sunDirection();
  // Precompute a lit colour per terrain vertex (sun shading is static).
  const vcol = new Float32Array(grid.n * grid.n * 3);
  for (let gz = 0; gz < grid.n; gz++) {
    for (let gy = 0; gy < grid.n; gy++) {
      const vi = gz * grid.n + gy;
      const x = grid.verts[vi * 4], y = grid.verts[vi * 4 + 1], z = grid.verts[vi * 4 + 2];
      const land = grid.verts[vi * 4 + 3] > 0.5;
      let col = terrainBaseColor(y, land);
      if (land) {
        const hx = groundHeight(x + 12, z) - groundHeight(x - 12, z);
        const hz = groundHeight(x, z + 12) - groundHeight(x, z - 12);
        const inv = 1 / Math.sqrt(hx * hx + 24 * 24 + hz * hz);
        const nx = -hx * inv, ny = 24 * inv, nz = -hz * inv;
        const light = 0.62 + 0.5 * Math.max(0, nx * sun.x + ny * sun.y + nz * sun.z);
        col = shade(col, light);
      } else {
        col = shade(col, 0.95);
      }
      vcol[vi * 3] = col[0]; vcol[vi * 3 + 1] = col[1]; vcol[vi * 3 + 2] = col[2];
    }
  }
  return { grid, vcol, sun, proj: null };
}

// ---- camera ----
export function cameraBasis(cam) {
  const f = cam.fwd;
  // right = normalize(cross(fwd, worldUp))
  const up0 = [0, 1, 0];
  let r = [
    f[1] * up0[2] - f[2] * up0[1],
    f[2] * up0[0] - f[0] * up0[2],
    f[0] * up0[1] - f[1] * up0[0],
  ];
  let rl = Math.hypot(r[0], r[1], r[2]) || 1;
  r = [r[0] / rl, r[1] / rl, r[2] / rl];
  const u = [
    r[1] * f[2] - r[2] * f[1],
    r[2] * f[0] - r[0] * f[2],
    r[0] * f[1] - r[1] * f[0],
  ];
  return { r, u };
}

export function chaseCamera(plane, input, smooth) {
  const dist = input.chaseDistance;
  const fwd = [Math.sin(plane.heading), 0, -Math.cos(plane.heading)];
  const yaw = plane.heading + input.orbitYaw;
  const back = [-Math.sin(yaw), 0, Math.cos(yaw)];
  const height = 2.0 + dist * (0.22 + input.orbitPitch);
  const pos = [plane.x + back[0] * dist, plane.y + height, plane.z + back[2] * dist];
  const look = [plane.x + fwd[0] * 12, plane.y + 0.5, plane.z + fwd[2] * 12];
  let f = [look[0] - pos[0], look[1] - pos[1], look[2] - pos[2]];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1;
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const { r, u } = cameraBasis({ fwd: f });
  // Bank the camera a little with the aircraft: it feels fast, never fights.
  const roll = plane.roll * 0.35;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r2 = [r[0] * cr - u[0] * sr, r[1] * cr - u[1] * sr, r[2] * cr - u[2] * sr];
  const u2 = [r[0] * sr + u[0] * cr, r[1] * sr + u[1] * cr, r[2] * sr + u[2] * cr];
  return { pos, fwd: f, right: r2, up: u2 };
}

export function cockpitCamera(plane, input) {
  const fwd0 = [Math.sin(plane.heading), 0, -Math.cos(plane.heading)];
  const cp = Math.cos(plane.pitch), sp = Math.sin(plane.pitch);
  let f = [fwd0[0] * cp, sp, fwd0[2] * cp];
  // Mouse look: small orbit offsets around the nose.
  const yaw = input.orbitYaw * 0.6, pitch = -input.orbitPitch * 0.4;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const fx = f[0] * cy - f[2] * sy, fz = f[0] * sy + f[2] * cy;
  f = [fx, f[1] + pitch * 0.4, fz];
  const fl = Math.hypot(f[0], f[1], f[2]) || 1;
  f = [f[0] / fl, f[1] / fl, f[2] / fl];
  const pos = [plane.x + fwd0[0] * 1.6, plane.y + 0.95, plane.z + fwd0[2] * 1.6];
  const { r, u } = cameraBasis({ fwd: f });
  const roll = plane.roll;
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const r2 = [r[0] * cr - u[0] * sr, r[1] * cr - u[1] * sr, r[2] * cr - u[2] * sr];
  const u2 = [r[0] * sr + u[0] * cr, r[1] * sr + u[1] * cr, r[2] * sr + u[2] * cr];
  return { pos, fwd: f, right: r2, up: u2 };
}

export function makeProjector(cam, W, H) {
  const focal = (H / 2) / Math.tan(degToRad(VIEW.fovDeg) / 2);
  return function project(x, y, z) {
    const dx = x - cam.pos[0], dy = y - cam.pos[1], dz = z - cam.pos[2];
    const cx = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
    const cy = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
    const cz = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
    if (cz < VIEW.near) return null;
    return { x: W / 2 + (cx * focal) / cz, y: H / 2 - (cy * focal) / cz, d: cz };
  };
}

// ---- sky ----
export function drawSky(ctx, cam, W, H, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COLORS.skyTop);
  g.addColorStop(0.42, COLORS.skyMid);
  g.addColorStop(0.62, COLORS.skyLow);
  g.addColorStop(0.78, COLORS.horizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars fading in at the top of the dusk sky.
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 70; i++) {
    const sx = ((i * 173.3) % W), sy = ((i * 97.7) % (H * 0.32));
    const a = 0.25 + 0.45 * Math.abs(Math.sin(i * 12.9898 + t * 0.4));
    ctx.globalAlpha = a * (1 - sy / (H * 0.4));
    ctx.fillRect(sx, sy, 1.6, 1.6);
  }
  ctx.globalAlpha = 1;
  // The sun: low in the west, big glow.
  const sunDir = sunDirection();
  const sp = { x: sunDir.x, y: sunDir.y, z: sunDir.z };
  const proj = makeProjector(cam, W, H);
  const s = proj(cam.pos[0] + sp.x * 3000, cam.pos[1] + sp.y * 3000, cam.pos[2] + sp.z * 3000);
  if (s) {
    const glow = ctx.createRadialGradient(s.x, s.y, 4, s.x, s.y, 190);
    glow.addColorStop(0, 'rgba(255,243,196,0.95)');
    glow.addColorStop(0.18, 'rgba(255,178,84,0.75)');
    glow.addColorStop(1, 'rgba(255,154,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(s.x - 200, s.y - 200, 400, 400);
    ctx.fillStyle = COLORS.sunCore;
    ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, Math.PI * 2); ctx.fill();
  }
  return s; // sun screen position (or null) for the water glitter
}

// ---- terrain + ocean ----
export function drawTerrain(ctx, r, cam, W, H) {
  const { grid, vcol } = r;
  const n = grid.n;
  const project = makeProjector(cam, W, H);
  const px = new Float32Array(n * n), py = new Float32Array(n * n), pd = new Float32Array(n * n);
  const ok = new Uint8Array(n * n);
  for (let i = 0; i < n * n; i++) {
    const p = project(grid.verts[i * 4], grid.verts[i * 4 + 1], grid.verts[i * 4 + 2]);
    if (p) { px[i] = p.x; py[i] = p.y; pd[i] = p.d; ok[i] = 1; }
  }
  // Collect visible quads, far to near.
  const quads = [];
  for (let gz = 0; gz < n - 1; gz++) {
    for (let gx = 0; gx < n - 1; gx++) {
      const a = gz * n + gx, b = a + 1, c = a + n, d = c + 1;
      if (!ok[a] && !ok[b] && !ok[c] && !ok[d]) continue;
      let depth = 0, cnt = 0;
      for (const vi of [a, b, c, d]) if (ok[vi]) { depth += pd[vi]; cnt++; }
      if (!cnt) continue;
      depth /= cnt;
      if (depth > VIEW.far) continue;
      quads.push({ a, b, c, d, depth });
    }
  }
  quads.sort((p, q) => q.depth - p.depth);
  for (const q of quads) {
    const idx = [q.a, q.b, q.d, q.c];
    let r0 = 0, g0 = 0, b0 = 0, cnt = 0, landSum = 0;
    for (const vi of idx) {
      if (!ok[vi]) continue;
      r0 += vcol[vi * 3]; g0 += vcol[vi * 3 + 1]; b0 += vcol[vi * 3 + 2]; cnt++;
      landSum += grid.verts[vi * 4 + 3];
    }
    if (!cnt) continue;
    const isLand = landSum / cnt > 0.5;
    const col = fogMix([r0 / cnt, g0 / cnt, b0 / cnt], q.depth, isLand ? 0.7 : 0.2);
    ctx.fillStyle = css(col);
    ctx.beginPath();
    let started = false;
    for (const vi of idx) {
      if (!ok[vi]) continue;
      if (!started) { ctx.moveTo(px[vi], py[vi]); started = true; }
      else ctx.lineTo(px[vi], py[vi]);
    }
    ctx.closePath();
    ctx.fill();
  }
}

// ---- runway ----
export function drawRunway(ctx, cam, W, H, t) {
  const project = makeProjector(cam, W, H);
  const L = RUNWAY.length / 2, Wd = RUNWAY.width / 2;
  const y = RUNWAY.height + 0.4;
  const corners = [
    [RUNWAY.x - L, y, RUNWAY.z - Wd], [RUNWAY.x + L, y, RUNWAY.z - Wd],
    [RUNWAY.x + L, y, RUNWAY.z + Wd], [RUNWAY.x - L, y, RUNWAY.z + Wd],
  ].map(([x, yy, z]) => project(x, yy, z));
  if (corners.some((p) => !p)) return;
  ctx.fillStyle = '#2b2f36';
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
  ctx.closePath(); ctx.fill();
  // Centreline dashes.
  ctx.fillStyle = '#f4f6f8';
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t0 = i / steps, t1 = (i + 0.45) / steps;
    const x0 = RUNWAY.x - L + t0 * RUNWAY.length, x1 = RUNWAY.x - L + t1 * RUNWAY.length;
    const p0 = project(x0, y + 0.15, RUNWAY.z), p1 = project(x1, y + 0.15, RUNWAY.z);
    if (!p0 || !p1) continue;
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y - 1); ctx.lineTo(p1.x, p1.y - 1);
    ctx.lineTo(p1.x, p1.y + 1); ctx.lineTo(p0.x, p0.y + 1);
    ctx.closePath(); ctx.fill();
  }
  // Threshold bars at the 09 end (west) and edge lights that blink softly.
  const blink = 0.55 + 0.45 * Math.sin(t * 2.4);
  for (let i = 0; i < 8; i++) {
    const zz = RUNWAY.z - Wd + (i + 0.5) * (RUNWAY.width / 8);
    for (const side of [-1, 1]) {
      const p = project(RUNWAY.x + side * L, y + 0.6, zz);
      if (!p) continue;
      ctx.fillStyle = `rgba(255,179,64,${blink})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const label = project(RUNWAY.x - L + 26, y + 0.8, RUNWAY.z);
  if (label) {
    ctx.fillStyle = '#f4f6f8';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('09', label.x, label.y);
  }
}

// ---- rings ----
export function drawRings(ctx, cam, rings, nextIndex, t) {
  const project = makeProjector(cam, 1280, 720);
  for (const ring of rings) {
    const isNext = ring.index === nextIndex;
    const col = ring.passed ? '#7dff9a' : isNext ? '#ffb340' : '#6fd8ff';
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const px = ring.x + Math.cos(a) * 0 + (-ring.fz) * Math.sin(a) * ring.radius;
      const py = ring.y + Math.cos(a) * ring.radius;
      const pz = ring.z + ring.fx * Math.sin(a) * ring.radius;
      const p = project(px, py, pz);
      if (p) pts.push(p);
    }
    if (pts.length < 8) continue;
    ctx.save();
    ctx.strokeStyle = col;
    ctx.lineWidth = isNext ? 7 : 4;
    ctx.shadowColor = col;
    ctx.shadowBlur = isNext ? 22 : 10;
    ctx.globalAlpha = ring.passed ? 0.45 : 0.95;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.stroke();
    ctx.restore();
    const top = project(ring.x, ring.y + ring.radius + 14, ring.z);
    if (top && !ring.passed) {
      ctx.fillStyle = col;
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(isNext ? `RING ${ring.index + 1}` : `${ring.index + 1}`, top.x, top.y);
    }
  }
}

// ---- clouds ----
export function drawClouds(ctx, r, cam, clouds, W, H) {
  const project = makeProjector(cam, W, H);
  const items = [];
  for (const c of clouds) {
    const p = project(c.x, c.y, c.z);
    if (!p || p.d > 3800) continue;
    items.push({ c, p });
  }
  items.sort((a, b) => b.p.d - a.p.d);
  for (const { c, p } of items) {
    const scale = 900 / p.d;
    for (const puff of c.puffs) {
      const pp = project(c.x + puff.dx, c.y + puff.dy, c.z + puff.dz);
      if (!pp) continue;
      const rad = puff.r * scale;
      const g = ctx.createRadialGradient(pp.x, pp.y, 0, pp.x, pp.y, rad);
      const tint = c.tint > 0.5 ? '255,227,208' : '255,214,196';
      g.addColorStop(0, `rgba(${tint},0.85)`);
      g.addColorStop(0.7, `rgba(${tint},0.4)`);
      g.addColorStop(1, `rgba(${tint},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(pp.x, pp.y, rad, rad * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ---- aircraft ----
export function drawAircraft(ctx, r, cam, plane, t) {
  const project = makeProjector(cam, 1280, 720);
  const sun = r.sun;
  const faces = aircraftFaces().map((f) => {
    const world = f.points.map(([x, y, z]) => aircraftToWorld(x, y, z, plane));
    const proj = world.map(([x, y, z]) => project(x, y, z));
    if (proj.some((p) => !p)) return null;
    let depth = 0;
    for (const p of proj) depth += p.d;
    depth /= proj.length;
    // Face lighting from the sun.
    const [a, b, c] = world;
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    n = [n[0] / nl, n[1] / nl, n[2] / nl];
    const light = 0.55 + 0.6 * Math.max(0, n[0] * sun.x + n[1] * sun.y + n[2] * sun.z);
    return { proj, depth, color: f.color, shade: f.shade * light };
  }).filter(Boolean);
  faces.sort((a, b) => b.depth - a.depth);
  for (const f of faces) {
    const rgb = hexRgb(f.color);
    const col = fogMix(shade(rgb, f.shade), f.depth);
    ctx.fillStyle = css(col);
    ctx.strokeStyle = 'rgba(10,12,16,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(f.proj[0].x, f.proj[0].y);
    for (let i = 1; i < f.proj.length; i++) ctx.lineTo(f.proj[i].x, f.proj[i].y);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Afterburner glow when the throttle is high.
  if (plane.throttle > 0.55 && !plane.onGround) {
    const [ex, ey, ez] = exhaustWorld(plane);
    const p = project(ex, ey, ez);
    if (p) {
      const s = (plane.throttle - 0.5) * 46 + 8;
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      g.addColorStop(0, 'rgba(255,220,130,0.95)');
      g.addColorStop(0.4, 'rgba(255,140,50,0.7)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, s, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Wingtip navigation lights: red on the left, green on the right.
  const tips = [
    { w: aircraftToWorld(0.4, 0.05, 4.4, plane), c: '#ff4040' },
    { w: aircraftToWorld(0.4, 0.05, -4.4, plane), c: '#4dff6a' },
  ];
  for (const t of tips) {
    const s = project(t.w[0], t.w[1], t.w[2]);
    if (s) {
      ctx.fillStyle = t.c;
      ctx.beginPath(); ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}
