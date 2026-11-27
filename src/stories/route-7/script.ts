import { beats } from '../../engine/beats';
import { ClipTrack } from '../../engine/clips';
import { Track } from '../../engine/timeline';
import { REAL } from '../../engine/look';
import type { CameraKey } from '../../engine/camera';
import type { Cue } from '../../engine/types';
import { BUS, STOPS, routePose, shelterPose } from './world';

// The whole film on one page: when things happen, in story seconds.

export const DURATION = 112;

/** When the passenger moves from the shelter to her seat (hidden by a cut). */
export const BOARDED = 69.5;

export const CUES: Cue[] = [
  { at: 2.0, type: 'voice', id: 'r1' },
  { at: 14.5, type: 'voice', id: 'r2' },
  { at: 27.0, type: 'voice', id: 'r3' },
  { at: 29.8, type: 'sfx', id: 'door' },
  { at: 31.0, type: 'sfx', id: 'horn' },
  { at: 34.6, type: 'sfx', id: 'door' },
  { at: 40.0, type: 'sfx', id: 'door' },
  { at: 41.5, type: 'voice', id: 'r4' },
  { at: 43.0, type: 'sfx', id: 'door' },
  { at: 52.5, type: 'voice', id: 'r5' },
  { at: 58.5, type: 'wait', target: 'passenger', prompt: 'Tap her to wave the bus down' },
  { at: 59.0, type: 'sfx', id: 'brake' },
  { at: 61.6, type: 'sfx', id: 'horn' },
  { at: 66.2, type: 'sfx', id: 'door' },
  { at: 70.6, type: 'voice', id: 'a1' },
  { at: 73.0, type: 'voice', id: 'p1' },
  { at: 76.4, type: 'voice', id: 'a2' },
  { at: 78.8, type: 'voice', id: 'p2' },
  { at: 82.4, type: 'voice', id: 'a3' },
  { at: 85.4, type: 'sfx', id: 'coin' },
  { at: 86.4, type: 'voice', id: 'a4' },
  { at: 89.2, type: 'sfx', id: 'door' },
  { at: 96.0, type: 'voice', id: 'r7' },
];

/** Bus distance along the route (m). Jumps happen only across camera cuts. */
export const BUS_S = new Track<number>([
  { t: 0, v: 8 },
  { t: 26, v: 76, ease: 'linear' },
  // stop 1
  { t: 26.0001, v: 80, ease: 'linear' },
  { t: 29.5, v: STOPS[0], ease: 'outCubic' },
  { t: 35.8, v: STOPS[0] },
  { t: 37, v: STOPS[0] + 4, ease: 'inCubic' },
  // stop 2
  { t: 37.0001, v: STOPS[1] - 10, ease: 'linear' },
  { t: 39.5, v: STOPS[1], ease: 'outCubic' },
  { t: 43.6, v: STOPS[1] },
  { t: 48, v: STOPS[1] + 22, ease: 'inCubic' },
  // last stop
  { t: 48.0001, v: STOPS[2] - 26, ease: 'linear' },
  { t: 53.5, v: STOPS[2], ease: 'outCubic' },
  // he gives up and pulls away; she waves (the story waits at 58.5 for the tap) and he stops
  { t: 55.2, v: STOPS[2] },
  { t: 58.5, v: STOPS[2] + 6, ease: 'inCubic' },
  { t: 60.6, v: STOPS[2] + 8, ease: 'outCubic' },
  { t: 62.4, v: STOPS[2] + 8 },
  { t: 65.8, v: STOPS[2] },
  // away into the evening
  { t: 90.5, v: STOPS[2] },
  { t: 112, v: STOPS[2] + 70, ease: 'inCubic' },
]);

