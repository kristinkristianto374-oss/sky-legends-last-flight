// Missions and scoring for SKY LEGENDS.
// One job: track what the pilot has to do next, award points, and remember
// achievements. It never touches the renderer or the physics.

import { MISSIONS, ACHIEVEMENTS } from './config.js';
import { buildRings } from './world.js';
import { ringPassDistance } from './flight.js';

export function makeGame() {
  return {
    missionIndex: 0,
    state: 'menu', // menu | playing | paused | complete | crashed
    score: 0,
    rings: [],
    nextRing: 0,
    missionTime: 0,
    message: '',
    messageUntil: 0,
    popups: [],
    achievements: new Set(),
    finishedMissions: new Set(),
    lowAltNotified: false,
    camera: 'chase', // chase | cockpit
    muted: false,
    freeFlight: false,
  };
}

export function startMission(game, plane, index, freeFlight = false) {
  const mission = MISSIONS[index];
  game.missionIndex = index;
  game.freeFlight = freeFlight;
  game.rings = buildRings(mission);
  game.nextRing = 0;
  game.missionTime = 0;
  game.score = freeFlight ? game.score : 0;
  game.popups = [];
  game.state = 'playing';
  game.lowAltNotified = false;
  return mission;
}

export function currentObjective(game) {
  if (game.freeFlight) return 'FREE FLIGHT — explore the archipelago';
  const mission = MISSIONS[game.missionIndex];
  if (game.nextRing < game.rings.length) {
    return `Fly through RING ${game.nextRing + 1} of ${game.rings.length}`;
  }
  if (mission.landing) return 'Land on Runway 09 — gentle and level';
  return 'All rings cleared — mission complete';
}

function award(game, points, text, t) {
  game.score += points;
  game.popups.push({ text: `${text}  +${points}`, born: t, color: '#ffb340' });
}

export function grantAchievement(game, id, t) {
  if (game.achievements.has(id)) return;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) return;
  game.achievements.add(id);
  game.score += a.score;
  game.popups.push({ text: `ACHIEVEMENT — ${a.name}  +${a.score}`, born: t, color: '#7dff9a' });
}

// One update per frame while playing. Returns event strings for audio.
export function stepMissions(game, plane, events, dt, t) {
  const out = [];
  if (game.state !== 'playing') return out;
  game.missionTime += dt;
  const mission = MISSIONS[game.missionIndex];

  // Ring passing: crossing the ring's plane within its radius counts.
  if (game.nextRing < game.rings.length) {
    const ring = game.rings[game.nextRing];
    const { along, radial } = ringPassDistance(plane, ring);
    if (Math.abs(along) < 6 && radial < ring.radius) {
      ring.passed = true;
      game.nextRing++;
      award(game, 250, `RING ${ring.index + 1} CLEARED`, t);
      out.push('ring');
      grantAchievement(game, 'first-ring', t);
      if (game.nextRing >= game.rings.length && !mission.landing) {
        finishMission(game, mission, t);
      }
    }
  }

  // Low-altitude bonus in the express mission.
  if (mission.lowAltBonus && plane.y < 50 && !plane.onGround && plane.speed > 40) {
    game.lowBonus = (game.lowBonus || 0) + dt;
    if (game.lowBonus > 5 && !game.lowAltNotified) {
      game.lowAltNotified = true;
      award(game, mission.lowAltBonus, 'LOW-ALTITUDE BONUS', t);
    }
  }

  // Achievements from flight state.
  if (plane.y > 1500) grantAchievement(game, 'high-flyer', t);
  if (plane.lowTime > 5) grantAchievement(game, 'low-rider', t);

  for (const e of events) {
    if (e === 'landing' || e === 'perfect-landing') {
      if (mission.landing && game.nextRing >= game.rings.length) {
        const quality = e === 'perfect-landing' ? 1000 : 500;
        award(game, quality, e === 'perfect-landing' ? 'PERFECT LANDING' : 'LANDED', t);
        if (e === 'perfect-landing') grantAchievement(game, 'perfect-landing', t);
        finishMission(game, mission, t);
      } else if (!mission.landing) {
        // Landed early in a ring mission: not a crash, just a stop.
        game.message = 'You landed. Press R to fly again.';
        game.state = 'crashed';
        out.push('landed-early');
      }
    }
    if (e === 'hard-landing') {
      game.popups.push({ text: 'HARD LANDING — airframe damaged', born: t, color: '#ff5a4e' });
      out.push('thud');
    }
    if (e === 'crash' || e === 'ditch') {
      game.state = 'crashed';
      out.push(e === 'ditch' ? 'ditch' : 'crash');
    }
    if (e === 'stall') out.push('stall-warn');
  }

  // Fuel out while airborne: glide to the ground, then it is over.
  if (plane.fuel <= 0 && !plane.onGround) {
    game.popups.push({ text: 'FUEL EMPTY — gliding', born: t, color: '#ff5a4e' });
  }
  return out;
}

function finishMission(game, mission, t) {
  const timeBonus = Math.max(0, Math.round((mission.parSeconds - game.missionTime) * 5));
  if (timeBonus > 0) award(game, timeBonus, 'TIME BONUS', t);
  if (game.planeFuelAtFinish > 40) grantAchievement(game, 'fuel-saver', t);
  game.finishedMissions.add(mission.id);
  game.state = 'complete';
  if (game.finishedMissions.size >= MISSIONS.length) grantAchievement(game, 'ace', t);
}

export function missionSummary(game) {
  const mission = MISSIONS[game.missionIndex];
  return {
    name: mission.name,
    time: game.missionTime,
    score: game.score,
    rings: `${game.nextRing}/${game.rings.length}`,
  };
}
