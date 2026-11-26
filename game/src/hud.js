// Cockpit instruments and the HUD of SKY LEGENDS.
// One job: draw every number and gauge the pilot reads — altitude, speed,
// heading, throttle, fuel, score and the mission objective — plus the lit
// instrument panel that makes the cockpit feel flown, not drawn.

import { COLORS } from './config.js';
import { clamp, radToDeg, wrapAngle } from './random.js';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(16,20,27,0.88)';
  ctx.strokeStyle = '#2c3442';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill(); ctx.stroke();
}

function gaugeLabel(ctx, x, y, text) {
  ctx.fillStyle = '#8b98a5';
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

function gaugeValue(ctx, x, y, text, color = '#f4f6f8') {
  ctx.fillStyle = color;
  ctx.font = '700 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

// Artificial horizon: a ball that rolls and pitches with the aircraft.
export function drawArtificialHorizon(ctx, cx, cy, r, plane) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate(-plane.roll);
  ctx.translate(0, clamp(plane.pitch, -0.6, 0.6) * r * 1.4);
  ctx.fillStyle = '#7a5a34';
  ctx.fillRect(-r, 0, r * 2, r);
  ctx.fillStyle = '#e8b25a';
  ctx.fillRect(-r, -1.5, r * 2, 3);
  ctx.restore();
  ctx.strokeStyle = '#ffb340';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  // Fixed wings marker.
  ctx.strokeStyle = '#f4f6f8';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy); ctx.lineTo(cx - r * 0.18, cy);
  ctx.moveTo(cx + r * 0.18, cy); ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
}

// A round dial with a needle: used for airspeed and altitude.
export function drawDial(ctx, cx, cy, r, value, max, label, unit, color) {
  panel(ctx, cx - r - 6, cy - r - 6, (r + 6) * 2, (r + 6) * 2 + 18);
  ctx.fillStyle = '#0d1117';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a4556';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 0.75 + (i / 10) * Math.PI * 1.5;
    const x0 = cx + Math.cos(a) * (r - 4), y0 = cy + Math.sin(a) * (r - 4);
    const x1 = cx + Math.cos(a) * (r - 10), y1 = cy + Math.sin(a) * (r - 10);
    ctx.strokeStyle = '#8b98a5';
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
  const a = Math.PI * 0.75 + clamp(value / max, 0, 1) * Math.PI * 1.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(a) * (r - 12), cy + Math.sin(a) * (r - 12));
  ctx.stroke();
  ctx.shadowBlur = 0;
  gaugeLabel(ctx, cx, cy + r + 12, `${label} · ${unit}`);
}

