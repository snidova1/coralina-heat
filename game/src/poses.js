// Still poses for the staged screenshot scenes, built on the character rig: a clip held mid-motion,
// two-bone IK for arms and legs, and the stances a busy evening needs (strides with swinging arms,
// relaxed idles with the weight on one leg, a hand on the hip or a phone at the ear, pointing,
// two-handed aim, a knee in cover, a hit stagger, cowering, and climbing into a car).
import * as THREE from 'three';
import { rand } from './rng.js';

const WALK_STRIDES = [0.21, 0.26, 0.31, 0.75, 0.8, 0.85];
const RUN_STRIDES = [0.1, 0.16, 0.43, 0.5];
const IDLES = ['relaxed', 'hip', 'phone', 'crossed', 'relaxed', 'hip'];

const vec = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export function poseable(body) {
  return Boolean(body && body.sample && body.bones && body.bones.LeftArm && body.bones.LeftUpLeg);
}

/** The procedural fallback people have no rig to pose: give them the nearest live pose instead. */
function plain(body, pose, armed = false) {
  body.pose = pose;
  if (armed) body.setArmed(true);
  body.update(0.3);
}

/** A bone's position in the character's own space: metres, facing +z, its left side at +x. */
function at(body, name) {
  body.root.updateMatrixWorld(true);
  return body.root.worldToLocal(body.bones[name].getWorldPosition(vec()));
}

/** Turn a bone about its own joint so that `ref` (a bone further down the chain) swings onto `spot`. */
function swing(body, name, ref, spot) {
  const bone = body.bones[name];
  body.root.updateMatrixWorld(true);
  const pivot = bone.getWorldPosition(vec());
  const now = body.bones[ref].getWorldPosition(vec()).sub(pivot).normalize();
  const want = body.root.localToWorld(spot.clone()).sub(pivot).normalize();
  const turn = new THREE.Quaternion().setFromUnitVectors(now, want);
  const world = bone.getWorldQuaternion(new THREE.Quaternion());
  const parent = bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  bone.quaternion.copy(parent.multiply(turn.multiply(world)));
}

/** Two-bone IK: the limb's tip lands on `end`, its middle joint bending toward `pole`. */
function limb(body, [upper, middle, tip], end, pole) {
  const s = at(body, upper);
  const a = s.distanceTo(at(body, middle));
  const b = at(body, middle).distanceTo(at(body, tip));
  const span = end.clone().sub(s);
  const d = THREE.MathUtils.clamp(span.length(), Math.abs(a - b) + 1e-3, (a + b) * 0.995);
  const dir = span.normalize();
  const along = (a * a - b * b + d * d) / (2 * d);
  const out = Math.sqrt(Math.max(a * a - along * along, 0));
  const bend = pole.clone().addScaledVector(dir, -pole.dot(dir)).normalize();
  swing(body, upper, middle, s.clone().addScaledVector(dir, along).addScaledVector(bend, out));
  swing(body, middle, tip, s.clone().addScaledVector(dir, d));
}

const SIDE = { Left: 1, Right: -1 };
// a planted foot in the walk clip: ankle joint and ball of the foot above the sole's ground line
const ANKLE = 0.145;
const TOE_HEIGHT = 0.027;
const arm = (body, side, hand, pole) => limb(body, [`${side}Arm`, `${side}ForeArm`, `${side}Hand`], hand, pole ?? vec(SIDE[side] * 0.5, -0.4, -0.8));
/** Place an ankle by IK, then lay the foot flat again so the ball of the foot meets the ground. */
function leg(body, side, ankle, pole = vec(0, 0, 1)) {
  limb(body, [`${side}UpLeg`, `${side}Leg`, `${side}Foot`], ankle, pole);
  const foot = at(body, `${side}Foot`), toe = at(body, `${side}ToeBase`);
  const length = foot.distanceTo(toe);
  const drop = Math.min(foot.y - TOE_HEIGHT, length * 0.97);
  const ahead = vec(toe.x - foot.x, 0, toe.z - foot.z).normalize().multiplyScalar(Math.sqrt(length * length - drop * drop));
  swing(body, `${side}Foot`, `${side}ToeBase`, foot.add(ahead).setY(foot.y - drop));
}
const shoulder = (body, side) => at(body, `${side}Arm`);

