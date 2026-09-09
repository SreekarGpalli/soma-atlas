/** Add only new HRA v1.10 female meshes; preserve the existing module and ids.
 * Registration is fitted and checked against shared source landmarks before writing.
 * Inputs and SHA256 provenance are recorded in data/hra-supplement.json.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { mergeDocuments, unpartition, prune, dedup, draco, weld, simplify } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import { Matrix4, Matrix3, Vector3 } from 'three';
import draco3d from 'draco3dgltf';
import { classifySystem, classifyRegion } from './taxonomy.mjs';

const source = 'data/raw/hra-female-v1.10.glb';
const masterPath = 'public/models/female-pelvis.glb';
const catalogPath = 'src/data/catalog-female.json';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});
const rows = JSON.parse(readFileSync(catalogPath));
const current = await io.read(masterPath);
const latest = await io.read(source);
const aliases = new Map(rows.flatMap(r => (r.aliases ?? []).map(a => [a, r])));
const nodes = new Map(current.getRoot().listNodes().filter(n => n.getMesh()).map(n => [n.getName(), n]));
function center(n) {
  const m = new Matrix4().fromArray(n.getWorldMatrix());
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = lo.clone().negate(), v = new Vector3();
  for (const p of n.getMesh().listPrimitives()) {
    const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) { v.fromArray(a, i).applyMatrix4(m); lo.min(v); hi.max(v); }
  }
  return lo.add(hi).multiplyScalar(.5);
}
const shared = latest.getRoot().listNodes().filter(n => n.getMesh() && aliases.has(n.getName()) && nodes.has(aliases.get(n.getName()).id));
const anchors = shared.filter(n => /femur|vertebr|sacrum|trachea|pelvis/i.test(n.getName()));
if (anchors.length < 6) throw new Error('Too few registration landmarks');
const pairs = anchors.map(n => [center(n), center(nodes.get(aliases.get(n.getName()).id))]);
const mean = i => pairs.reduce((v, p) => v.add(p[i]), new Vector3()).multiplyScalar(1 / pairs.length);
const a = mean(0), b = mean(1);
let numerator = 0, denominator = 0;
for (const [x, y] of pairs) { numerator += x.clone().sub(a).dot(y.clone().sub(b)); denominator += x.distanceToSquared(a); }
const scale = numerator / denominator, offset = b.clone().sub(a.clone().multiplyScalar(scale));
const residuals = pairs.map(([x, y]) => x.clone().multiplyScalar(scale).add(offset).distanceTo(y));
const maxResidual = Math.max(...residuals);
console.log({ anchors: anchors.length, scale, offset: offset.toArray(), maxResidual });
if (!(scale > 0) || maxResidual > .005) throw new Error('Registration exceeds 5 mm: do not merge');
const incoming = new Document(), buffer = incoming.createBuffer(), scene = incoming.createScene();
const material = incoming.createMaterial().setBaseColorFactor([.65, .7, .75, 1]);
const additions = [];
for (const n of latest.getRoot().listNodes()) {
  const raw = n.getName();
  if (!n.getMesh() || aliases.has(raw) || !/^(VH_F_|Allen_)/.test(raw)) continue;
  let label = raw.replace(/^(VH_F_|Allen_)/, '').replace(/_L$/, ' left').replace(/_R$/, ' right').replaceAll('_', ' ').replace('ginviva', 'gingiva');
  label = label[0].toUpperCase() + label.slice(1);
  const id = 'hra10-' + raw.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  if (rows.some(r => r.id === id)) continue;
  const m = new Matrix4().fromArray(n.getWorldMatrix()), normalMatrix = new Matrix3().getNormalMatrix(m), v = new Vector3();
  const mesh = incoming.createMesh(id);
  for (const p of n.getMesh().listPrimitives()) {
    if (p.getMode() !== 4) throw new Error('Non-triangle source: ' + raw);
    const positions = p.getAttribute('POSITION').getArray().slice();
    for (let i = 0; i < positions.length; i += 3) v.fromArray(positions, i).applyMatrix4(m).multiplyScalar(scale).add(offset).toArray(positions, i);
    const prim = incoming.createPrimitive().setAttribute('POSITION', incoming.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)).setMaterial(material);
    const normals = p.getAttribute('NORMAL')?.getArray().slice();
    if (normals) { for (let i = 0; i < normals.length; i += 3) v.fromArray(normals, i).applyMatrix3(normalMatrix).normalize().toArray(normals, i); prim.setAttribute('NORMAL', incoming.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer)); }
    if (p.getIndices()) prim.setIndices(incoming.createAccessor().setType('SCALAR').setArray(p.getIndices().getArray().slice()).setBuffer(buffer));
    mesh.addPrimitive(prim);
  }
  scene.addChild(incoming.createNode(id).setMesh(mesh));
  const system = /nucleus pulposus|intervertebral disk/i.test(label) ? 'skeletal' : classifySystem(label, /Allen_/.test(raw) ? 'nervous' : 'digestive');
  additions.push({ id, name: label, system, region: /disk|pulposus/.test(label) ? 'back' : classifyRegion(label), sex: 'female', source: 'hra-v1.10', aliases: [raw] });
}
if (!additions.length) { console.log('HRA supplement already present'); process.exit(0); }
await MeshoptSimplifier.ready;
await incoming.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .65, error: .001 }), prune());
mergeDocuments(current, incoming);
const scenes = current.getRoot().listScenes();
for (const s of scenes.slice(1)) { for (const n of s.listChildren()) { s.removeChild(n); scenes[0].addChild(n); } s.dispose(); }
await current.transform(unpartition(), dedup(), prune(), draco());
const output = await io.writeBinary(current);
writeFileSync(masterPath, output);
writeFileSync(catalogPath, JSON.stringify([...rows, ...additions]));
writeFileSync('data/hra-supplement.json', JSON.stringify({ source: 'https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.10/assets/3d-vh-f-united.glb', license: 'CC BY 4.0', sha256: createHash('sha256').update(readFileSync(source)).digest('hex'), anchors: anchors.map(n => n.getName()), scale, offset: offset.toArray(), maxResidual, additions }, null, 2));
console.log('Added', additions.length, 'real meshes; existing catalog indices preserved. Run data:split.');
