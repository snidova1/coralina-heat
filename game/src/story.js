// The story of Coralina Heat: Rafa Reyes comes home to Coralina Bay after six years away and works
// his way from motel errands to taking down Saint Ocho's Tiburones crew. The cast, and the six jobs
// as data: what each step asks, where, and what the characters say.
import { PLACES } from './map.js';

export const CAST = {
  nico: { name: 'RAFA', color: '#ffffff' },
  paloma: { name: 'PALOMA', color: '#ff7ab8', full: 'Paloma Vega', blurb: 'Runs the Flamingo Rest motel. Raised Rafa, mostly.' },
  tito: { name: 'TITO', color: '#ffd23f', full: 'Tito Brass', blurb: 'Bayline Cab dispatcher. Moves anything, asks nothing.' },
  vera: { name: 'VERA', color: '#c79bff', full: 'Vera Lux', blurb: 'Owns Lux Tower and half the skyline. Wants the other half.' },
  crane: { name: 'DET. CRANE', color: '#6fb7ff', full: 'Det. Hollis Crane', blurb: 'CBPD. Badge for rent, hourly.' },
  ocho: { name: 'SAINT OCHO', color: '#4ff0c2', full: 'Saint Ocho', blurb: 'Boss of the Tiburones. Owns the docks, wants the rest.' },
  radio: { name: 'BAYWAVE 98.4', color: '#7ff6ff' },
};

