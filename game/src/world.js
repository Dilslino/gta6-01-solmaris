// The game's rules and state, with no drawing and no browser in it: the player on foot and
// in cars, traffic and pedestrians on the road graph, police and wanted stars, the 6-mission
// story chain, combat, shops and money, and the save. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, screens) without the
// world knowing about screens or sound. The seeded RNG drives every spawn, so a fixed input
// script always replays the same scene.
import {
  AVENUES, BEACH_Y, CAR, CAR_COLORS, MISSIONS, PALETTE, PED_COLORS, PLAYER,
  ROAD_W, SAVE_KEY, SHOPS, STEP, STREETS, WEAPONS, WORLD,
} from './config.js';
import { buildCity, moveCircle, nearestNode, nearestRoadPoint, onRoad, pointInBuildings } from './city.js';
import { angleDiff, angleTo, clamp, dist, int, lerp, pick, range } from './random.js';

export const EVENT_WASTED = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_CASH = 8;
export const EVENT_SHOT = 16;
export const EVENT_CRASH = 32;
export const EVENT_STEAL = 64;
export const EVENT_PICKUP = 128;
export const EVENT_HIT = 256;
export const EVENT_HEAL = 512;

const MAX_WANTED = 5;
const TRAFFIC_TARGET = 14;
const PED_TARGET = 26;

let carSeq = 1;

function makeCar(rng, x, y, angle, kind, color) {
  return {
    id: carSeq += 1, kind, x, y, angle, speed: 0, color: color || pick(rng, CAR_COLORS),
    hp: 100, node: null, next: null, lane: rng() < 0.5 ? -1 : 1, wrecked: false,
    target: null, stuck: 0, tuned: false,
  };
}