/** Lean the torso from the small of the back: forward (+z), to its left (+x), in metres at the neck. */
function lean(body, side, forward) {
  swing(body, 'Spine02', 'neck', at(body, 'neck').add(vec(side, 0, forward)));
}

/** Drop the hips until a planted leg would stand at `reach` of its full length (soft, not locked). */
function settle(body, reach = 0.975, extra = 0) {
  const hip = at(body, 'LeftUpLeg');
  const length = hip.distanceTo(at(body, 'LeftLeg')) + at(body, 'LeftLeg').distanceTo(at(body, 'LeftFoot'));
  body.model.position.y -= hip.y - ANKLE - length * reach + extra;
}

/** Plant both feet: the weight leg under the hips, the other a little out and forward, knees soft. */
function stance(body, weight = 'Left', spread = 0.3, step = 0.14, reach = 0.975) {
  const s = SIDE[weight];
  body.model.position.x += s * 0.035;
  settle(body, reach);
  const hips = at(body, 'Hips');
  leg(body, weight, vec(s * spread * 0.4, ANKLE, hips.z + 0.02));
  leg(body, weight === 'Left' ? 'Right' : 'Left', vec(-s * spread * 0.6, ANKLE, hips.z + step), vec(-s * 0.3, 0, 1));
  return hips;
}

/** A clip frame mid-stride; walkers get softly bent elbows on top of the clip's arm swing. */
export function stride(body, gait = 'walk') {
  if (!poseable(body)) return plain(body, 'move');
  const run = gait === 'run';
  body.sample(run ? 'run' : 'walk', (run ? RUN_STRIDES : WALK_STRIDES)[Math.floor(rand() * (run ? 4 : 6))] + rand() * 0.02);
  if (!run) {
    for (const side of ['Left', 'Right']) arm(body, side, at(body, `${side}Hand`).add(vec(-SIDE[side] * 0.02, 0.07, 0.07)));
  }
  body.freeze();
}

/** Standing about: weight on one leg and one of a few natural arm holds. */
export function idle(body, variant = IDLES[Math.floor(rand() * IDLES.length)]) {
  if (!poseable(body)) return plain(body, 'move');
  body.sample('walk', 0.08);
  const weight = rand() < 0.5 ? 'Left' : 'Right';
  const hips = stance(body, weight);
  lean(body, -SIDE[weight] * 0.03, 0.01);
  const z = hips.z;
  for (const side of ['Left', 'Right']) {
    const s = SIDE[side];
    const first = side === weight;
    if (variant === 'hip' && first) arm(body, side, vec(s * 0.16, 1.0, z + 0.04), vec(s, 0, -0.5));
    else if (variant === 'phone' && !first) arm(body, side, at(body, 'Head').add(vec(s * 0.09, 0.0, -0.01)), vec(s * 0.3, -1, 0.4));
    else if (variant === 'crossed') arm(body, side, vec(-s * 0.07, 1.2 + (first ? 0.02 : 0), z + 0.2 + (first ? 0.02 : 0)), vec(s * 0.6, -1, 0));
    else arm(body, side, vec(s * 0.23, 0.97, z + 0.07), vec(s * 0.4, -0.2, -1));
  }
  body.freeze();
}

/** Point at a spot in the world, the other hand at rest; used by bystanders and contacts. */
export function pointAt(body, world, rest = 'hip') {
  if (!poseable(body)) return plain(body, 'move');
  body.sample('walk', 0.08);
  const hips = stance(body, 'Left', 0.32, 0.12);
  const target = body.root.worldToLocal(world.clone());
  const from = shoulder(body, 'Right');
  arm(body, 'Right', from.clone().add(target.sub(from).normalize().multiplyScalar(0.47)), vec(-0.6, -0.6, -0.3));
  if (rest === 'hip') arm(body, 'Left', vec(0.16, 1.0, hips.z + 0.04), vec(1, 0, -0.5));
  else arm(body, 'Left', vec(0.23, 0.97, hips.z + 0.07));
  body.freeze();
}