/** Scalar beats on a GSAP timeline, seeked to story time every frame. */
export const B = beats({ day: 0, door: 0, lights: 0, brake: 0, glance: 0, wave: 0, arrive: 0, reach: 0, take: 0, tin: 0, smile: 0, step: 0 }, (tl, s) => {
  // time of day: 0 dawn, 1 midday, 2 sunset, 2.4 dusk
  tl.fromTo(s, { day: 0 }, { day: 0.25, duration: 26, ease: 'none' }, 0)
    .fromTo(s, { day: 0.5 }, { day: 0.6, duration: 11, ease: 'none' }, 26)
    .fromTo(s, { day: 1.0 }, { day: 1.1, duration: 7, ease: 'none' }, 37)
    .fromTo(s, { day: 1.15 }, { day: 1.8, duration: 4, ease: 'sine.inOut' }, 44)
    .fromTo(s, { day: 1.95 }, { day: 2.4, duration: 52, ease: 'none' }, 48);
  // the sliding door
  const door = (at: number, open: boolean) => tl.fromTo(s, { door: open ? 0 : 1 }, { door: open ? 1 : 0, duration: 0.8, ease: 'power2.inOut' }, at);
  door(29.8, true); door(34.6, false); door(40.0, true); door(43.0, false); door(66.2, true); door(89.2, false);
  tl.fromTo(s, { lights: 0 }, { lights: 1, duration: 0.6 }, 50);
  tl.fromTo(s, { brake: 0 }, { brake: 1, duration: 0.15 }, 59.0).fromTo(s, { brake: 1 }, { brake: 0, duration: 0.4 }, 62.6);
  // Baba Ayo looks out of the door at each stop, then to the mirror at the last
  tl.fromTo(s, { glance: 0 }, { glance: 1, duration: 0.8 }, 30.2).fromTo(s, { glance: 1 }, { glance: 0, duration: 0.8 }, 34.4)
    .fromTo(s, { glance: 0 }, { glance: 1, duration: 0.8 }, 40.3).fromTo(s, { glance: 1 }, { glance: 0, duration: 0.8 }, 43.0)
    .fromTo(s, { glance: 0 }, { glance: 1, duration: 0.8 }, 53.6).fromTo(s, { glance: 1 }, { glance: 0, duration: 0.8 }, 54.8);
  // she waves him down, then steps aboard
  tl.fromTo(s, { wave: 0 }, { wave: 1, duration: 0.5, ease: 'back.out(2)' }, 58.6).fromTo(s, { wave: 1 }, { wave: 0, duration: 0.7 }, 62.8);
  tl.fromTo(s, { arrive: 0 }, { arrive: 1, duration: 1.4, ease: 'sine.out' }, 56.4);
  tl.fromTo(s, { step: 0 }, { step: 1, duration: 2.4, ease: 'sine.inOut' }, 67.0);
  // the fare: she holds out the coin, he takes it, looks at it, drops it in the tin
  tl.fromTo(s, { reach: 0 }, { reach: 1, duration: 1.0, ease: 'sine.inOut' }, 79.0).fromTo(s, { reach: 1 }, { reach: 0, duration: 0.9 }, 81.0);
  tl.fromTo(s, { take: 0 }, { take: 1, duration: 0.9, ease: 'sine.inOut' }, 80.0)
    .fromTo(s, { take: 1 }, { take: 0, duration: 0.6 }, 86.2);
  tl.fromTo(s, { tin: 0 }, { tin: 1, duration: 0.8, ease: 'sine.inOut' }, 84.5).fromTo(s, { tin: 1 }, { tin: 0, duration: 0.7 }, 85.8);
  tl.fromTo(s, { smile: 0 }, { smile: 1, duration: 1.2 }, 82.4);
});

/** Baba Ayo (Quaternius Universal Animation Library, CC0). */
export const DRIVER_CLIPS = new ClipTrack([{ clip: 'Driving_Loop', at: 0 }]);

/** The passenger: climbs onto the bench, waves, walks aboard, sits. */
export const PASSENGER_CLIPS = new ClipTrack([
  { clip: 'Walk_Loop', at: 0 },
  { clip: 'Idle_Loop', at: 57.8, fade: 0.4 },
  { clip: 'Walk_Loop', at: 67.0, fade: 0.3, speed: 0.8 },
  { clip: 'Sitting_Idle_Loop', at: BOARDED, fade: 0 },
  { clip: 'Sitting_Talking_Loop', at: 72.8, fade: 0.5 },
  { clip: 'Sitting_Idle_Loop', at: 76.0, fade: 0.6 },
]);

