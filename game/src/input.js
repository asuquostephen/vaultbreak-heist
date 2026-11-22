// Keyboard and mouse state for the game: held keys, one-shot presses, and
// the mouse position in canvas coordinates (used to aim a thrown coin).
// One-shot presses are how the game hears single taps — B for Blackout
// Mode, Q for the EMP, P to pause — while held keys drive movement and E.

const held = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, clicked: false, down: false };

let attached = false;

// Keys whose default browser action would steal the game (scrolling).
const SWALLOWED = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (event) => {
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
    if (SWALLOWED.includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    trackMouse(event, canvas);
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse.clicked = true;
    mouse.down = true;
    trackMouse(event, canvas);
    event.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
}

// Mouse position in canvas coordinates, from a pointer event.
function trackMouse(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
  mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
}

// Call once per frame, after the update has read everything.
export function endFrameInput() {
  pressed.clear();
  mouse.clicked = false;
}

export function isHeld(...codes) {
  return codes.some((code) => held.has(code));
}

export function wasPressed(...codes) {
  return codes.some((code) => pressed.has(code));
}

export function getMouse() {
  return mouse;
}

// Is the thief sneaking right now — either Shift key held down.
export function sneakHeld() {
  return isHeld('ShiftLeft', 'ShiftRight');
}

// Movement keys, as (dx, dy) pairs: left, right, up, down.
const MOVE_KEYS = [
  { codes: ['KeyA', 'ArrowLeft'], dx: -1, dy: 0 },
  { codes: ['KeyD', 'ArrowRight'], dx: 1, dy: 0 },
  { codes: ['KeyW', 'ArrowUp'], dx: 0, dy: -1 },
  { codes: ['KeyS', 'ArrowDown'], dx: 0, dy: 1 },
];

// Movement vector from the keys, normalised: x right, y down.
export function moveVector() {
  let x = 0;
  let y = 0;
  for (const key of MOVE_KEYS) {
    if (isHeld(...key.codes)) {
      x += key.dx;
      y += key.dy;
    }
  }
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