/** Two-handed aim from a staggered stance toward `target` (world) or straight ahead; `rise` lifts the hands. */
export function aim(body, pitch = 0, target = null, rise = 0.07) {
  if (!poseable(body)) return plain(body, 'aim', true);
  body.sample('walk', 0.08);
  settle(body, 0.95);
  const hips = at(body, 'Hips');
  leg(body, 'Left', vec(0.15, ANKLE, hips.z + 0.2));
  leg(body, 'Right', vec(-0.17, ANKLE, hips.z - 0.16), vec(0, 0, 1));
  lean(body, 0, 0.04);
  holdGun(body, pitch, target, rise);
  body.freeze();
}

function holdGun(body, pitch, target = null, rise = 0.07) {
  const right = shoulder(body, 'Right');
  const lift = Math.sin(pitch) * 0.5;
  let yaw = 0;
  if (target) {
    const local = body.root.worldToLocal(target.clone());
    yaw = Math.atan2(local.x - right.x, local.z - right.z);
  }
  const reach = vec(0.11, rise + lift, 0.47).applyAxisAngle(vec(0, 1, 0), yaw);
  const hand = right.clone().add(reach);
  arm(body, 'Right', hand, vec(-0.4, -1, 0));
  arm(body, 'Left', hand.clone().add(vec(0.03, -0.035, -0.04).applyAxisAngle(vec(0, 1, 0), yaw)), vec(0.6, -1, -0.2));
  body.setArmed(true);
  body.pose = 'aim';
  body.gun.rotation.set(pitch, yaw, 0, 'YXZ');
}

/** Down on one knee behind cover, still aiming over it. */
export function kneelAim(body, pitch = 0) {
  if (!poseable(body)) return plain(body, 'aim', true);
  body.sample('walk', 0.08);
  body.model.position.y -= 0.46;
  const hips = at(body, 'Hips');
  leg(body, 'Left', vec(0.15, ANKLE, hips.z + 0.34), vec(0, 0.4, 1));
  leg(body, 'Right', vec(-0.14, 0.11, hips.z - 0.34), vec(0, -1, 0.5));
  lean(body, 0, 0.08);
  holdGun(body, pitch);
  body.freeze();
}

/** Taking a round: the torso snaps back and twists, the gun arm flung high, the other hand to the wound. */
export function hit(body) {
  if (!poseable(body)) return plain(body, 'aim', true);
  body.sample('walk', 0.8);
  lean(body, 0.2, -0.36);
  const chest = at(body, 'Spine01');
  arm(body, 'Right', shoulder(body, 'Right').add(vec(-0.3, 0.34, -0.14)), vec(0, -1, -0.3));
  arm(body, 'Left', chest.add(vec(0.0, 0.02, 0.17)), vec(1, -0.5, 0));
  body.setArmed(true);
  body.gun.rotation.set(-1.1, 0, 0.9);
  body.freeze();
}

/** Crouched low with both hands over the head. */
export function cower(body) {
  if (!poseable(body)) return plain(body, 'cower');
  body.sample('walk', 0.08);
  body.model.position.y -= 0.36;
  const hips = at(body, 'Hips');
  leg(body, 'Left', vec(0.15, ANKLE, hips.z + 0.16));
  leg(body, 'Right', vec(-0.16, ANKLE, hips.z + 0.06));
  lean(body, 0, 0.22);
  const head = at(body, 'Head');
  for (const side of ['Left', 'Right']) arm(body, side, head.clone().add(vec(SIDE[side] * 0.07, 0.1, 0.06)), vec(SIDE[side] * 0.4, -0.6, 1));
  body.freeze();
}

/** Climbing into a car: one hand on the top of the open door, the other reaching into the cabin. */
export function boardCar(body, doorTop, cabin) {
  if (!poseable(body)) return plain(body, 'move');
  body.sample('walk', 0.08);
  settle(body, 0.95);
  const hips = at(body, 'Hips');
  leg(body, 'Left', vec(0.11, ANKLE, hips.z + 0.3));
  leg(body, 'Right', vec(-0.15, ANKLE, hips.z - 0.2));
  lean(body, 0.03, 0.3);
  arm(body, 'Right', body.root.worldToLocal(doorTop.clone()), vec(-0.5, -1, -0.3));
  arm(body, 'Left', body.root.worldToLocal(cabin.clone()), vec(0.6, -1, 0));
  body.freeze();
}
