// Input for SKY LEGENDS: keyboard flight controls and mouse camera.
// One job: turn raw DOM events into the game's input state. The flight model
// reads this state; nothing here knows about physics or rendering.
//
// Controls (exactly as the mission brief):
//   W/S pitch · A/D roll · Q/E yaw · Shift throttle up · Ctrl throttle down
//   Space brake · mouse drag orbits the chase camera · wheel zooms
//   P or Esc pause · R restart · C camera (chase / cockpit) · M mute

export function makeInput() {
  return {
    pitch: 0, roll: 0, yaw: 0,
    throttleUp: false, throttleDown: false, brake: false,
    keys: new Set(),
    mouseDown: false, mouseDX: 0, mouseDY: 0, wheel: 0,
    orbitYaw: 0, orbitPitch: 0.12, chaseDistance: 10.5,
    pressed: new Set(), // keys pressed since last consume (edge-triggered)
  };
}

const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space',
  'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
]);

export function attachInput(input, canvas, callbacks) {
  function recompute() {
    const k = input.keys;
    const pitchUp = k.has('KeyW') || k.has('ArrowUp');
    const pitchDown = k.has('KeyS') || k.has('ArrowDown');
    input.pitch = (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    const rollLeft = k.has('KeyA') || k.has('ArrowLeft');
    const rollRight = k.has('KeyD') || k.has('ArrowRight');
    input.roll = (rollLeft ? 1 : 0) - (rollRight ? 1 : 0);
    input.yaw = (k.has('KeyQ') ? 1 : 0) - (k.has('KeyE') ? 1 : 0);
    input.throttleUp = k.has('ShiftLeft') || k.has('ShiftRight');
    input.throttleDown = k.has('ControlLeft') || k.has('ControlRight');
    input.brake = k.has('Space');
  }

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    input.keys.add(e.code);
    input.pressed.add(e.code);
    recompute();
    if (e.code === 'KeyP' || e.code === 'Escape') callbacks.onPause();
    if (e.code === 'KeyR') callbacks.onRestart();
    if (e.code === 'KeyC') callbacks.onCamera();
    if (e.code === 'KeyM') callbacks.onMute();
    if (e.code === 'Enter') callbacks.onConfirm();
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    recompute();
  });
  window.addEventListener('blur', () => { input.keys.clear(); recompute(); });

  canvas.addEventListener('mousedown', (e) => { input.mouseDown = true; });
  window.addEventListener('mouseup', () => { input.mouseDown = false; });
  window.addEventListener('mousemove', (e) => {
    if (!input.mouseDown) return;
    input.mouseDX += e.movementX || 0;
    input.mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    input.chaseDistance = Math.max(8, Math.min(26, input.chaseDistance + (e.deltaY > 0 ? 1.5 : -1.5)));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

// Consume the accumulated mouse drag as camera orbit deltas (radians).
export function consumeOrbit(input) {
  const dx = input.mouseDX * 0.004, dy = input.mouseDY * 0.003;
  input.mouseDX = 0; input.mouseDY = 0;
  input.orbitYaw = Math.max(-1.2, Math.min(1.2, input.orbitYaw - dx));
  input.orbitPitch = Math.max(-0.15, Math.min(0.55, input.orbitPitch + dy));
  return { dx, dy };
}

// True once after a key is pressed; used for edge-triggered actions.
export function wasPressed(input, code) {
  if (input.pressed.has(code)) { input.pressed.delete(code); return true; }
  return false;
}
export function clearPressed(input) { input.pressed.clear(); }