export function createWorld(random) {
  const rng = random;
  const city = buildCity(rng);
  const state = {
    city, time: 0, elapsed: 0,
    player: null, cars: [], peds: [], enemies: [], bullets: [], pickups: [], fx: [],
    money: 120, health: PLAYER.health, wanted: 0, wantedCooldown: 0, decayTimer: 0,
    missionIndex: 0, stepIndex: 0, stepState: { t: 0, done: 0 }, missionActive: false,
    banner: '', bannerTimer: 0, objective: null, objectiveLabel: '',
    camera: { x: 1820, y: 1580 }, heli: { x: 0, y: 0, active: false },
    busted: 0, shopOpen: null, shopMsg: '', prompt: '', toast: '', toastTimer: 0,
    stats: { carsStolen: 0, kills: 0, missionsDone: 0 },
    over: false, spawnTimer: 0, policeTimer: 0, roadblockDone: false,
    targetCar: null, missionKills: 0,
  };

  function playerStart() {
    return { x: 1820, y: 1650, angle: -Math.PI / 2, inCar: false, carId: 0, weapon: 'fists',
      ammo: 0, hasPistol: false, hasBat: false, punchTimer: 0, shootTimer: 0, invuln: 0,
      moving: false, tuned: false };
  }

  function addFx(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      if (state.fx.length > 140) return;
      const a = rng() * Math.PI * 2;
      const s = range(rng, 40, speed || 160);
      state.fx.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: range(rng, 0.3, 0.7), color, size: range(rng, 2, 5) });
    }
  }

  function setBanner(text) { state.banner = text; state.bannerTimer = 3.2; }
  function setToast(text) { state.toast = text; state.toastTimer = 2.4; }

  function addWanted(n) {
    if (state.wantedCooldown > 0 && n > 0) return;
    state.wanted = clamp(state.wanted + n, 0, MAX_WANTED);
    if (n > 0) state.wantedCooldown = 1.5;
    state.decayTimer = 0;
    if (state.wanted >= 3 && !state.roadblockDone) {
      state.roadblockDone = true;
      spawnRoadblock();
    }
  }

  function spawnRoadblock() {
    const p = state.player;
    const ahead = nearestRoadPoint(rng, p.x, p.y - 500);
    for (let i = 0; i < 2; i += 1) {
      const c = makeCar(rng, ahead.x - 60 + i * 120, ahead.y, Math.PI / 2, 'police', '#2f6df6');
      c.speed = 0; c.block = true;
      state.cars.push(c);
    }
    setToast('ROADBLOCK AHEAD — police have sealed the avenue');
  }

  function spawnPolice() {
    const p = state.player;
    const a = rng() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * range(rng, 500, 800), 100, WORLD.width - 100);
    const y = clamp(p.y + Math.sin(a) * range(rng, 500, 800), 100, WORLD.height - 100);
    const rp = nearestRoadPoint(rng, x, y);
    const c = makeCar(rng, rp.x, rp.y, rng() * Math.PI * 2, 'police', '#2f6df6');
    c.speed = 200;
    state.cars.push(c);
  }

  function spawnTrafficCar() {
    const p = state.player;
    const a = rng() * Math.PI * 2;
    const x = clamp(p.x + Math.cos(a) * range(rng, 700, 1300), 120, WORLD.width - 120);
    const y = clamp(p.y + Math.sin(a) * range(rng, 700, 1300), 120, BEACH_Y - 120);
    const rp = nearestRoadPoint(rng, x, y);
    const c = makeCar(rng, rp.x, rp.y, rng() * Math.PI * 2, 'traffic');
    c.node = nearestNode(city.nodes, rp.x, rp.y);
    c.next = pick(rng, c.node.links);
    c.speed = range(rng, 130, 210);
    state.cars.push(c);
  }

  function spawnParkedCar(x, y, angle) {
    const c = makeCar(rng, x, y, angle, 'parked');
    c.speed = 0;
    state.cars.push(c);
    return c;
  }

  function spawnPed(x, y) {
    const px = x !== undefined ? x : clamp(state.player.x + range(rng, -900, 900), 80, WORLD.width - 80);
    const py = y !== undefined ? y : clamp(state.player.y + range(rng, -700, 700), 80, BEACH_Y - 80);
    const target = nearestNode(city.nodes, px, py);
    state.peds.push({
      x: px, y: py, angle: rng() * Math.PI * 2, speed: range(rng, 45, 75),
      color: pick(rng, PED_COLORS), node: target, next: pick(rng, target.links),
      flee: 0, dead: false, fallTimer: 0,
    });
  }

  function spawnEnemy(x, y, mission, shooter) {
    const e = { x, y, angle: 0, hp: 60, speed: 150, color: '#c0392b', mission: !!mission,
      shooter: !!shooter, shootTimer: range(rng, 0.5, 1.5), punchTimer: 0, dead: false };
    state.enemies.push(e);
    return e;
  }

  function dropCash(x, y, amount) {
    state.pickups.push({ x, y, amount, kind: 'cash', t: 0 });
  }

  function playerCar() {
    if (!state.player.inCar) return null;
    for (const c of state.cars) if (c.id === state.player.carId) return c;
    return null;
  }

  function nearestCar(maxD) {
    const p = state.player;
    let best = null, bd = maxD;
    for (const c of state.cars) {
      if (c.wrecked) continue;
      const d = dist(p.x, p.y, c.x, c.y);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  function nearShop() {
    const p = state.player;
    for (const s of SHOPS) {
      const sx = s.x + s.dx, sy = s.y + s.dy;
      if (dist(p.x, p.y, sx, sy) < 95) return s;
    }
    return null;
  }

  // ---- missions -----------------------------------------------------------
  function currentMission() { return MISSIONS[state.missionIndex] || null; }
  function currentStep() {
    const m = currentMission();
    return m ? m.steps[state.stepIndex] : null;
  }

  function startMission(index) {
    const m = MISSIONS[index];
    if (!m) return;
    state.missionIndex = index;
    state.stepIndex = 0;
    state.stepState = { t: 0, done: 0 };
    state.missionActive = true;
    state.missionKills = 0;
    state.targetCar = null;
    setBanner(`${m.title} — ${m.intro}`);
    if (m.id === 3) {
      // Courier target car spawns ahead of the player on the nearest road.
      const rp = nearestRoadPoint(rng, state.player.x + 300, state.player.y - 300);
      const c = makeCar(rng, rp.x, rp.y, -Math.PI / 2, 'target', '#f1c40f');
      c.node = nearestNode(city.nodes, rp.x, rp.y);
      c.next = pick(rng, c.node.links);
      c.speed = 260;
      state.cars.push(c);
      state.targetCar = c;
    }
    if (m.id === 5) addWanted(3);
    updateObjective();
  }

  function updateObjective() {
    const m = currentMission();
    const s = currentStep();
    if (!m || !s || !state.missionActive) { state.objective = null; state.objectiveLabel = ''; return; }
    state.objectiveLabel = s.label || '';
    if (s.type === 'goto' || s.type === 'wait' || s.type === 'survive') state.objective = { x: s.x, y: s.y, r: s.r };
    else if (s.type === 'chase' && state.targetCar) state.objective = { x: state.targetCar.x, y: state.targetCar.y, r: 120 };
    else if (s.type === 'defeat') {
      const e = state.enemies.find((en) => en.mission && !en.dead);
      state.objective = e ? { x: e.x, y: e.y, r: 90 } : { x: 4620, y: 3380, r: 90 };
      state.objectiveLabel = `Take down the dock crew (${state.missionKills}/${s.count})`;
    } else state.objective = null;
  }

  function completeStep() {
    const m = currentMission();
    state.stepIndex += 1;
    state.stepState = { t: 0, done: 0 };
    if (state.stepIndex >= m.steps.length) {
      // Mission complete.
      state.money += m.reward;
      state.stats.missionsDone += 1;
      setBanner(`MISSION COMPLETE — ${m.title} · +$${m.reward}`);
      state.missionActive = false;
      state.missionIndex += 1;
      state.stepIndex = 0;
      state.objective = null;
      state.objectiveLabel = '';
      if (state.targetCar) { state.targetCar.kind = 'traffic'; state.targetCar = null; }
      saveGame();
      return EVENT_MISSION | EVENT_CASH;
    }
    // Step-entry spawns.
    const s = currentStep();
    if (m.id === 4 && s && s.type === 'wait') {
      spawnEnemy(3920 - 40, 980 - 30, true, false);
      spawnEnemy(3920 + 50, 980 + 20, true, true);
      spawnEnemy(3920 - 10, 980 + 60, true, false);
      addWanted(2);
    }
    if (m.id === 6 && s && s.type === 'defeat') {
      spawnEnemy(4620 - 60, 3380 - 40, true, true);
      spawnEnemy(4620 + 40, 3380 - 50, true, false);
      spawnEnemy(4620 - 20, 3380 + 50, true, true);
      spawnEnemy(4620 + 70, 3380 + 30, true, false);
    }
    updateObjective();
    return EVENT_MISSION;
  }

  function updateMission(dt) {
    if (!state.missionActive) return 0;
    const m = currentMission();
    const s = currentStep();
    if (!m || !s) return 0;
    const p = state.player;
    const px = p.inCar && playerCar() ? playerCar().x : p.x;
    const py = p.inCar && playerCar() ? playerCar().y : p.y;
    let ev = 0;
    if (s.type === 'goto') {
      if (dist(px, py, s.x, s.y) < s.r) ev |= completeStep();
    } else if (s.type === 'wait') {
      if (dist(px, py, s.x, s.y) < s.r) {
        state.stepState.t += dt;
        if (state.stepState.t >= s.seconds) ev |= completeStep();
      } else state.stepState.t = Math.max(0, state.stepState.t - dt * 2);
    } else if (s.type === 'chase') {
      const t = state.targetCar;
      if (!t) { ev |= completeStep(); }
      else if (dist(px, py, t.x, t.y) < 260) {
        state.stepState.t += dt;
        if (state.stepState.t >= s.seconds) ev |= completeStep();
      } else state.stepState.t = Math.max(0, state.stepState.t - dt);
    } else if (s.type === 'survive') {
      state.stepState.t += dt;
      if (state.stepState.t >= s.seconds) {
        if (dist(px, py, s.x, s.y) < s.r) ev |= completeStep();
        else state.objectiveLabel = 'Time up — reach the hideout now!';
      }
    } else if (s.type === 'defeat') {
      if (state.missionKills >= s.count) ev |= completeStep();
    }
    updateObjective();
    return ev;
  }

  // ---- save ---------------------------------------------------------------
  function saveGame() {
    try {
      const p = state.player;
      window.localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: state.money, missionIndex: state.missionIndex, health: state.health,
        x: p.x, y: p.y, hasPistol: p.hasPistol, hasBat: p.hasBat, ammo: p.ammo,
        tuned: p.tuned, carsStolen: state.stats.carsStolen, kills: state.stats.kills,
      }));
    } catch { /* storage optional */ }
  }
  function loadSave() {
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      state.money = s.money || 0;
      state.missionIndex = Math.min(s.missionIndex || 0, MISSIONS.length - 1);
      state.health = s.health || PLAYER.health;
      state.player.x = s.x || 1820; state.player.y = s.y || 1650;
      state.player.hasPistol = !!s.hasPistol; state.player.hasBat = !!s.hasBat;
      state.player.ammo = s.ammo || 0;
      state.player.tuned = !!s.tuned;
      state.player.weapon = state.player.hasPistol ? 'pistol' : state.player.hasBat ? 'bat' : 'fists';
      state.stats.carsStolen = s.carsStolen || 0; state.stats.kills = s.kills || 0;
      return true;
    } catch { return false; }
  }

  // ---- reset --------------------------------------------------------------
  function reset() {
    carSeq = 1;
    state.time = 0; state.elapsed = 0;
    state.player = playerStart();
    state.cars = []; state.peds = []; state.enemies = []; state.bullets = []; state.pickups = []; state.fx = [];
    state.money = 120; state.health = PLAYER.health; state.wanted = 0; state.wantedCooldown = 0;
    state.decayTimer = 0; state.missionIndex = 0; state.stepIndex = 0;
    state.stepState = { t: 0, done: 0 }; state.missionActive = false;
    state.banner = ''; state.bannerTimer = 0; state.objective = null; state.objectiveLabel = '';
    state.camera = { x: 1820, y: 1580 }; state.heli = { x: 1820, y: 1400, active: false };
    state.busted = 0; state.shopOpen = null; state.shopMsg = ''; state.prompt = '';
    state.toast = ''; state.toastTimer = 0;
    state.stats = { carsStolen: 0, kills: 0, missionsDone: 0 };
    state.over = false; state.spawnTimer = 0; state.policeTimer = 0; state.roadblockDone = false;
    state.targetCar = null; state.missionKills = 0;
    // Starter car (the player's own) parked by the spawn, plus parked cars around town.
    const own = spawnParkedCar(1820, 1720, -Math.PI / 2);
    own.kind = 'player'; own.color = '#e74c3c';
    spawnParkedCar(1120, 1050, 0);
    spawnParkedCar(2520, 1650, Math.PI / 2);
    spawnParkedCar(3920, 2250, Math.PI);
    spawnParkedCar(4620, 2850, -Math.PI / 2);
    spawnParkedCar(420, 1650, 0);
    for (let i = 0; i < 10; i += 1) spawnTrafficCar();
    for (let i = 0; i < 20; i += 1) spawnPed();
  }

  // ---- combat -------------------------------------------------------------
  function fireBullet(x, y, angle, fromPlayer, damage) {
    state.bullets.push({ x, y, vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900, life: 0.7, fromPlayer, damage });
  }

  function damageEnemy(e, dmg, fromPlayer) {
    e.hp -= dmg;
    addFx(e.x, e.y, '#ff6b6b', 5, 120);
    if (e.hp <= 0 && !e.dead) {
      e.dead = true;
      state.stats.kills += 1;
      if (e.mission) state.missionKills += 1;
      dropCash(e.x, e.y, int(rng, 20, 60));
      if (fromPlayer) addWanted(0);
    }
  }

  function damagePlayer(dmg) {
    if (state.player.invuln > 0 || state.over) return;
    state.health -= dmg;
    state.player.invuln = 0.4;
    addFx(state.player.x, state.player.y, '#ff5252', 6, 140);
  }

  function killPed(pd, byCar) {
    if (pd.dead) return;
    pd.dead = true;
    pd.fallTimer = 3;
    addWanted(1);
    addFx(pd.x, pd.y, '#ff6b6b', 8, 160);
  }

  // ---- shops --------------------------------------------------------------
  function buyShop(key) {
    const shop = state.shopOpen;
    if (!shop) return 0;
    const item = shop.items.find((i) => i.key === key);
    if (!item) return 0;
    if (state.money < item.price) { state.shopMsg = 'Not enough cash.'; return 0; }
    const p = state.player;
    if (item.buy === 'pistol') { if (p.hasPistol) { state.shopMsg = 'Already owned.'; return 0; } p.hasPistol = true; p.ammo += 24; p.weapon = 'pistol'; }
    else if (item.buy === 'ammo') { if (!p.hasPistol) { state.shopMsg = 'Buy the pistol first.'; return 0; } p.ammo += 24; }
    else if (item.buy === 'bat') { if (p.hasBat) { state.shopMsg = 'Already owned.'; return 0; } p.hasBat = true; p.weapon = 'bat'; }
    else if (item.buy === 'food') { state.health = Math.min(100, state.health + 40); }
    else if (item.buy === 'feast') { state.health = 100; }
    else if (item.buy === 'repair') {
      const c = playerCar();
      if (!c) { state.shopMsg = 'Bring a car to repair.'; return 0; }
      c.hp = 100; c.wrecked = false;
    } else if (item.buy === 'tune') {
      const c = playerCar();
      if (!c) { state.shopMsg = 'Bring a car to tune.'; return 0; }
      c.tuned = true; p.tuned = true;
    }
    state.money -= item.price;
    state.shopMsg = `Bought: ${item.label}`;
    saveGame();
    return EVENT_CASH | EVENT_HEAL;
  }

  // ---- main step ----------------------------------------------------------
  function step(dt, ctl) {
    let events = 0;
    state.elapsed += dt;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.wantedCooldown > 0) state.wantedCooldown -= dt;
    const p = state.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.punchTimer > 0) p.punchTimer -= dt;
    if (p.shootTimer > 0) p.shootTimer -= dt;

    // Ambient title mode: traffic and peds drift, nothing else happens.
    if (ctl.ambient) {
      updateTraffic(dt, false);
      updatePeds(dt);
      updateFx(dt);
      state.camera.x = lerp(state.camera.x, 3200, dt * 0.2);
      state.camera.y = lerp(state.camera.y, 900, dt * 0.2);
      return 0;
    }

    const car = playerCar();

    // --- player on foot ---
    if (!p.inCar) {
      const sp = PLAYER.walkSpeed;
      let mx = ctl.ax || 0, my = ctl.ay || 0;
      const len = Math.hypot(mx, my);
      if (len > 0) { mx /= len; my /= len; p.moving = true; p.angle = Math.atan2(my, mx); }
      else p.moving = false;
      const moved = moveCircle(city.buildings, p.x, p.y, PLAYER.radius, mx * sp * dt, my * sp * dt);
      // Beach: walking into the sea is blocked.
      if (moved.y > BEACH_Y + 130) moved.y = BEACH_Y + 130;
      p.x = moved.x; p.y = moved.y;

      if (ctl.interact) {
        const shop = nearShop();
        if (shop) { state.shopOpen = shop; state.shopMsg = ''; }
        else {
          const c = nearestCar(70);
          if (c) {
            p.inCar = true; p.carId = c.id;
            if (c.kind === 'traffic' || c.kind === 'parked') {
              state.stats.carsStolen += 1;
              addWanted(1);
              setToast('Car stolen! The law is watching.');
              events |= EVENT_STEAL;
              if (c.kind === 'traffic') {
                // The driver bails out and runs.
                spawnPed(c.x + 40, c.y + 30);
                const d = state.peds[state.peds.length - 1];
                if (d) d.flee = 6;
              }
              c.kind = 'player';
            } else if (c.kind === 'player') {
              setToast('Your car.');
            }
            c.speed = 0;
          }
        }
      }
      if (ctl.punch && p.punchTimer <= 0) {
        p.punchTimer = WEAPONS[p.weapon === 'pistol' ? 'fists' : p.weapon].rate;
        const w = WEAPONS[p.weapon === 'pistol' ? 'fists' : p.weapon];
        const hx = p.x + Math.cos(p.angle) * w.range;
        const hy = p.y + Math.sin(p.angle) * w.range;
        let hitAny = false;
        for (const e of state.enemies) {
          if (!e.dead && dist(hx, hy, e.x, e.y) < 34) { damageEnemy(e, w.damage, true); hitAny = true; }
        }
        for (const pd of state.peds) {
          if (!pd.dead && dist(hx, hy, pd.x, pd.y) < 30) { killPed(pd, false); hitAny = true; }
        }
        if (hitAny) { events |= EVENT_HIT; addFx(hx, hy, '#ffd23f', 5, 120); }
      }
      if (ctl.shoot && p.weapon === 'pistol' && p.hasPistol && p.shootTimer <= 0 && p.ammo > 0) {
        p.shootTimer = WEAPONS.pistol.rate;
        p.ammo -= 1;
        fireBullet(p.x + Math.cos(ctl.shootAngle) * 20, p.y + Math.sin(ctl.shootAngle) * 20, ctl.shootAngle, true, WEAPONS.pistol.damage);
        addWanted(1);
        events |= EVENT_SHOT;
      }
      if (ctl.weaponCycle) {
        const order = ['fists', ...(p.hasBat ? ['bat'] : []), ...(p.hasPistol ? ['pistol'] : [])];
        const i = order.indexOf(p.weapon);
        p.weapon = order[(i + 1) % order.length];
        setToast(`Weapon: ${WEAPONS[p.weapon].name}`);
      }
      // Pick up cash.
      for (const pk of state.pickups) {
        if (dist(p.x, p.y, pk.x, pk.y) < 30) {
          state.money += pk.amount;
          pk.amount = 0;
          events |= EVENT_PICKUP | EVENT_CASH;
        }
      }
      state.pickups = state.pickups.filter((pk) => pk.amount > 0);
    } else if (car) {
      // --- driving ---
      const maxSp = (car.tuned ? CAR.maxSpeed * 1.25 : CAR.maxSpeed);
      const accel = ctl.ay < 0 ? CAR.accel : ctl.ay > 0 ? -CAR.brake : 0;
      car.speed = clamp(car.speed + accel * dt, -CAR.reverseMax, maxSp);
      if (ctl.ay === 0) car.speed = Math.abs(car.speed) < 8 ? 0 : car.speed * (1 - 1.6 * dt);
      const steer = ctl.ax || 0;
      const dir = car.speed >= 0 ? 1 : -1;
      car.angle += steer * CAR.steer * dt * dir * clamp(Math.abs(car.speed) / 120, 0, 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      const moved = moveCircle(city.buildings, car.x, car.y, 22, nx - car.x, ny - car.y);
      if (Math.abs(moved.x - nx) > 1 || Math.abs(moved.y - ny) > 1) {
        if (Math.abs(car.speed) > 220) { events |= EVENT_CRASH; addFx(car.x, car.y, '#ffb74d', 8, 180); car.hp -= 12; }
        car.speed *= 0.45;
      }
      car.x = moved.x; car.y = moved.y;
      if (car.y > BEACH_Y + 60) { car.y = BEACH_Y + 60; car.speed *= 0.5; }
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      // Run over pedestrians.
      for (const pd of state.peds) {
        if (!pd.dead && dist(car.x, car.y, pd.x, pd.y) < 30 && Math.abs(car.speed) > 60) killPed(pd, true);
      }
      // Ram enemies.
      for (const e of state.enemies) {
        if (!e.dead && dist(car.x, car.y, e.x, e.y) < 32 && Math.abs(car.speed) > 80) damageEnemy(e, 80, true);
      }
      if (ctl.interact) {
        p.inCar = false;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        p.carId = 0;
        car.speed = 0;
      }
      if (car.hp <= 0 && !car.wrecked) {
        car.wrecked = true;
        addFx(car.x, car.y, '#888888', 14, 200);
        events |= EVENT_CRASH;
        if (p.inCar) { p.inCar = false; p.carId = 0; damagePlayer(15); }
      }
    }

    // Mission progress (before traffic, so markers stay fresh).
    events |= updateMission(dt);

    updateTraffic(dt, true);
    updatePeds(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateFx(dt);
    updatePolice(dt);
    updateWanted(dt);

    // Camera follows the player.
    const tx = clamp(p.x, 640, WORLD.width - 640);
    const ty = clamp(p.y, 360, WORLD.height - 360);
    state.camera.x = lerp(state.camera.x, tx, 1 - Math.pow(0.001, dt));
    state.camera.y = lerp(state.camera.y, ty, 1 - Math.pow(0.001, dt));

    // Context prompt.
    state.prompt = '';
    if (!p.inCar) {
      const shop = nearShop();
      if (shop) state.prompt = `E — Enter ${shop.name}`;
      else if (nearestCar(70)) state.prompt = 'E — Steal car';
    } else state.prompt = 'E — Leave car';

    // Spawning upkeep.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      state.spawnTimer = 1.5;
      const traffic = state.cars.filter((c) => c.kind === 'traffic').length;
      if (traffic < TRAFFIC_TARGET) spawnTrafficCar();
      if (state.peds.filter((pd) => !pd.dead).length < PED_TARGET) spawnPed();
      // Despawn far traffic.
      state.cars = state.cars.filter((c) => {
        if (c.kind === 'traffic' && dist(c.x, c.y, p.x, p.y) > 2200) return false;
        if (c.kind === 'police' && c.block) return true;
        if (c.kind === 'police' && dist(c.x, c.y, p.x, p.y) > 2400) return false;
        return true;
      });
    }

    if (state.health <= 0 && !state.over) {
      state.over = true;
      events |= EVENT_WASTED;
    }
    return events;
  }

  function updateTraffic(dt, active) {
    for (const c of state.cars) {
      if (c.kind === 'parked' || c.kind === 'player' || c.wrecked) continue;
      if (c.kind === 'police' && !c.block) continue; // police handled separately
      if (c.kind === 'target') { updateTargetCar(c, dt); continue; }
      if (!c.next || !c.node) { c.node = nearestNode(city.nodes, c.x, c.y); c.next = pick(rng, c.node.links); }
      const tx = c.next.x + (c.next.y === c.node.y ? 0 : c.lane * 20);
      const ty = c.next.y + (c.next.x === c.node.x ? 0 : c.lane * 20);
      const d = dist(c.x, c.y, tx, ty);
      if (d < 26) {
        c.node = c.next;
        const opts = c.node.links.filter((n) => n !== c.node);
        c.next = opts.length ? pick(rng, opts) : c.node.links[0];
        continue;
      }
      const want = angleTo(c.x, c.y, tx, ty);
      c.angle += clamp(angleDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      const moved = moveCircle(city.buildings, c.x, c.y, 20, nx - c.x, ny - c.y);
      if (Math.abs(moved.x - nx) > 1 || Math.abs(moved.y - ny) > 1) { c.speed *= 0.5; }
      c.x = moved.x; c.y = moved.y;
      // Gentle collision with the player's car.
      const pc = playerCar();
      if (pc && c !== pc && dist(c.x, c.y, pc.x, pc.y) < 46) {
        c.speed *= 0.6; pc.speed *= 0.7;
      }
    }
  }

  function updateTargetCar(c, dt) {
    // Courier flees along the road graph, away from the player.
    const p = state.player;
    if (!c.next || !c.node) { c.node = nearestNode(city.nodes, c.x, c.y); c.next = pick(rng, c.node.links); }
    const tx = c.next.x, ty = c.next.y;
    if (dist(c.x, c.y, tx, ty) < 30) {
      c.node = c.next;
      let best = null, bd = -1;
      for (const n of c.node.links) {
        const d = dist(n.x, n.y, p.x, p.y);
        if (d > bd) { bd = d; best = n; }
      }
      c.next = best || c.node.links[0];
    }
    const want = angleTo(c.x, c.y, tx, ty);
    c.angle += clamp(angleDiff(c.angle, want), -3 * dt, 3 * dt);
    c.speed = lerp(c.speed, 300, dt);
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    const moved = moveCircle(city.buildings, c.x, c.y, 20, nx - c.x, ny - c.y);
    c.x = moved.x; c.y = moved.y;
  }

  function updatePeds(dt) {
    for (const pd of state.peds) {
      if (pd.dead) { pd.fallTimer -= dt; continue; }
      if (pd.flee > 0) {
        pd.flee -= dt;
        const a = angleTo(state.player.x, state.player.y, pd.x, pd.y);
        const moved = moveCircle(city.buildings, pd.x, pd.y, 10, Math.cos(a) * 130 * dt, Math.sin(a) * 130 * dt);
        pd.x = moved.x; pd.y = moved.y;
        pd.angle = a;
        continue;
      }
      if (!pd.next || !pd.node) { pd.node = nearestNode(city.nodes, pd.x, pd.y); pd.next = pick(rng, pd.node.links); }
      // Walk on the sidewalk: offset from the road centre.
      const tx = pd.next.x + 58;
      const ty = pd.next.y + 58;
      if (dist(pd.x, pd.y, tx, ty) < 40) {
        pd.node = pd.next;
        pd.next = pick(rng, pd.node.links);
        continue;
      }
      const want = angleTo(pd.x, pd.y, tx, ty);
      pd.angle = want;
      const moved = moveCircle(city.buildings, pd.x, pd.y, 10, Math.cos(want) * pd.speed * dt, Math.sin(want) * pd.speed * dt);
      pd.x = moved.x; pd.y = moved.y;
    }
    state.peds = state.peds.filter((pd) => !pd.dead || pd.fallTimer > 0);
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const e of state.enemies) {
      if (e.dead) continue;
      const d = dist(e.x, e.y, p.x, p.y);
      if (d > 900) continue;
      const want = angleTo(e.x, e.y, p.x, p.y);
      e.angle = want;
      if (e.shooter && d < 420 && d > 90) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = range(rng, 1.2, 2.0);
          fireBullet(e.x, e.y, want + range(rng, -0.08, 0.08), false, 8);
        }
      } else if (d > 40) {
        const moved = moveCircle(city.buildings, e.x, e.y, 12, Math.cos(want) * e.speed * dt, Math.sin(want) * e.speed * dt);
        e.x = moved.x; e.y = moved.y;
      } else if (!p.inCar) {
        e.punchTimer -= dt;
        if (e.punchTimer <= 0) { e.punchTimer = 0.9; damagePlayer(9); }
      }
    }
    state.enemies = state.enemies.filter((e) => !e.dead || dist(e.x, e.y, p.x, p.y) < 1200);
  }

  function updateBullets(dt) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (pointInBuildings(city.buildings, b.x, b.y, 2)) { b.life = 0; addFx(b.x, b.y, '#cccccc', 3, 80); continue; }
      if (b.fromPlayer) {
        for (const e of state.enemies) {
          if (!e.dead && dist(b.x, b.y, e.x, e.y) < 18) { damageEnemy(e, b.damage, true); b.life = 0; break; }
        }
        if (b.life > 0) for (const pd of state.peds) {
          if (!pd.dead && dist(b.x, b.y, pd.x, pd.y) < 14) { killPed(pd, false); b.life = 0; break; }
        }
        if (b.life > 0) for (const c of state.cars) {
          if (c.kind !== 'player' && !c.wrecked && Math.abs(b.x - c.x) < 26 && Math.abs(b.y - c.y) < 14) {
            c.hp -= b.damage; b.life = 0;
            if (c.hp <= 0) { c.wrecked = true; addFx(c.x, c.y, '#888888', 10, 160); }
            break;
          }
        }
      } else if (!p.inCar && dist(b.x, b.y, p.x, p.y) < 16) {
        damagePlayer(b.damage);
        b.life = 0;
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
  }

  function updateFx(dt) {
    for (const f of state.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.life -= dt; }
    state.fx = state.fx.filter((f) => f.life > 0);
  }

  function updatePolice(dt) {
    const p = state.player;
    const police = state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
    // Spawn up to the wanted level.
    state.policeTimer -= dt;
    if (state.wanted > 0 && police.length < state.wanted && state.policeTimer <= 0) {
      state.policeTimer = 1.2;
      spawnPolice();
    }
    for (const c of police) {
      if (c.block) continue;
      const d = dist(c.x, c.y, p.x, p.y);
      const want = angleTo(c.x, c.y, p.x, p.y);
      c.angle += clamp(angleDiff(c.angle, want), -3.2 * dt, 3.2 * dt);
      const targetSpeed = d > 120 ? 470 : 300;
      c.speed = lerp(c.speed, targetSpeed, dt * 1.2);
      const nx = c.x + Math.cos(c.angle) * c.speed * dt;
      const ny = c.y + Math.sin(c.angle) * c.speed * dt;
      const moved = moveCircle(city.buildings, c.x, c.y, 20, nx - c.x, ny - c.y);
      if (Math.abs(moved.x - nx) > 1 || Math.abs(moved.y - ny) > 1) c.speed *= 0.5;
      c.x = moved.x; c.y = moved.y;
      const pc = playerCar();
      if (pc && dist(c.x, c.y, pc.x, pc.y) < 48) {
        pc.speed *= 0.82; pc.hp -= 6 * dt * 10;
        c.speed *= 0.7;
        if (pc.hp <= 0 && !pc.wrecked) { pc.wrecked = true; addFx(pc.x, pc.y, '#888888', 12, 180); }
      }
      // Busted: on foot, slow, and a cop is right on top of you.
      if (!p.inCar && d < 55 && state.wanted > 0) {
        state.busted += dt;
        if (state.busted > 1.4) {
          state.over = true;
          state.busted = 0;
          state._bustedEvent = true;
        }
      } else state.busted = Math.max(0, state.busted - dt * 2);
    }
    // Helicopter at 4+ stars.
    state.heli.active = state.wanted >= 4;
    if (state.heli.active) {
      state.heli.x = lerp(state.heli.x, p.x + 120, dt * 0.8);
      state.heli.y = lerp(state.heli.y, p.y - 160, dt * 0.8);
    }
  }

  function updateWanted(dt) {
    if (state.wanted === 0) return;
    const p = state.player;
    const near = state.cars.some((c) => c.kind === 'police' && dist(c.x, c.y, p.x, p.y) < 700);
    if (!near) {
      state.decayTimer += dt;
      if (state.decayTimer > 5) {
        state.decayTimer = 0;
        state.wanted -= 1;
        if (state.wanted < 3) state.roadblockDone = false;
        setToast(state.wanted === 0 ? 'You lost the heat.' : `Heat dropping — ${state.wanted} star${state.wanted > 1 ? 's' : ''} left`);
      }
    } else state.decayTimer = 0;
  }

  reset();
  return {
    state, reset, step, startMission, setWanted: (n) => { state.wanted = clamp(n, 0, MAX_WANTED); },
    teleport(x, y) { state.player.x = x; state.player.y = y; state.camera.x = x; state.camera.y = y; },
    enterNearestCar() {
      const c = nearestCar(200);
      if (!c) return false;
      state.player.inCar = true; state.player.carId = c.id; c.kind = 'player';
      return true;
    },
    buyShop, saveGame, loadSave, nearShop, nearestCar, playerCar,
    currentMission, currentStep,
    get bustedEvent() { return !!state._bustedEvent; },
    clearBustedEvent() { state._bustedEvent = false; },
  };
}