export const MISSIONS = [
  {
    id: 'back-in-the-bay', title: 'Back in the Bay', giver: 'paloma', reward: 500, start: { x: 352, z: -168 },
    steps: [
      { type: 'talk', lines: [['paloma', 'Six years, Rafa. Six. And you walk in like you went out for cigarettes.'], ['nico', 'Missed you too, Auntie.'], ['paloma', 'The Tiburones are squeezing every business on Ocean Drive. I need wheels and I need you.']] },
      { type: 'enterVehicle', text: 'Get a car. Any car. Press F next to one.' },
      { type: 'goto', x: 345, z: 72, r: 7, vehicle: true, text: 'Drive across the canal bridge to the ~Ocean Drive lot~.' },
      { type: 'talk', lines: [['paloma', 'Not bad. You still drive like a stolen car is a rental.'], ['paloma', 'Tito at the marina owes me. Go see him.']] },
    ],
  },
  {
    id: 'meter-running', title: 'Meter Running', giver: 'tito', reward: 1500, start: { x: 200, z: 378 },
    steps: [
      { type: 'talk', lines: [['tito', 'Paloma\'s boy! Take the cab. Package at Lux Tower, back here in ninety seconds.'], ['nico', 'And if I\'m late?'], ['tito', 'Then the package is late, and I don\'t do late.']] },
      { type: 'enterVehicle', spawn: { type: 'taxi', x: 196, z: 356.6, heading: -Math.PI / 2 }, text: 'Get in the ~Bayline Cab~.' },
      { type: 'goto', ...PLACES.tower, r: 7, vehicle: true, text: 'Pick up the package at ~Lux Tower~.' },
      { type: 'goto', x: 200, z: 374, r: 8, vehicle: true, timer: 90, text: 'Bring the package back to ~Kingfish Marina~.' },
      { type: 'talk', lines: [['tito', 'Eighty-nine and change. You\'re hired, kid.']] },
    ],
  },
  {
    id: 'shark-tank', title: 'Shark Tank', giver: 'paloma', reward: 3000, start: { x: 300, z: -160 },
    steps: [
      { type: 'talk', lines: [['paloma', 'Ocho\'s boys torched the Sea Breeze last night.'], ['paloma', 'There\'s a Kestrel in the ice machine. Pay their warehouse a visit.']] },
      { type: 'giveWeapon', weapon: 'pistol', ammo: 60 },
      { type: 'goto', x: -197, z: 300, r: 9, text: 'Go to the ~Tiburones warehouse~ in Little Havana Heights.' },
      { type: 'eliminate', text: 'Take out the ~Tiburones~ crew.', spawn: [[-222, 318], [-236, 335], [-214, 342], [-242, 322], [-228, 347]] },
      { type: 'wanted', level: 2 },
      { type: 'evade', text: 'The CBPD heard the shooting. ~Lose the cops~.' },
    ],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', giver: 'vera', reward: 5000, start: { x: 10, z: -209 },
    steps: [
      { type: 'talk', lines: [['vera', 'Mr. Reyes. Ocho drives a Vortice GT he hasn\'t paid for. I\'d like it to be mine.'], ['vera', 'It\'s parked on Coral Heights. Bring it to the Flamingo Rest. Unscratched-ish.']] },
      { type: 'enterVehicle', spawn: { type: 'sports', x: -120 + 3.4, z: -290, heading: Math.PI, color: 0xff2d3c }, text: 'Steal Ocho\'s ~Vortice GT~.' },
      { type: 'wanted', level: 3 },
      { type: 'evade', text: 'The car is reported stolen. ~Lose the heat~.' },
      { type: 'goto', x: 352, z: -150, r: 7, vehicle: true, text: 'Deliver the GT to the ~Flamingo Rest~.' },
      { type: 'talk', lines: [['vera', 'Red suits it. Consider yourself on my payroll.']] },
    ],
  },
  {
    id: 'paper-trail', title: 'Paper Trail', giver: 'crane', reward: 4000, start: { x: 80, z: 89 },
    steps: [
      { type: 'talk', lines: [['crane', 'Reyes. Somebody\'s building a file on Vera Lux. Three copies.'], ['crane', 'Hospital records, canal drop, Ocean Drive. Collect them before the ink dries.']] },
      { type: 'goto', ...PLACES.hospital, r: 6, text: 'Grab the file at ~St. Marisol Medical~.' },
      { type: 'wanted', level: 2 },
      { type: 'goto', x: 200, z: 9, r: 6, text: 'Grab the file at the ~Venetia Canal~ drop.' },
      { type: 'goto', x: 370, z: 200, r: 6, text: 'Grab the last file on the ~Ocean Drive promenade~.' },
      { type: 'evade', text: '~Lose the cops~ with the files.' },
    ],
  },
  {
    id: 'sunset-heat', title: 'Sunset Heat', giver: 'paloma', reward: 25000, start: { x: 340, z: -175 },
    steps: [
      { type: 'talk', lines: [['paloma', 'Ocho is loading a boat at Kingfish Marina tonight. Running, with everything he took.'], ['nico', 'Then he runs without it.']] },
      { type: 'giveWeapon', weapon: 'smg', ammo: 160 },
      { type: 'goto', x: 120, z: 372, r: 10, text: 'Get to ~Kingfish Marina~ before the boat leaves.' },
      { type: 'eliminate', boss: true, text: 'Take down ~Saint Ocho~ and his crew.', spawn: [[164, 384, 'boss'], [172, 376.5], [157, 379], [177, 388], [149, 386], [161, 374.5]] },
      { type: 'talk', lines: [['ocho', 'Coralina... was... mine...'], ['nico', 'Coralina was never anybody\'s.']] },
      { type: 'wanted', level: 4 },
      { type: 'evade', text: 'Half the CBPD is coming. ~Lose them~.' },
      { type: 'goto', x: 352, z: -150, r: 8, text: 'Go home to the ~Flamingo Rest~.' },
      { type: 'talk', lines: [['paloma', 'Welcome home, mijo. For real this time.']] },
    ],
  },
];

/** Loose cash and pickups scattered round the bay: an incentive to explore. */
export const PICKUPS = [
  { kind: 'cash', x: 398, z: -320, amount: 250 }, { kind: 'cash', x: -300, z: -300, amount: 400 },
  { kind: 'armor', x: 120, z: 98 }, { kind: 'health', x: -129, z: -150 },
  { kind: 'cash', x: 40, z: 10, amount: 300 }, { kind: 'cash', x: -330, z: 200, amount: 500 },
  { kind: 'armor', x: 290, z: 380 }, { kind: 'health', x: 352, z: -130 },
  { kind: 'cash', x: -700, z: -200, amount: 1000 }, { kind: 'cash', x: 250, z: -380, amount: 350 },
  { kind: 'ammo', x: -50, z: 249 }, { kind: 'ammo', x: 300, z: 131 },
];

export const RADIO_LINES = [
  'You\'re locked to Baywave ninety-eight point four, the sound of the sunset strip.',
  'Traffic on the Sunspan is backed up to the mainland. Again. Stay on the island, folks.',
  'Coralina Bay PD reminds you: the speed limit on Ocean Drive is a suggestion we enforce.',
];
