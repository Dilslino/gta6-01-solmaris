// Every tuning number, colour, district, shop and mission definition in one place.
// Solmaris is an original sunny coastal city. No real-world place, brand or franchise is used.
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 5200, height: 3800 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmaris.save.v1';

export const ROAD_W = 96;
export const AVENUES = [420, 1120, 1820, 2520, 3220, 3920, 4620];
export const STREETS = [380, 980, 1580, 2180, 2780, 3380];
// South of this line: sand, then the sea.
export const BEACH_Y = 3480;

export const DISTRICTS = [
  { name: 'Marina Bay', x: 0, y: 0, w: 1500, h: 1700, tint: '#7fb8a4', desc: 'Cafes and the old marina' },
  { name: 'Old Town', x: 1500, y: 0, w: 1500, h: 1700, tint: '#d9b380', desc: 'Narrow lanes, tiled roofs' },
  { name: 'Downtown', x: 3000, y: 0, w: 2200, h: 1700, tint: '#8fa8c8', desc: 'Glass towers and the bank' },
  { name: 'Palm Heights', x: 0, y: 1700, w: 2600, h: 1780, tint: '#a8c98a', desc: 'Hillside houses and parks' },
  { name: 'Harbor East', x: 2600, y: 1700, w: 2600, h: 1780, tint: '#c8a08a', desc: 'Docks, warehouses, the harbor' },
];

export const PLAYER = { radius: 13, walkSpeed: 230, runSpeed: 330, health: 100, punchDamage: 25, punchRange: 34 };
export const CAR = { accel: 420, brake: 700, maxSpeed: 520, reverseMax: 160, steer: 2.6, grip: 6 };

export const WEAPONS = {
  fists: { name: 'Fists', damage: 25, range: 34, rate: 0.35, auto: false },
  bat: { name: 'Bat', damage: 45, range: 44, rate: 0.45, auto: false },
  pistol: { name: 'Pistol', damage: 34, range: 520, rate: 0.28, auto: false, price: 300, ammoPrice: 40 },
};

export const SHOPS = [
  { id: 'guns', name: 'IRONWORKS GUNS', kind: 'guns', x: 1820, y: 1580, dx: 60, dy: -70, color: '#c0392b',
    items: [
      { key: '1', label: 'Pistol — $300', price: 300, buy: 'pistol' },
      { key: '2', label: 'Ammo x24 — $40', price: 40, buy: 'ammo' },
      { key: '3', label: 'Bat — $80', price: 80, buy: 'bat' },
    ] },
  { id: 'food', name: 'TACO MARINA', kind: 'food', x: 1120, y: 980, dx: -60, dy: 70, color: '#e67e22',
    items: [
      { key: '1', label: 'Taco meal +40 HP — $20', price: 20, buy: 'food' },
      { key: '2', label: 'Big feast full HP — $50', price: 50, buy: 'feast' },
    ] },
  { id: 'garage', name: 'PISTON GARAGE', kind: 'garage', x: 3220, y: 2180, dx: 60, dy: 70, color: '#2980b9',
    items: [
      { key: '1', label: 'Repair car — $50', price: 50, buy: 'repair' },
      { key: '2', label: 'Tune engine +speed — $200', price: 200, buy: 'tune' },
    ] },
];

// Mission chain "The Solmaris Job". Each mission: intro text + steps.
// Step types: goto (reach marker), wait (stand in zone for seconds), chase (stay near a
// fleeing car), survive (stay alive / evade for seconds), defeat (beat N enemies), deliver.
export const MISSIONS = [
  { id: 1, title: '1 · The Call', reward: 150,
    intro: 'Mara calls from the Marina cafe. Someone in Solmaris wants a driver who asks no questions. Go meet her.',
    steps: [{ type: 'goto', x: 1120, y: 980, r: 70, label: 'Meet Mara at Taco Marina' }] },
  { id: 2, title: '2 · The Package', reward: 250,
    intro: 'Mara needs a package lifted from the Harbor East docks and dropped at Piston Garage. No cops, no questions.',
    steps: [
      { type: 'goto', x: 4620, y: 2780, r: 70, label: 'Pick up the package at the docks' },
      { type: 'goto', x: 3220, y: 2180, r: 80, label: 'Deliver the package to Piston Garage' },
    ] },
  { id: 3, title: '3 · Tail Spin', reward: 350,
    intro: 'A courier is running the same route with a ledger the crew needs. Tail him — stay close, do not lose him.',
    steps: [{ type: 'chase', seconds: 9, label: 'Tail the courier — stay within 260 for 9s' }] },
  { id: 4, title: '4 · The Score', reward: 600,
    intro: 'Downtown bank, midday. Walk in, hold the floor while the vault opens, then get out rich.',
    steps: [
      { type: 'goto', x: 3920, y: 980, r: 80, label: 'Enter the Downtown bank' },
      { type: 'wait', x: 3920, y: 980, r: 90, seconds: 7, label: 'Hold the floor — vault opening…' },
      { type: 'goto', x: 3220, y: 2180, r: 90, label: 'Escape to Piston Garage' },
    ] },
  { id: 5, title: '5 · The Getaway', reward: 450,
    intro: 'The whole city is awake now. Lose the heat and reach the Palm Heights hideout in one piece.',
    steps: [{ type: 'survive', seconds: 30, x: 1120, y: 2180, r: 110, label: 'Lose the cops, then reach the hideout' }] },
  { id: 6, title: '6 · The Final Job', reward: 800,
    intro: 'One last score at the harbor. Take down the dock crew, grab the keys, and sail out of Solmaris a legend.',
    steps: [
      { type: 'goto', x: 4620, y: 3380, r: 90, label: 'Reach the harbor warehouse' },
      { type: 'defeat', count: 4, label: 'Take down the dock crew (0/4)' },
      { type: 'goto', x: 4620, y: 3480, r: 80, label: 'Board the boat and leave Solmaris' },
    ] },
];

export const CAR_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#e67e22', '#ecf0f1', '#1abc9c', '#fd79a8', '#636e72'];
export const PED_COLORS = ['#f39c12', '#8e44ad', '#16a085', '#d35400', '#2c3e50', '#c0392b', '#7f8c8d', '#e84393'];

export const PALETTE = {
  grass: '#7ec850', grass2: '#8fd45e', sand: '#f2d8a0', sea: '#2e9fd8', seaDeep: '#1b7fb8',
  road: '#3d4450', roadEdge: '#2c313c', sidewalk: '#b9bec7', dash: '#f5d76e',
  park: '#5da244', plaza: '#c9c2b4', roofA: '#c96f4a', roofB: '#5b8dc9', roofC: '#e8b64c',
  roofD: '#7fb069', roofE: '#9b7bb8', wall: '#8a7f72', text: '#f4f6f8', muted: '#aeb6c2',
  hud: 'rgba(12,16,22,0.72)', accent: '#ffd23f', danger: '#ff5252', police: '#2f6df6',
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
