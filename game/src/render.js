// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// logical view is scaled to fit the window. Top-down 2.5D: buildings get a side face so
// they read as blocks, cars and people are drawn in the round, and the HUD carries the
// mission, the wanted stars, cash, health and a circular minimap.
import { AVENUES, BEACH_Y, DISTRICTS, FONT, MISSIONS, PALETTE, ROAD_W, SHOPS, STREETS, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_SHOP = 'shop';
export const SCREEN_COMPLETE = 'complete';

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }
  function roundRect(x, y, w, h, r) {
    context.beginPath();
    context.moveTo(x + r, y);
    context.arcTo(x + w, y, x + w, y + h, r);
    context.arcTo(x + w, y + h, x, y + h, r);
    context.arcTo(x, y + h, x, y, r);
    context.arcTo(x, y, x + w, y, r);
    context.closePath();
  }
  function panel(x, y, w, h, alpha) {
    context.fillStyle = `rgba(10,14,20,${alpha === undefined ? 0.78 : alpha})`;
    roundRect(x, y, w, h, 10);
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.18)';
    context.lineWidth = 1;
    context.stroke();
  }

  function drawWorld(state) {
    const camX = Math.max(0, Math.min(WORLD.width - VIEW.width, state.camera.x - VIEW.width / 2));
    const camY = Math.max(0, Math.min(WORLD.height - VIEW.height, state.camera.y - VIEW.height / 2));
    const city = state.city;
    const t = state.time;
    const X = (x) => x - camX;
    const Y = (y) => y - camY;

    // Ground + district tints.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const d of DISTRICTS) {
      context.fillStyle = d.tint;
      context.globalAlpha = 0.22;
      context.fillRect(X(d.x), Y(d.y), d.w, d.h);
      context.globalAlpha = 1;
    }
    for (const p of city.parks) {
      context.fillStyle = PALETTE.park;
      context.fillRect(X(p.x), Y(p.y), p.w, p.h);
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(X(p.x + 40), Y(p.y + 40), p.w - 80, 10);
    }
    context.fillStyle = PALETTE.plaza;
    context.fillRect(X(city.plaza.x), Y(city.plaza.y), city.plaza.w, city.plaza.h);

    // Beach + sea.
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, Y(BEACH_Y), VIEW.width, VIEW.height - Y(BEACH_Y));
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, Y(BEACH_Y + 150), VIEW.width, VIEW.height - Y(BEACH_Y + 150));
    context.fillStyle = PALETTE.seaDeep;
    context.fillRect(0, Y(BEACH_Y + 210), VIEW.width, VIEW.height - Y(BEACH_Y + 210));
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 2;
    for (let i = 0; i < 5; i += 1) {
      const wy = Y(BEACH_Y + 150 + i * 26) + Math.sin(t * 1.4 + i * 1.7) * 4;
      context.beginPath();
      context.moveTo(0, wy);
      for (let x = 0; x <= VIEW.width; x += 40) context.lineTo(x, wy + Math.sin(x * 0.02 + t + i) * 3);
      context.stroke();
    }

    // Roads: sidewalk border, asphalt, centre dashes.
    for (const ax of AVENUES) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(X(ax - ROAD_W / 2 - 12), Y(0), ROAD_W + 24, VIEW.height);
      context.fillStyle = PALETTE.road;
      context.fillRect(X(ax - ROAD_W / 2), Y(0), ROAD_W, VIEW.height);
    }
    for (const sy of STREETS) {
      context.fillStyle = PALETTE.sidewalk;
      context.fillRect(0, Y(sy - ROAD_W / 2 - 12), VIEW.width, ROAD_W + 24);
      context.fillStyle = PALETTE.road;
      context.fillRect(0, Y(sy - ROAD_W / 2), VIEW.width, ROAD_W);
    }
    // Beach road.
    context.fillStyle = PALETTE.road;
    context.fillRect(0, Y(BEACH_Y - 60 - ROAD_W / 2), VIEW.width, ROAD_W);
    // Intersections back over the dashes.
    for (const ax of AVENUES) for (const sy of STREETS) {
      context.fillStyle = PALETTE.road;
      context.fillRect(X(ax - ROAD_W / 2), Y(sy - ROAD_W / 2), ROAD_W, ROAD_W);
    }
    // Dashes.
    context.fillStyle = PALETTE.dash;
    for (const ax of AVENUES) {
      for (let y = 0; y < WORLD.height; y += 64) {
        if (STREETS.some((s) => Math.abs(y - s) < ROAD_W / 2 + 10)) continue;
        context.fillRect(X(ax - 2), Y(y), 4, 30);
      }
    }
    for (const sy of STREETS) {
      for (let x = 0; x < WORLD.width; x += 64) {
        if (AVENUES.some((a) => Math.abs(x - a) < ROAD_W / 2 + 10)) continue;
        context.fillRect(X(x), Y(sy - 2), 30, 4);
      }
    }
    // District name labels on the ground.
    context.fillStyle = 'rgba(255,255,255,0.55)';
    for (const d of DISTRICTS) {
      const lx = X(d.x + d.w / 2), ly = Y(d.y + d.h / 2);
      if (lx > -100 && lx < VIEW.width + 100 && ly > -40 && ly < VIEW.height + 40) {
        text(d.name.toUpperCase(), lx, ly, 26, 'rgba(255,255,255,0.5)', 'center', true);
      }
    }

    // Buildings: side face (2.5D) then roof.
    for (const b of city.buildings) {
      const bx = X(b.x), by = Y(b.y);
      if (bx > VIEW.width + 80 || bx + b.w < -80 || by > VIEW.height + 80 || by + b.h < -80) continue;
      const drop = b.hgt * 0.55;
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(bx + 6, by + drop + 4, b.w, b.h);
      context.fillStyle = '#6d5c4d';
      context.fillRect(bx, by + drop, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(bx, by, b.w, b.h);
      context.strokeStyle = 'rgba(0,0,0,0.25)';
      context.lineWidth = 2;
      context.strokeRect(bx + 3, by + 3, b.w - 6, b.h - 6);
      if (b.tall) {
        context.fillStyle = 'rgba(255,255,255,0.75)';
        for (let wy = by + 12; wy < by + b.h - 12; wy += 18) {
          for (let wx = bx + 12; wx < bx + b.w - 12; wx += 22) context.fillRect(wx, wy, 10, 7);
        }
      } else {
        context.fillStyle = 'rgba(0,0,0,0.18)';
        context.fillRect(bx + b.w / 2 - 14, by + b.h / 2 - 10, 28, 20);
      }
    }

    // Trees.
    for (const tr of city.trees) {
      const tx = X(tr.x), ty = Y(tr.y);
      if (tx < -30 || tx > VIEW.width + 30 || ty < -30 || ty > VIEW.height + 30) continue;
      context.fillStyle = '#5b4632';
      context.fillRect(tx - 2, ty - 2, 4, 6);
      context.fillStyle = tr.palm ? '#2f9e5f' : '#3e8e41';
      context.beginPath();
      context.arc(tx, ty - 4, tr.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.2)';
      context.beginPath();
      context.arc(tx - 3, ty - 8, tr.r * 0.4, 0, Math.PI * 2);
      context.fill();
    }

    // Shops: awning + sign.
    for (const s of SHOPS) {
      const sx = X(s.x + s.dx), sy = Y(s.y + s.dy);
      if (sx < -120 || sx > VIEW.width + 120 || sy < -60 || sy > VIEW.height + 60) continue;
      context.fillStyle = s.color;
      roundRect(sx - 52, sy - 18, 104, 36, 6);
      context.fill();
      context.fillStyle = '#ffffff';
      text(s.name, sx, sy + 5, 11, '#ffffff', 'center', true);
    }

    // Objective beacon.
    const obj = state.objective;
    if (obj) {
      const ox = X(obj.x), oy = Y(obj.y);
      const pulse = 1 + Math.sin(t * 4) * 0.12;
      if (ox > -80 && ox < VIEW.width + 80 && oy > -80 && oy < VIEW.height + 80) {
        const grad = context.createLinearGradient(ox, oy - 190, ox, oy);
        grad.addColorStop(0, 'rgba(255,210,63,0)');
        grad.addColorStop(1, 'rgba(255,210,63,0.5)');
        context.fillStyle = grad;
        context.fillRect(ox - 12, oy - 190, 24, 190);
        context.strokeStyle = '#ffd23f';
        context.lineWidth = 3;
        context.beginPath();
        context.arc(ox, oy, (obj.r || 60) * pulse, 0, Math.PI * 2);
        context.stroke();
        context.fillStyle = '#ffd23f';
        context.beginPath();
        context.moveTo(ox, oy - 34);
        context.lineTo(ox + 12, oy - 14);
        context.lineTo(ox - 12, oy - 14);
        context.closePath();
        context.fill();
      } else {
        // Off-screen arrow at the view edge.
        const cx = VIEW.width / 2, cy = VIEW.height / 2;
        const a = Math.atan2(oy - cy, ox - cx);
        const ex = cx + Math.cos(a) * 300, ey = cy + Math.sin(a) * 220;
        context.save();
        context.translate(ex, ey);
        context.rotate(a);
        context.fillStyle = '#ffd23f';
        context.beginPath();
        context.moveTo(18, 0); context.lineTo(-12, -12); context.lineTo(-12, 12);
        context.closePath(); context.fill();
        context.restore();
        text('OBJECTIVE', ex, ey + 34, 13, '#ffd23f', 'center', true);
      }
    }

    // Cash pickups.
    for (const pk of state.pickups) {
      const px = X(pk.x), py = Y(pk.y);
      context.fillStyle = '#2ecc71';
      context.beginPath(); context.arc(px, py, 11, 0, Math.PI * 2); context.fill();
      text('$', px, py + 4, 13, '#ffffff', 'center', true);
    }

    // Pedestrians.
    for (const pd of state.peds) {
      const px = X(pd.x), py = Y(pd.y);
      if (px < -30 || px > VIEW.width + 30 || py < -30 || py > VIEW.height + 30) continue;
      if (pd.dead) {
        context.fillStyle = '#7f8c8d';
        context.beginPath(); context.arc(px, py, 9, 0, Math.PI * 2); context.fill();
        continue;
      }
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath(); context.ellipse(px, py + 8, 9, 4, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = pd.color;
      context.beginPath(); context.arc(px, py, 10, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath(); context.arc(px, py - 2, 5, 0, Math.PI * 2); context.fill();
    }

    // Enemies.
    for (const e of state.enemies) {
      if (e.dead) continue;
      const ex = X(e.x), ey = Y(e.y);
      if (ex < -40 || ex > VIEW.width + 40 || ey < -40 || ey > VIEW.height + 40) continue;
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath(); context.ellipse(ex, ey + 9, 10, 4, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#c0392b';
      context.beginPath(); context.arc(ex, ey, 12, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath(); context.arc(ex, ey - 2, 5, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#222';
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(ex, ey); context.lineTo(ex + Math.cos(e.angle) * 20, ey + Math.sin(e.angle) * 20); context.stroke();
      // Health bar.
      context.fillStyle = '#222';
      context.fillRect(ex - 14, ey - 24, 28, 4);
      context.fillStyle = '#ff5252';
      context.fillRect(ex - 14, ey - 24, 28 * Math.max(0, e.hp / 60), 4);
    }

    // Cars.
    for (const c of state.cars) drawCar(c, X, Y, state, false);
    // Bullets.
    context.strokeStyle = '#ffe14d';
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(X(b.x), Y(b.y));
      context.lineTo(X(b.x - b.vx * 0.02), Y(b.y - b.vy * 0.02));
      context.stroke();
    }
    // Particles.
    for (const f of state.fx) {
      context.globalAlpha = Math.max(0, f.life * 1.6);
      context.fillStyle = f.color;
      context.beginPath(); context.arc(X(f.x), Y(f.y), f.size, 0, Math.PI * 2); context.fill();
    }
    context.globalAlpha = 1;

    // Player on foot.
    const p = state.player;
    if (!p.inCar) {
      const px = X(p.x), py = Y(p.y);
      context.fillStyle = 'rgba(0,0,0,0.3)';
      context.beginPath(); context.ellipse(px, py + 9, 11, 5, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#14b8a6';
      context.beginPath(); context.arc(px, py, 13, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#f2c9a0';
      context.beginPath(); context.arc(px, py - 2, 6, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#0f766e';
      context.lineWidth = 3;
      context.beginPath(); context.moveTo(px, py); context.lineTo(px + Math.cos(p.angle) * 20, py + Math.sin(p.angle) * 20); context.stroke();
      if (p.weapon === 'pistol') {
        context.fillStyle = '#222';
        context.fillRect(px + Math.cos(p.angle) * 14 - 3, py + Math.sin(p.angle) * 14 - 3, 8, 6);
      } else if (p.weapon === 'bat') {
        context.strokeStyle = '#8d6e63';
        context.lineWidth = 4;
        context.beginPath(); context.moveTo(px, py); context.lineTo(px + Math.cos(p.angle - 0.6) * 24, py + Math.sin(p.angle - 0.6) * 24); context.stroke();
      }
    }

    // Helicopter shadow + body at 4+ stars.
    if (state.heli.active) {
      const hx = X(state.heli.x), hy = Y(state.heli.y);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.beginPath(); context.ellipse(X(state.player.x) + 40, Y(state.player.y) + 50, 34, 14, 0, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#2f3542';
      context.beginPath(); context.ellipse(hx, hy, 26, 12, -0.3, 0, Math.PI * 2); context.fill();
      context.strokeStyle = 'rgba(255,255,255,0.7)';
      context.lineWidth = 2;
      context.beginPath(); context.moveTo(hx - 34, hy - 4); context.lineTo(hx + 34, hy + 2); context.stroke();
      // Searchlight cone to the player.
      const px = X(state.player.x), py = Y(state.player.y);
      const grad = context.createLinearGradient(hx, hy, px, py);
      grad.addColorStop(0, 'rgba(255,255,220,0.28)');
      grad.addColorStop(1, 'rgba(255,255,220,0.02)');
      context.fillStyle = grad;
      context.beginPath();
      context.moveTo(hx - 8, hy + 6); context.lineTo(px - 26, py); context.lineTo(px + 26, py); context.lineTo(hx + 8, hy + 6);
      context.closePath(); context.fill();
    }
    return { camX, camY };
  }

  function drawCar(c, X, Y, state, inMinimap) {
    const cx = X(c.x), cy = Y(c.y);
    if (!inMinimap && (cx < -60 || cx > VIEW.width + 60 || cy < -60 || cy > VIEW.height + 60)) return;
    context.save();
    context.translate(cx, cy);
    context.rotate(c.angle);
    if (c.wrecked) context.globalAlpha = 0.75;
    context.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(-22, -10, 48, 26, 6);
    context.fill();
    context.fillStyle = c.kind === 'police' ? '#f5f6fa' : c.color;
    roundRect(-24, -12, 48, 24, 7);
    context.fill();
    if (c.kind === 'police') {
      context.fillStyle = '#2f6df6';
      context.fillRect(-6, -12, 12, 24);
      const flash = Math.floor(state.time * 6) % 2 === 0;
      context.fillStyle = flash ? '#ff3838' : '#2f6df6';
      context.beginPath(); context.arc(-2, -8, 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = flash ? '#2f6df6' : '#ff3838';
      context.beginPath(); context.arc(-2, 8, 4, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = 'rgba(20,30,45,0.85)';
    roundRect(2, -9, 12, 18, 3);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.85)';
    context.fillRect(20, -10, 3, 5);
    context.fillRect(20, 5, 3, 5);
    context.fillStyle = '#ff5252';
    context.fillRect(-24, -10, 3, 5);
    context.fillRect(-24, 5, 3, 5);
    if (c.kind === 'target') {
      context.fillStyle = '#ffd23f';
      context.beginPath(); context.arc(0, 0, 4, 0, Math.PI * 2); context.fill();
    }
    if (c.id === state.player.carId && state.player.inCar) {
      context.strokeStyle = '#ffd23f';
      context.lineWidth = 2;
      roundRect(-28, -16, 56, 32, 9);
      context.stroke();
    }
    context.restore();
    context.globalAlpha = 1;
    if (c.wrecked) {
      context.fillStyle = 'rgba(120,120,120,0.8)';
      context.beginPath(); context.arc(cx - 10, cy - 14, 8, 0, Math.PI * 2); context.fill();
    }
  }

  function drawMinimap(state) {
    const cx = VIEW.width - 112, cy = 112, r = 92;
    const scale = (r * 2) / WORLD.width;
    context.save();
    context.beginPath();
    context.arc(cx, cy, r, 0, Math.PI * 2);
    context.clip();
    context.fillStyle = '#1d2b1d';
    context.fillRect(cx - r, cy - r, r * 2, r * 2);
    context.fillStyle = '#2e9fd8';
    context.fillRect(cx - r, cy + (BEACH_Y + 150) * scale - (WORLD.height * scale) / 2 + (cy - r), r * 2, 40);
    // Roads.
    context.strokeStyle = '#8a93a3';
    context.lineWidth = 3;
    for (const ax of AVENUES) {
      context.beginPath();
      context.moveTo(cx - r + ax * scale, cy - r);
      context.lineTo(cx - r + ax * scale, cy + r);
      context.stroke();
    }
    for (const sy of STREETS) {
      context.beginPath();
      context.moveTo(cx - r, cy - r + sy * scale);
      context.lineTo(cx + r, cy - r + sy * scale);
      context.stroke();
    }
    const mx = (x) => cx - r + x * scale;
    const my = (y) => cy - r + y * scale;
    // Shops.
    for (const s of SHOPS) {
      context.fillStyle = '#ffd23f';
      context.fillRect(mx(s.x) - 3, my(s.y) - 3, 6, 6);
    }
    // Police.
    for (const c of state.cars) {
      if (c.kind !== 'police') continue;
      context.fillStyle = '#4d8dff';
      context.beginPath(); context.arc(mx(c.x), my(c.y), 4, 0, Math.PI * 2); context.fill();
    }
    // Objective.
    if (state.objective) {
      context.fillStyle = '#ffd23f';
      context.beginPath(); context.arc(mx(state.objective.x), my(state.objective.y), 6, 0, Math.PI * 2); context.fill();
      context.strokeStyle = '#ffd23f';
      context.beginPath(); context.arc(mx(state.objective.x), my(state.objective.y), 9 + Math.sin(state.time * 4) * 2, 0, Math.PI * 2); context.stroke();
    }
    // Player arrow.
    const p = state.player;
    context.save();
    context.translate(mx(p.x), my(p.y));
    context.rotate(p.angle);
    context.fillStyle = '#ffffff';
    context.beginPath(); context.moveTo(8, 0); context.lineTo(-6, -5); context.lineTo(-6, 5); context.closePath(); context.fill();
    context.restore();
    context.restore();
    // Ring + north tick.
    context.strokeStyle = 'rgba(255,255,255,0.85)';
    context.lineWidth = 3;
    context.beginPath(); context.arc(cx, cy, r, 0, Math.PI * 2); context.stroke();
    text('N', cx, cy - r - 6, 13, '#ffffff', 'center', true);
  }

  function drawHud(state) {
    const p = state.player;
    // Mission panel (top-left).
    const m = MISSIONS[state.missionIndex];
    panel(16, 16, 430, 86, 0.72);
    if (m && state.missionIndex < MISSIONS.length) {
      text(`THE SOLMARIS JOB — ${m.title}`, 30, 42, 15, PALETTE.accent, 'left', true);
      const label = state.objectiveLabel || 'Free roam — press Enter on a mission marker';
      text(label.length > 52 ? label.slice(0, 52) + '…' : label, 30, 66, 15, '#ffffff');
      const s = state.missionActive && m.steps[state.stepIndex];
      if (s && (s.type === 'wait' || s.type === 'chase')) {
        const frac = Math.min(1, state.stepState.t / s.seconds);
        context.fillStyle = '#222';
        context.fillRect(30, 76, 200, 8);
        context.fillStyle = PALETTE.accent;
        context.fillRect(30, 76, 200 * frac, 8);
      } else {
        text(`Reward $${m.reward}  ·  Mission ${state.missionIndex + 1}/6`, 30, 84, 12, PALETTE.muted);
      }
    } else {
      text('STORY COMPLETE — Solmaris is yours', 30, 42, 15, PALETTE.accent, 'left', true);
      text('Free roam: steal cars, dodge the law, get rich.', 30, 66, 15, '#ffffff');
    }

    drawMinimap(state);

    // Wanted stars + cash under the minimap.
    const sy = 222;
    for (let i = 0; i < 5; i += 1) {
      const sx = VIEW.width - 204 + i * 24;
      drawStar(sx, sy, 10, i < state.wanted ? '#ffd23f' : 'rgba(255,255,255,0.25)');
    }
    text(`$${state.money}`, VIEW.width - 20, sy + 34, 24, '#ffffff', 'right', true);
    text(`Stolen ${state.stats.carsStolen} · Kills ${state.stats.kills}`, VIEW.width - 28, sy + 56, 12, PALETTE.muted, 'right');

    // Health + weapon (bottom-left).
    panel(16, VIEW.height - 66, 300, 50, 0.72);
    text('HP', 30, VIEW.height - 34, 14, '#ffffff', 'left', true);
    context.fillStyle = '#222';
    context.fillRect(62, VIEW.height - 48, 150, 14);
    context.fillStyle = state.health > 30 ? '#2ecc71' : '#ff5252';
    context.fillRect(62, VIEW.height - 48, 150 * Math.max(0, state.health / 100), 14);
    const wname = p.weapon === 'pistol' ? `Pistol · ${p.ammo} ammo` : p.weapon === 'bat' ? 'Bat' : 'Fists';
    text(wname, 226, VIEW.height - 34, 13, '#ffffff', 'left');
    text('Q switch weapon', 226, VIEW.height - 20, 10, PALETTE.muted, 'left');

    // Prompt (bottom-centre).
    if (state.prompt) {
      const w = context.measureText(state.prompt).width + 30;
      panel(VIEW.width / 2 - 110, VIEW.height - 58, 220, 34, 0.8);
      text(state.prompt, VIEW.width / 2, VIEW.height - 35, 15, '#ffffff', 'center', true);
    }
    // Toast.
    if (state.toastTimer > 0) {
      text(state.toast, VIEW.width / 2, VIEW.height - 84, 15, PALETTE.accent, 'center', true);
    }
    // Busted progress.
    if (state.busted > 0) {
      text('BUSTED…', VIEW.width / 2, 130, 26, '#4d8dff', 'center', true);
      context.fillStyle = '#222';
      context.fillRect(VIEW.width / 2 - 100, 140, 200, 10);
      context.fillStyle = '#4d8dff';
      context.fillRect(VIEW.width / 2 - 100, 140, 200 * Math.min(1, state.busted / 1.4), 10);
    }
    // Banner.
    if (state.bannerTimer > 0) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      panel(240, 120, 800, 64, 0.85);
      const lines = wrapText(state.banner, 46);
      lines.forEach((ln, i) => text(ln, VIEW.width / 2, 148 + i * 22, 17, '#ffffff', 'center', true));
      context.globalAlpha = 1;
    }
    // Controls hint.
    text('WASD move/drive · E car/shop · F punch · Click shoot · P pause · M mute', VIEW.width - 28, VIEW.height - 12, 11, 'rgba(255,255,255,0.55)', 'right');
  }

  function drawStar(x, y, r, color) {
    context.fillStyle = color;
    context.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
      if (i === 0) context.moveTo(px, py); else context.lineTo(px, py);
    }
    context.closePath();
    context.fill();
  }

  function wrapText(s, maxChars) {
    const words = s.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > maxChars) { lines.push(cur.trim()); cur = w; }
      else cur += ' ' + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    return lines.slice(0, 2);
  }

  function drawCenterPanel(title, lines, prompt, titleColor) {
    context.fillStyle = 'rgba(5,8,12,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    const w = 640;
    const h = 150 + lines.length * 30;
    panel((VIEW.width - w) / 2, (VIEW.height - h) / 2, w, h, 0.92);
    text(title, VIEW.width / 2, (VIEW.height - h) / 2 + 64, 44, titleColor || '#ffffff', 'center', true);
    lines.forEach((ln, i) => text(ln, VIEW.width / 2, (VIEW.height - h) / 2 + 108 + i * 30, 17, PALETTE.muted, 'center'));
    text(prompt, VIEW.width / 2, (VIEW.height + h) / 2 - 26, 18, PALETTE.accent, 'center', true);
  }

  function draw(state, screen, extra) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#0b0e13';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(5,10,18,0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      text('SOLMARIS', VIEW.width / 2, 190, 92, '#ffffff', 'center', true);
      text('AN ORIGINAL OPEN-WORLD CRIME STORY', VIEW.width / 2, 228, 20, PALETTE.accent, 'center', true);
      text('Six missions. One city. Steal cars, dodge the law, pull the Solmaris Job.', VIEW.width / 2, 262, 17, '#ffffff', 'center');
      const m = MISSIONS[state.missionIndex];
      const lines = [
        `Mission ${Math.min(state.missionIndex + 1, 6)}/6 — ${m ? m.title : 'Story complete'}`,
        'WASD move / drive · E steal car or enter shop · F punch · Mouse click to shoot',
        'Earn cash from missions · Buy guns, food and repairs in the shops · Save is automatic',
      ];
      if (extra && extra.hasSave) lines.push('Your save was found — press Enter to continue where you left off.');
      lines.forEach((ln, i) => text(ln, VIEW.width / 2, 330 + i * 28, 16, PALETTE.muted, 'center'));
      const blink = true;
      if (blink) text('PRESS ENTER OR CLICK TO START', VIEW.width / 2, 470, 22, PALETTE.accent, 'center', true);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawCenterPanel('PAUSED', ['The city waits for you.', `Cash $${state.money} · Mission ${Math.min(state.missionIndex + 1, 6)}/6`], 'Press P or Enter to resume');
    } else if (screen === SCREEN_WASTED) {
      drawCenterPanel('WASTED', ['Solmaris got the better of you this time.', `Cash kept: $${state.money} · Missions done: ${state.stats.missionsDone}`], 'Press Enter to respawn', '#ff5252');
    } else if (screen === SCREEN_BUSTED) {
      drawCenterPanel('BUSTED', ['The Solmaris police hauled you in.', `Cash kept: $${state.money} · Missions done: ${state.stats.missionsDone}`], 'Press Enter to walk free', '#4d8dff');
    } else if (screen === SCREEN_COMPLETE) {
      drawCenterPanel('STORY COMPLETE', ['You pulled the Solmaris Job and sailed out a legend.', `Total earned: $${state.money} · Cars stolen: ${state.stats.carsStolen}`], 'Press Enter to keep roaming Solmaris', PALETTE.accent);
    } else if (screen === SCREEN_SHOP && state.shopOpen) {
      const shop = state.shopOpen;
      context.fillStyle = 'rgba(5,8,12,0.55)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const w = 560, h = 150 + shop.items.length * 40;
      panel((VIEW.width - w) / 2, (VIEW.height - h) / 2, w, h, 0.95);
      const top = (VIEW.height - h) / 2;
      text(shop.name, VIEW.width / 2, top + 52, 30, shop.color === '#c0392b' ? '#ff8a7a' : '#ffffff', 'center', true);
      text(`Your cash: $${state.money}`, VIEW.width / 2, top + 82, 16, PALETTE.accent, 'center', true);
      shop.items.forEach((it, i) => {
        text(`[${it.key}]  ${it.label}`, VIEW.width / 2, top + 122 + i * 38, 17, '#ffffff', 'center');
      });
      if (state.shopMsg) text(state.shopMsg, VIEW.width / 2, top + 122 + shop.items.length * 38, 15, PALETTE.accent, 'center', true);
      text('Press 1 / 2 / 3 to buy · Esc to leave', VIEW.width / 2, top + h - 24, 14, PALETTE.muted, 'center');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize };
}