// The lit instrument gauges, drawn at topY without a background panel.
export function drawInstrumentGauges(ctx, W, y, plane, score, objective) {
  drawArtificialHorizon(ctx, 78, y + 52, 34, plane);
  gaugeLabel(ctx, 78, y + 96, 'ATTITUDE');
  drawDial(ctx, 180, y + 44, 30, plane.speed * 3.6, 440, 'AIRSPEED', 'km/h', '#6fd8ff');
  drawDial(ctx, 268, y + 44, 30, Math.max(0, plane.y), 2000, 'ALTITUDE', 'm', '#7dff9a');
  // Heading compass tape.
  const hx = 350, hy = y + 52;
  gaugeLabel(ctx, hx + 90, y + 14, 'HEADING');
  const hdg = (radToDeg(plane.heading) + 360) % 360;
  ctx.save();
  ctx.beginPath(); ctx.rect(hx, y + 18, 180, 62); ctx.clip();
  const pts = [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W'], [360, 'N']];
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'center';
  for (const [deg, name] of pts) {
    let d = wrapAngle((deg - hdg) * Math.PI / 180) * 180 / Math.PI;
    if (Math.abs(d) > 64) continue;
    const x = hx + 90 + d * 1.4;
    ctx.fillStyle = Math.abs(d) < 2 ? '#ffb340' : '#c8d2dc';
    ctx.fillText(name, x, hy + 8);
  }
  // Tick marks every 15 degrees.
  ctx.strokeStyle = '#5a6673';
  for (let deg = 0; deg < 360; deg += 15) {
    let d = wrapAngle((deg - hdg) * Math.PI / 180) * 180 / Math.PI;
    if (Math.abs(d) > 64) continue;
    const x = hx + 90 + d * 1.4;
    ctx.beginPath(); ctx.moveTo(x, hy + 16); ctx.lineTo(x, hy + (deg % 45 === 0 ? 26 : 21)); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = '#ffb340';
  ctx.beginPath(); ctx.moveTo(hx + 90, y + 20); ctx.lineTo(hx + 90, y + 54); ctx.stroke();
  // Throttle + fuel bars.
  const bx = 560;
  gaugeLabel(ctx, bx + 55, y + 14, 'THROTTLE');
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(bx, y + 24, 110, 12);
  ctx.fillStyle = '#ffb340';
  ctx.fillRect(bx, y + 24, 110 * plane.throttle, 12);
  gaugeLabel(ctx, bx + 55, y + 56, 'FUEL');
  ctx.fillStyle = '#0d1117';
  ctx.fillRect(bx, y + 60, 110, 12);
  ctx.fillStyle = plane.fuel < 25 ? '#ff5a4e' : '#7dff9a';
  ctx.fillRect(bx, y + 60, 110 * (plane.fuel / 100), 12);
  // Score + objective.
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b98a5';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('FLIGHT SCORE', 700, y + 30);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '700 26px system-ui, sans-serif';
  ctx.fillText(String(score), 700, y + 60);
  ctx.fillStyle = '#ffb340';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.fillText(objective, 700, y + 88);
}

// Top HUD: altitude, speed, heading and score, readable at a glance.
export function drawTopHud(ctx, W, plane, score, missionName) {
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.beginPath(); ctx.roundRect(14, 12, 250, 64, 10); ctx.fill();
  ctx.fillStyle = '#8b98a5';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('ALTITUDE', 28, 32);
  ctx.fillText('SPEED', 150, 32);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(`${Math.max(0, Math.round(plane.y))} m`, 28, 60);
  ctx.fillText(`${Math.round(plane.speed * 3.6)} km/h`, 150, 60);

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  ctx.beginPath(); ctx.roundRect(W - 264, 12, 250, 64, 10); ctx.fill();
  ctx.fillStyle = '#8b98a5';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText('HEADING', W - 150, 32);
  ctx.fillText('SCORE', W - 28, 32);
  ctx.fillStyle = '#f4f6f8';
  ctx.font = '700 24px system-ui, sans-serif';
  const hdg = Math.round((radToDeg(plane.heading) + 360) % 360);
  ctx.fillText(`${String(hdg).padStart(3, '0')}°`, W - 150, 60);
  ctx.fillStyle = '#ffb340';
  ctx.fillText(String(score), W - 28, 60);

  // Mission name, centred.
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(10,14,20,0.55)';
  const mw = ctx.measureText(missionName).width + 36;
  ctx.beginPath(); ctx.roundRect(W / 2 - mw / 2, 12, mw, 30, 10); ctx.fill();
  ctx.fillStyle = '#ffd9a0';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText(missionName, W / 2, 32);
}

// Centre warnings and floating score popups.
export function drawWarnings(ctx, W, H, warnings, popups, t) {
  ctx.textAlign = 'center';
  let y = 96;
  for (const w of warnings) {
    const blink = w.blink ? (Math.sin(t * 10) > 0 ? 1 : 0.35) : 1;
    ctx.globalAlpha = blink;
    ctx.fillStyle = w.color;
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText(w.text, W / 2, y);
    y += 30;
    ctx.globalAlpha = 1;
  }
  for (const p of popups) {
    const age = (t - p.born) / 1.6;
    if (age > 1) continue;
    ctx.globalAlpha = 1 - age;
    ctx.fillStyle = p.color;
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(p.text, W / 2, 150 - age * 40);
    ctx.globalAlpha = 1;
  }
}

// The lit instrument strip shown under the chase view: panel + gauges.
export function drawInstrumentStrip(ctx, W, H, plane, score, objective) {
  const y = H - 118;
  panel(ctx, 14, y, W - 28, 104);
  drawInstrumentGauges(ctx, W, y, plane, score, objective);
}

// Full cockpit panel for the cockpit camera: frame + lit gauges.
export function drawCockpit(ctx, W, H, plane, score, objective) {
  // Slim canopy corner accents — kept clear of the top HUD boxes.
  ctx.fillStyle = 'rgba(12,14,18,0.92)';
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.lineTo(16, 4); ctx.lineTo(0, 0);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(W, 14); ctx.lineTo(W - 16, 4); ctx.lineTo(W, 0);
  ctx.closePath(); ctx.fill();
  ctx.fillRect(0, 0, W, 6);
  // Dashboard.
  panel(ctx, 0, H - 150, W, 150);
  drawInstrumentGauges(ctx, W, H - 140, plane, score, objective);
}