// ------------------------------------------------------------------ camera helpers
type V3 = [number, number, number];
/** A point in bus space at time t: x to the driver's side, y up from the water, z to the front. */
export function busPoint(t: number, x: number, y: number, z: number): V3 {
  const p = routePose(BUS_S.sample(t));
  y += BUS_RAISE;
  const left = p.right.clone().multiplyScalar(-1);
  const w = p.pos.clone().addScaledVector(left, x).addScaledVector(p.forward, z);
  return [w.x, y, w.z];
}
/** A point near shelter i: `out` away from the road, `along` the route, `up`. */
export function shelterPoint(i: number, out: number, along: number, up: number): V3 {
  const s = shelterPose(i);
  const w = s.pos.clone().addScaledVector(s.right, out).addScaledVector(s.forward, along);
  return [w.x, up, w.z];
}

/** The realistic look's bus is lower: its cabin sits this much further down. */
const LOW = REAL ? 0.42 : 0;
/** The realistic bus rides this much higher than the old one, with a little flood still inside. */
export const BUS_RAISE = REAL ? 0.3 : 0;
/** ...and its doorway sits further back, so shots through it move back too. */
/** ...and the over-the-shoulder shot stands wider of her, so her hair isn't the foreground. */
const SHOULDER = REAL ? -0.4 : 0;
const DOOR_BACK = REAL ? 0.55 : 0, DOOR_OUT = REAL ? 0.1 : 0, DOOR_WIDEN = REAL ? 10 : 0;
const driverFace = (t: number) => busPoint(t, 0.45, 1.27 - LOW, 1.35);

