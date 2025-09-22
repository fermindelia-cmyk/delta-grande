// utils/autoRigFish.js
import * as THREE from 'three';

export function autoRigTwoBoneFishMesh(mesh, {
  forwardLocal = new THREE.Vector3(1,0,0), // local-space "forward" axis (normalized)
  lengthPadding = 0.0,                     // optional extra span
  softness = 0.12                          // head↔tail blend width (0..0.5)
} = {}) {
  if (!mesh.isMesh || !mesh.geometry) return null;

  // 1) Prepare geometry
  const geom = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  geom.computeBoundingBox();

  // 2) Project vertices along forward axis to get [t] in [0..1]
  const pos = geom.getAttribute('position');
  const nVerts = pos.count;
  const dir = forwardLocal.clone().normalize();

  // Compute min/max projection
  let minP = +Infinity, maxP = -Infinity;
  const tmp = new THREE.Vector3();
  for (let i = 0; i < nVerts; i++) {
    tmp.fromBufferAttribute(pos, i);
    const p = tmp.dot(dir);
    if (p < minP) minP = p;
    if (p > maxP) maxP = p;
  }
  // Optional padding (for models whose bbox clips fins)
  minP -= lengthPadding; maxP += lengthPadding;
  const span = Math.max(1e-6, maxP - minP);

  // 3) Skin indices & weights (head=bone 0, tail=bone 1)
  const skinIndex = new Uint16Array(nVerts * 4);
  const skinWeight = new Float32Array(nVerts * 4);

  const sLo = THREE.MathUtils.clamp(0.5 - softness, 0.0, 0.5);
  const sHi = THREE.MathUtils.clamp(0.5 + softness, 0.5, 1.0);
  const smoothstep = (a, b, x) => {
    const t = THREE.MathUtils.clamp((x - a) / Math.max(1e-6, (b - a)), 0, 1);
    return t * t * (3 - 2 * t);
  };

  for (let i = 0; i < nVerts; i++) {
    tmp.fromBufferAttribute(pos, i);
    const t = (tmp.dot(dir) - minP) / span;           // 0..1 from head→tail
    const wHead = smoothstep(sLo, sHi, 1.0 - t);      // head influence fades after midpoint
    const wTail = 1.0 - wHead;

    const idx4 = i * 4;
    skinIndex[idx4 + 0] = 0; skinWeight[idx4 + 0] = wHead;
    skinIndex[idx4 + 1] = 1; skinWeight[idx4 + 1] = wTail;
    skinIndex[idx4 + 2] = 0; skinWeight[idx4 + 2] = 0.0;
    skinIndex[idx4 + 3] = 0; skinWeight[idx4 + 3] = 0.0;
  }

  geom.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geom.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));

  // 4) Make bones (in mesh local space)
  // Place them at 25% and 75% along the forward axis so the pivot is central-ish.
  const pHead = dir.clone().multiplyScalar(THREE.MathUtils.lerp(minP, maxP, 0.25));
  const pTail = dir.clone().multiplyScalar(THREE.MathUtils.lerp(minP, maxP, 0.75));

  const boneHead = new THREE.Bone(); boneHead.name = 'AutoHead';
  const boneTail = new THREE.Bone(); boneTail.name = 'AutoTail';
  boneHead.position.copy(pHead);
  boneTail.position.copy(pTail);

  // Hierarchy: boneHead -> boneTail (simple chain), placed under a bonesRoot
  const bonesRoot = new THREE.Bone(); bonesRoot.name = 'AutoRoot';
  bonesRoot.add(boneHead);
  boneHead.add(boneTail);

  // 5) Build skeleton & SkinnedMesh (preserve materials)
  const skinned = new THREE.SkinnedMesh(geom, mesh.material);
  skinned.name = mesh.name;
  skinned.bindMode = 'attached';
  skinned.add(bonesRoot);

  const bones = [boneHead, boneTail];
  const skeleton = new THREE.Skeleton(bones);

  skinned.bind(skeleton);

  // Transfer transforms from original mesh
  skinned.position.copy(mesh.position);
  skinned.quaternion.copy(mesh.quaternion);
  skinned.scale.copy(mesh.scale);

  return { skinned, bones: { head: boneHead, tail: boneTail }, root: bonesRoot };
}

// Heuristic: pick the "tail" as the bone **furthest from head** along the mesh's forward axis.
// We assume "forward" points toward the HEAD (because you align localForward -> velocity).
// So: max projection = head-ish, min projection = tail-ish.
export function findTailBoneDirectional(skinned, {
  ownerMesh = skinned,                  // the mesh the skeleton belongs to (for local frame)
  forwardLocal = new THREE.Vector3(1,0,0) // local-space "forward toward head"
} = {}) {
  if (!skinned || !skinned.isSkinnedMesh || !skinned.skeleton) return null;
  const bones = skinned.skeleton.bones;
  if (!bones || bones.length === 0) return null;

  // Compute world-space forward from mesh local "forward"
  const meshQuat = new THREE.Quaternion();
  ownerMesh.getWorldQuaternion(meshQuat);
  const forwardWorld = forwardLocal.clone().applyQuaternion(meshQuat).normalize();

  // Use the mesh's origin as reference
  const meshWorld = new THREE.Vector3();
  ownerMesh.getWorldPosition(meshWorld);

  let minProj = +Infinity, minBone = null;
  let maxProj = -Infinity, maxBone = null;

  const bw = new THREE.Vector3();
  for (const b of bones) {
    b.getWorldPosition(bw);
    const rel = bw.clone().sub(meshWorld);
    const proj = rel.dot(forwardWorld); // >0 is toward head, <0 toward tail (if origin near mid/body)
    if (proj < minProj) { minProj = proj; minBone = b; }
    if (proj > maxProj) { maxProj = proj; maxBone = b; }
  }

  // Head-ish is maxProj bone, Tail-ish is minProj bone
  return minBone || bones[bones.length - 1] || null;
}

// Head = bone furthest TOWARD the head along forwardLocal (max projection)
export function findHeadBoneDirectional(skinned, {
  ownerMesh = skinned,
  forwardLocal = new THREE.Vector3(1,0,0)
} = {}) {
  if (!skinned || !skinned.isSkinnedMesh || !skinned.skeleton) return null;
  const bones = skinned.skeleton.bones;
  if (!bones || bones.length === 0) return null;

  const meshQuat = new THREE.Quaternion();
  ownerMesh.getWorldQuaternion(meshQuat);
  const forwardWorld = forwardLocal.clone().applyQuaternion(meshQuat).normalize();

  const meshWorld = new THREE.Vector3();
  ownerMesh.getWorldPosition(meshWorld);

  let maxProj = -Infinity, maxBone = null;
  const bw = new THREE.Vector3();
  for (const b of bones) {
    b.getWorldPosition(bw);
    const proj = bw.sub(meshWorld).dot(forwardWorld);
    if (proj > maxProj) { maxProj = proj; maxBone = b; }
  }
  return maxBone || bones[bones.length - 1] || null;
}


// Keep the older heuristic as a fallback if needed.
export function findTailBoneFromSkeleton(skinned) {
  if (!skinned || !skinned.isSkinnedMesh || !skinned.skeleton) return null;
  const bones = skinned.skeleton.bones;
  const byName = bones.find(b => /tail|caudal/i.test(b.name));
  if (byName) return byName;
  const leaves = bones.filter(b => b.children.length === 0);
  if (leaves.length) return leaves[leaves.length - 1];
  return bones[bones.length - 1] || null;
}
