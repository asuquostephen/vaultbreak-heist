// Keyboard and mouse state for the game: held keys, one-shot presses, and
// the mouse position in canvas coordinates (used to aim a thrown coin).

const held = new Set();
const pressed = new Set();
const mouse = { x: 0, y: 0, clicked: false, down: false };

let attached = false;

export function attachInput(canvas) {
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', (event) => {
    if (!held.has(event.code)) pressed.add(event.code);
    held.add(event.code);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.down = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
  });
  canvas.addEventListener('mousedown', (event) => {
    mouse.clicked = true;
    mouse.down = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    mouse.y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    event.preventDefault();
  });
  window.addEventListener('mouseup', () => {
    mouse.down = false;
  });
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

// Movement vector from the keys, normalised: x right, y down.
export function moveVector() {
  let x = 0;
  let y = 0;
  if (isHeld('KeyA', 'ArrowLeft')) x -= 1;
  if (isHeld('KeyD', 'ArrowRight')) x += 1;
  if (isHeld('KeyW', 'ArrowUp')) y -= 1;
  if (isHeld('KeyS', 'ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) {
    const inv = 1 / Math.sqrt(2);
    x *= inv;
    y *= inv;
  }
  return { x, y };
}
