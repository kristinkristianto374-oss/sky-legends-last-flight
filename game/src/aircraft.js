// The aircraft of SKY LEGENDS: "Kestrel-9", a sunset-orange stunt jet.
// One job: the model's polygons in local space, and the transform that puts
// them into the world. The renderer projects them; this file only builds them.
//
// Local axes: +X forward (nose), +Y up, +Z to the pilot's left.
// The livery is original: cream fuselage, sunset-orange wings, teal tail flash.

export const AIRCRAFT_LENGTH = 11;

function poly(points, color, shade = 1) {
  return { points, color, shade };
}

// Vertices are [x, y, z] triples. Faces are listed far-to-near by the
// renderer using their average depth, so order here does not matter.
export function aircraftFaces() {
  const C = {
    cream: '#f2ead8', orange: '#e86a2c', deepOrange: '#c24e1a',
    teal: '#1f7a72', dark: '#232a33', glass: '#9fd8e8', metal: '#8b98a5',
    flame: '#ffb340',
  };
  const faces = [];
  // Fuselage: a tapered hexagonal prism, nose at +5.5, tail at -5.5.
  const nose = [5.5, 0, 0];
  const ring1 = [[4.2, 0.55, 0], [4.2, 0.28, 0.5], [4.2, -0.28, 0.5], [4.2, -0.55, 0], [4.2, -0.28, -0.5], [4.2, 0.28, -0.5]];
  const ring2 = [[-1.5, 0.75, 0], [-1.5, 0.42, 0.72], [-1.5, -0.42, 0.72], [-1.5, -0.75, 0], [-1.5, -0.42, -0.72], [-1.5, 0.42, -0.72]];
  const ring3 = [[-5.5, 0.6, 0], [-5.5, 0.34, 0.58], [-5.5, -0.34, 0.58], [-5.5, -0.6, 0], [-5.5, -0.34, -0.58], [-5.5, 0.34, -0.58]];
  // Nose cone (6 triangles fanning from the nose tip).
  for (let i = 0; i < 6; i++) {
    const a = ring1[i], b = ring1[(i + 1) % 6];
    faces.push(poly([nose, a, b], i < 2 ? C.cream : C.orange, i === 0 ? 1.15 : 1));
  }
  // Fuselage sides (quads split into two triangles each).
  for (let i = 0; i < 6; i++) {
    const a = ring1[i], b = ring1[(i + 1) % 6];
    const c = ring2[(i + 1) % 6], d = ring2[i];
    const col = i === 0 ? C.cream : i === 3 ? C.deepOrange : C.orange;
    faces.push(poly([a, b, c], col, 1.05));
    faces.push(poly([a, c, d], col, 0.95));
    const e = ring3[i], f = ring3[(i + 1) % 6];
    faces.push(poly([d, c, f], C.cream, 0.9));
    faces.push(poly([d, f, e], C.cream, 0.85));
  }
  // Canopy: a glass bubble on top of the fuselage.
  faces.push(poly([[3.6, 0.55, 0], [1.2, 0.95, 0], [1.2, 0.95, 0.42], [3.6, 0.55, 0.42]], C.glass, 1.25));
  faces.push(poly([[3.6, 0.55, 0], [3.6, 0.55, -0.42], [1.2, 0.95, -0.42], [1.2, 0.95, 0]], C.glass, 1.1));
  faces.push(poly([[1.2, 0.95, -0.42], [1.2, 0.95, 0.42], [0.4, 0.72, 0.42], [0.4, 0.72, -0.42]], C.glass, 1.2));
  // Main wings: swept, thin, sunset orange with cream tips.
  for (const side of [1, -1]) {
    const s = side;
    faces.push(poly([[-0.6, 0.05, 0.5 * s], [-2.6, 0.12, 3.9 * s], [-3.4, 0.12, 3.75 * s], [-1.6, 0.05, 0.62 * s]], C.orange, 1.05));
    faces.push(poly([[-2.6, 0.12, 3.9 * s], [-3.4, 0.12, 3.75 * s], [-3.55, 0.12, 4.25 * s], [-2.75, 0.12, 4.4 * s]], C.cream, 1.1));
    // Tailplanes.
    faces.push(poly([[-4.2, 0.1, 0.4 * s], [-5.3, 0.14, 2.1 * s], [-5.7, 0.14, 2.0 * s], [-4.7, 0.1, 0.5 * s]], C.deepOrange, 1));
  }
  // Vertical stabiliser with teal flash.
  faces.push(poly([[-3.9, 0.4, 0], [-5.6, 0.5, 0], [-5.6, 2.1, 0], [-4.4, 1.9, 0]], C.teal, 1.1));
  faces.push(poly([[-5.6, 0.5, 0], [-5.6, 2.1, 0], [-5.25, 2.1, 0], [-5.25, 0.5, 0]], C.cream, 1));
  // Engine nozzles + afterburner glow points (the renderer draws the glow).
  faces.push(poly([[-5.5, 0.34, 0.58], [-5.5, -0.34, 0.58], [-5.5, -0.34, -0.58], [-5.5, 0.34, -0.58]], C.dark, 0.8));
  return faces;
}

// Rotate a local point by the aircraft's heading / pitch / roll into world space.
export function aircraftToWorld(px, py, pz, plane) {
  // Local +X forward, +Y up, +Z left. Apply roll, then pitch, then heading.
  // The model is scaled up 1.25x so it reads clearly in the chase view.
  px *= 1.25; py *= 1.25; pz *= 1.25;
  const cr = Math.cos(plane.roll), sr = Math.sin(plane.roll);
  let x = px, y = py * cr - pz * sr, z = py * sr + pz * cr;
  const cp = Math.cos(plane.pitch), sp = Math.sin(plane.pitch);
  const y2 = y * cp - x * sp, x2 = y * sp + x * cp;
  y = y2; x = x2;
  const ch = Math.cos(plane.heading), sh = Math.sin(plane.heading);
  // forward = (sin h, 0, -cos h); left = (cos h, 0, sin h)
  const wx = plane.x + x * sh + z * ch;
  const wz = plane.z + x * -ch + z * sh;
  const wy = plane.y + y;
  return [wx, wy, wz];
}

// Exhaust position in world space, for the afterburner glow.
export function exhaustWorld(plane) {
  return aircraftToWorld(-5.7, 0, 0, plane);
}