/** The narrator's camera. Vertical frame (9:16): favour height, stage in depth. */
export const CAMERA: CameraKey[] = [
  // dawn: high over the drowned street, coming down to meet the bus
  { t: 0, pos: [-3, 16, -45], look: [1.5, 2, 10], fov: 50 },
  { t: 9, pos: [-3.2, 4.5, -26], look: busPoint(9, 0, 1, 0), fov: 44 },
  { t: 14.4, pos: busPoint(14.4, 2.8, 1.4, 5.0), look: busPoint(14.4, 0.4, 1.0, 1.0), fov: 42 },
  // alongside the driver's window, then round to the windscreen
  { t: 14.5, pos: busPoint(14.5, 2.1 + LOW, 1.3 - LOW, 1.45), look: driverFace(14.5), fov: 36, cut: true },
  { t: 20, pos: busPoint(20, 1.9 + LOW, 1.3 - LOW, 1.9), look: driverFace(20), fov: 34 },
  { t: 23.2, pos: busPoint(23.2, 2.4, 1.35 - LOW, 3.6), look: busPoint(23.2, 0.45, 1.2 - LOW, 1.6), fov: 38 },
  { t: 25.9, pos: busPoint(25.9, 0.7, 1.3 - LOW * 0.5, 4.6), look: busPoint(25.9, 0.35, 1.1 - LOW, 1.5), fov: 38 },
  // stop 1, from up the street: the bus pulls in beside the empty shelter
  { t: 26, pos: shelterPoint(0, -0.2, 7.5, 1.1), look: shelterPoint(0, -1.2, -6, 1.1), fov: 46, cut: true },
  { t: 31, pos: shelterPoint(0, -0.3, 7.0, 1.15), look: shelterPoint(0, -0.9, -0.5, 1.1), fov: 42 },
  { t: 36.9, pos: shelterPoint(0, -0.4, 6.6, 1.2), look: shelterPoint(0, -0.9, 0, 1.1), fov: 40 },
  // stop 2, looking down from a rooftop at midday
  { t: 37, pos: shelterPoint(1, 3.5, -10, 8.5), look: shelterPoint(1, -1.7, 0, 0.4), fov: 40, cut: true },
  { t: 43.9, pos: shelterPoint(1, 3.3, -8.8, 8.0), look: shelterPoint(1, -1.7, 1, 0.5), fov: 38 },
  // the days go by: the bus leaves down the long street
  { t: 44, pos: busPoint(44, -0.6, 1.3, -9), look: busPoint(44, 0, 1.5, 30), fov: 40, cut: true },
  { t: 47.9, pos: busPoint(44, -0.6, 1.8, -9), look: busPoint(47.9, 0, 1.5, 0), fov: 34 },
  // the last stop, evening: from beside the empty bench, the bus comes in
  { t: 48, pos: shelterPoint(2, 0.4, -2.6, 1.15), look: busPoint(48, 0, 1.0, 0), fov: 40, cut: true },
  { t: 53.5, pos: shelterPoint(2, 0.35, -2.8, 1.2), look: busPoint(53.5, 0.2, 1.1, 0.6), fov: 44 },
  { t: 56.4, pos: shelterPoint(2, 0.3, -2.9, 1.2), look: busPoint(56.4, 0.2, 1.1, 0.6), fov: 44 },
  // over her shoulder as the bus pulls away, stops and backs up
  { t: 56.5, pos: shelterPoint(2, 0.6 + SHOULDER, -1.3, 2.0), look: shelterPoint(2, -2.2, 5, 1.3), fov: 50, cut: true },
  { t: 58.5, pos: shelterPoint(2, 0.6 + SHOULDER, -1.2, 2.0), look: shelterPoint(2, -2.2, 6, 1.35), fov: 48, hold: true },
  { t: 62.5, pos: shelterPoint(2, 0.6 + SHOULDER, -1.2, 2.0), look: shelterPoint(2, -2.2, 6, 1.3), fov: 48 },
  ...(REAL ? [
    // low, from the shelter: she steps across and ducks in through the T3's low doorway
    { t: 65.9, pos: shelterPoint(2, 0.45, -1.35, 1.3), look: shelterPoint(2, -1.5, -0.1, 0.95), fov: 56, cut: true },
    { t: 69.4, pos: shelterPoint(2, 0.45, -1.3, 1.28), look: shelterPoint(2, -1.6, 0.0, 0.9), fov: 54 },
  ] : [
    { t: 66, pos: shelterPoint(2, 0.7, -2.0, 1.9), look: shelterPoint(2, -1.0, 0.6, 1.1), fov: 50 },
    { t: 69.4, pos: shelterPoint(2, 0.7, -2.2, 1.85), look: shelterPoint(2, -1.4, 0.6, 1.0), fov: 50 },
  ]),
  // through the open door: the conversation and the fare
  { t: 69.5, pos: busPoint(69.5, -1.8 - DOOR_OUT, 1.2 - LOW, 0.7 - DOOR_BACK), look: busPoint(69.5, 0.4, 1.12 - LOW, 0.85), fov: 46 + DOOR_WIDEN, cut: true },
  { t: 79, pos: busPoint(79, -1.7 - DOOR_OUT, 1.2 - LOW, 0.75 - DOOR_BACK), look: busPoint(79, 0.4, 1.1 - LOW, 0.9), fov: 43 + DOOR_WIDEN },
  { t: 84, pos: busPoint(84, -1.6 - DOOR_OUT, 1.2 - LOW, 0.8 - DOOR_BACK), look: busPoint(84, 0.35, 1.1 - LOW, 1.05), fov: 38 + DOOR_WIDEN },
  { t: 88.4, pos: busPoint(88.4, -1.6 - DOOR_OUT, 1.2 - LOW, 0.8 - DOOR_BACK), look: busPoint(88.4, 0.35, 1.12 - LOW, 0.9), fov: 40 + DOOR_WIDEN },
  // away into the sunset
  { t: 88.5, pos: busPoint(88.5, -4.5, 1.6, -7), look: busPoint(88.5, 0, 1.0, 0), fov: 46, cut: true },
  { t: 101, pos: busPoint(88.5, -1.5, 3.2, -12), look: busPoint(101, 0, 1.5, 6), fov: 42 },
  { t: 112, pos: busPoint(88.5, -0.8, 5.5, -16), look: busPoint(112, 0, 3, 40), fov: 40 },
];

/** Bus-space points the coin passes through: her hand, the handover, in front of his eyes, the tin. */
export const FARE = { from: [0.3, 1.25 - LOW, 0.6] as V3, to: (REAL ? [0.15, 1.12, 0.74] : [0.08, 1.35, 1.05]) as V3, view: [0.32, 1.55 - LOW, 1.75] as V3, tin: [0.05, 1.3 - LOW, 1.95] as V3 };
export { BUS };
