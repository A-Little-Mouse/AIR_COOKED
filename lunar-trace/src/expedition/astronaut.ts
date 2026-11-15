import * as THREE from 'three';
import { HIP_Y, HIP_Z, SHOULDER_Y, SHOULDER_Z, skinWeightsFor } from './rigWeights.ts';

/**
 * The astronaut GLB is one static mesh (no skeleton, no clips), so it is rigged here: a 5-bone skeleton (root at the feet,
 * two hips, two shoulders) with smooth weights from rigWeights.ts, driven by a procedural walk cycle.
 */
export interface AstronautRig {
  /** Advance the pose. `phase` = walk-cycle phase (radians), `walking` = whether movement keys are held, `dt` in seconds. */
  update(phase: number, walking: boolean, dt: number): void;
  /** Jump straight to a fully-walking pose at `phase` (used by the dev preview page). */
  pose(phase: number): void;
  /** The skeleton: [root, left hip, right hip, left shoulder, right shoulder] (for tests/debugging). */
  bones: THREE.Bone[];
}

const FEET_Y = -0.5;

export function rigAstronaut(source: THREE.Mesh): AstronautRig {
  const geometry = source.geometry.clone();
  const pos = geometry.getAttribute('position');
  const skinIndex = new Uint16Array(pos.count * 4);
  const skinWeight = new Float32Array(pos.count * 4);
  for (let i = 0; i < pos.count; i++) {
    const s = skinWeightsFor(pos.getX(i), pos.getY(i), pos.getZ(i));
    for (let k = 0; k < 4; k++) { skinIndex[i * 4 + k] = s.index[k]; skinWeight[i * 4 + k] = s.weight[k]; }
  }
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  const bone = (x: number, y: number, z: number) => { const b = new THREE.Bone(); b.position.set(x, y, z); return b; };
  const root = bone(0, FEET_Y, 0);
  const hipL = bone(0, HIP_Y - FEET_Y, -HIP_Z), hipR = bone(0, HIP_Y - FEET_Y, HIP_Z);
  const shoulderL = bone(0, SHOULDER_Y - FEET_Y, -SHOULDER_Z), shoulderR = bone(0, SHOULDER_Y - FEET_Y, SHOULDER_Z);
  root.add(hipL, hipR, shoulderL, shoulderR);

  const mesh = new THREE.SkinnedMesh(geometry, source.material);
  mesh.name = source.name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.frustumCulled = false; // the bounding sphere is computed for the rest pose; limbs swing outside it
  mesh.add(root);
  mesh.bind(new THREE.Skeleton([root, hipL, hipR, shoulderL, shoulderR])); // bind pose = the model as authored
  source.parent!.add(mesh);
  source.parent!.remove(source);

  let gait = 0; // 0 = standing, 1 = full walk; eased so starting/stopping isn't a snap
  const apply = (phase: number) => {
      const swing = Math.sin(phase);
      const idle = Math.sin(phase) * (1 - gait); // phase advances slowly while idle -> gentle breathing sway
      // Legs hang along -Y, so they swing front/back about Z. The arms stick out sideways (+/-Z) in the authored pose: lower them
      // (about X, order YXZ so this is applied first) and then swing them front/back about the vertical Y axis, each arm opposite
      // to the leg on its side. A positive turn about Y moves +Z (right arm) forward and -Z (left arm) backward.
      const down = 0.2 + 0.35 * gait;
      hipL.rotation.z = 0.62 * gait * swing;
      hipR.rotation.z = -0.62 * gait * swing;
      shoulderL.rotation.set(-down, 0.5 * gait * swing + 0.04 * idle, 0, 'YXZ');
      shoulderR.rotation.set(down, 0.5 * gait * swing + 0.04 * idle, 0, 'YXZ');
      // lean into the walk (+X is front, so a forward lean is a negative turn about Z), pivoting at the feet
      root.rotation.z = -0.1 * gait;
  };
  return {
    update(phase, walking, dt) {
      gait += ((walking ? 1 : 0) - gait) * Math.min(1, dt * 12);
      apply(phase);
    },
    pose(phase) { gait = 1; apply(phase); },
    bones: [root, hipL, hipR, shoulderL, shoulderR],
  };
}
