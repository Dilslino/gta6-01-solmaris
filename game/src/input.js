// Keyboard + mouse input. Held keys steer; one-shot presses are queued as flags.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;
export const ACTION_WEAPON = 16;
export const ACTION_MUTE = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const PUNCH = new Set(['KeyF']);
const WEAPON = new Set(['KeyQ']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  const mouse = { x: 640, y: 360, down: false };
  let clicked = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code); event.preventDefault();
    } else if (CONFIRM.has(event.code)) { if (!event.repeat) actions |= ACTION_CONFIRM; event.preventDefault(); }
    else if (PAUSE.has(event.code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (INTERACT.has(event.code)) { if (!event.repeat) actions |= ACTION_INTERACT; }
    else if (PUNCH.has(event.code)) { if (!event.repeat) actions |= ACTION_PUNCH; }
    else if (WEAPON.has(event.code)) { if (!event.repeat) actions |= ACTION_WEAPON; }
    else if (event.code === 'KeyM') { if (!event.repeat) actions |= ACTION_MUTE; }
  });
  window.addEventListener('keyup', (event) => { held.delete(event.code); });
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });
  function track(e) {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  }
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerdown', (e) => { track(e); mouse.down = true; clicked = true; });
  window.addEventListener('pointerup', () => { mouse.down = false; });

  return {
    axis() {
      let x = 0, y = 0;
      for (const c of held) {
        if (UP.has(c)) y -= 1;
        if (DOWN.has(c)) y += 1;
        if (LEFT.has(c)) x -= 1;
        if (RIGHT.has(c)) x += 1;
      }
      return { x, y };
    },
    mouse() { return mouse; },
    takeClick() { const c = clicked; clicked = false; return c; },
    takeActions() { const a = actions; actions = 0; return a; },
  };
}
