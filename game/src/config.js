// SKY LEGENDS: LAST FLIGHT — tuning constants, colours and mission definitions.
// One job: every number the game balances on lives here, so tuning never hunts
// through the renderer or the flight model.

export const WORLD = {
  seed: 20261126,
  size: 4200, // world spans x,z in [-2100, 2100]
  oceanLevel: 0,
  cell: 100, // terrain grid cell in metres
  gridHalf: 21, // samples per side: 43 x 43 = 1849 quads
};

export const ISLANDS = [
  { x: 300, z: 400, r: 950, peak: 290, name: 'Aurea Isle' },
  { x: -1300, z: -900, r: 640, peak: 200, name: 'Kestrel Rock' },
  { x: 1400, z: -1150, r: 540, peak: 165, name: 'Ember Cay' },
  { x: -950, z: 1250, r: 420, peak: 95, name: 'Turtle Back' },
  { x: 1550, z: 950, r: 360, peak: 75, name: 'Gull Rest' },
];

// Runway 09 on Aurea Isle's east coast: flat strip, heading east (090),
// so takeoffs and landings run out over the open ocean, not into the peak.
export const RUNWAY = {
  x: 1100, z: 400, length: 420, width: 56, headingDeg: 90, height: 14,
};

export const FLIGHT = {
  maxSpeed: 122, // m/s
  cruiseSpeed: 68,
  minFlySpeed: 27, // below this the wing stalls
  maxThrustAccel: 26, // m/s^2 at full throttle
  drag: 0.0016, // quadratic drag coefficient
  brakeDrag: 0.09, // extra drag while Space is held
  pitchRate: 0.85, // rad/s at full input
  rollRate: 1.9, // rad/s
  yawRate: 0.5, // rad/s rudder
  maxRoll: 1.15, // rad, soft-clamped
  maxPitch: 0.62,
  fuelCapacity: 100,
  fuelBurn: 1.35, // per second at full throttle (percent)
  groundClearance: 1.6,
  landingMaxSink: 4.5, // m/s vertical speed allowed for a good touchdown
  landingMaxRoll: 0.22,
  landingMaxHeadingErr: 0.30, // rad off runway heading
};

export const RING_RADIUS = 26;

export const MISSIONS = [
  {
    id: 'ring-runner',
    name: 'MISSION 1 — RING RUNNER',
    brief: 'Thread all five sky rings over the archipelago. Smooth turns win: bank, don’t yank.',
    rings: [
      { x: 1500, y: 120, z: 250 },
      { x: 1650, y: 150, z: -300 },
      { x: 1400, y: 180, z: -800 },
      { x: 900, y: 160, z: -900 },
      { x: 320, y: 140, z: -1120 },
    ],
    parSeconds: 150,
    start: { x: 1100, y: 16, z: 400, headingDeg: 90 },
  },
  {
    id: 'island-express',
    name: 'MISSION 2 — ISLAND EXPRESS',
    brief: 'A timed sprint through four gates. Stay low for the bonus, stay fast for the clock.',
    rings: [
      { x: 700, y: 150, z: 620 },
      { x: -350, y: 110, z: -300 },
      { x: -900, y: 150, z: -1400 },
      { x: 1150, y: 160, z: -1300 },
    ],
    parSeconds: 120,
    lowAltBonus: 120,
    start: { x: 1100, y: 16, z: 400, headingDeg: 90 },
  },
  {
    id: 'sunset-landing',
    name: 'MISSION 3 — SUNSET LANDING',
    brief: 'Come home to Runway 09 on Aurea Isle. Gentle descent, wings level, on the centreline.',
    rings: [
      { x: 1600, y: 180, z: 400 },
      { x: 1150, y: 80, z: 400 },
    ],
    parSeconds: 180,
    landing: true,
    start: { x: 2000, y: 240, z: 400, headingDeg: 270, speed: 70, throttle: 0.55 },
  },
];

export const ACHIEVEMENTS = [
  { id: 'first-ring', name: 'First Ring', desc: 'Thread your first sky ring', score: 100 },
  { id: 'low-rider', name: 'Low Rider', desc: 'Fly below 50 m for 5 seconds', score: 150 },
  { id: 'high-flyer', name: 'High Flyer', desc: 'Climb above 1500 m', score: 150 },
  { id: 'perfect-landing', name: 'Perfect Landing', desc: 'Touch down softer than 2 m/s', score: 300 },
  { id: 'fuel-saver', name: 'Fuel Saver', desc: 'Finish a mission with 40% fuel left', score: 200 },
  { id: 'ace', name: 'Sky Ace', desc: 'Finish all three missions', score: 500 },
];

export const COLORS = {
  skyTop: '#1d2a52',
  skyMid: '#7a4a7a',
  skyLow: '#e2694e',
  horizon: '#ffb36b',
  fog: '#f0a06e',
  sunCore: '#fff3c4',
  sunGlow: '#ff9a3c',
  waterDeep: '#14395e',
  waterShallow: '#2e7d9b',
  waterGlitter: '#ffd9a0',
  sand: '#d9b380',
  grass: '#5d8140',
  forest: '#3d5c2a',
  rock: '#7a7268',
  snow: '#e9e9ee',
  panel: '#14181f',
  panelEdge: '#2c3442',
  gaugeFace: '#0d1117',
  gaugeAmber: '#ffb340',
  gaugeGreen: '#7dff9a',
  gaugeRed: '#ff5a4e',
  gaugeCyan: '#6fd8ff',
  hudText: '#f4f6f8',
};

export const VIEW = { width: 1280, height: 720, fovDeg: 68, near: 0.6, far: 4200 };
