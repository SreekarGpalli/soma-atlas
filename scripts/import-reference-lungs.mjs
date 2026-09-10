/** Import HRA male lung segments as an explicitly separate reference surface. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {mergeDocuments,unpartition,prune,draco} from '@gltf-transform/functions';
import {Box3,Matrix4,Matrix3,Vector3} from 'three';
import draco3d from 'draco3dgltf';
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'draco3d.decoder':await draco3d.createDecoderModule(),'draco3d.encoder':await draco3d.createEncoderModule()});
const rows=JSON.parse(readFileSync('src/data/catalog-male.json'));
if(rows.some(r=>r.id==='hra-male-lung-reference')) { console.log('Already imported'); process.exit(0); }
const sourceFile='data/raw/hra-male-v1.10.glb';
const source=await io.read(sourceFile), master=await io.read('public/models/male-body.glb');
const nodes=source.getRoot().listNodes().filter(n=>n.getMesh()&&/bronchopulmonary_segment/.test(n.getName()));
if(nodes.length!==20) throw new Error('Expected 20 source segments');
function bounds(list){const box=new Box3(),v=new Vector3();for(const n of list){const m=new Matrix4().fromArray(n.getWorldMatrix());for(const p of n.getMesh().listPrimitives()){const a=p.getAttribute('POSITION').getArray();for(let i=0;i<a.length;i+=3)box.expandByPoint(v.fromArray(a,i).applyMatrix4(m));}}return box;}
const old=master.getRoot().listNodes().filter(n=>n.getMesh()&&/lobe.*lung/.test(n.getName()));
const src=bounds(nodes), target=bounds(old), scale=target.getSize(new Vector3()).y/src.getSize(new Vector3()).y;
const offset=target.getCenter(new Vector3()).sub(src.getCenter(new Vector3()).multiplyScalar(scale));
const doc=new Document(), buffer=doc.createBuffer(), scene=doc.createScene(), mat=doc.createMaterial().setBaseColorFactor([.5,.75,.8,1]).setDoubleSided(true), added=[];
for(const n of nodes){const raw=n.getName(),id='hra-male-'+raw.replace(/^VH_M_/,'').replaceAll('_','-');const mesh=doc.createMesh(id),m=new Matrix4().fromArray(n.getWorldMatrix()),normal=new Matrix3().getNormalMatrix(m),v=new Vector3();
for(const p of n.getMesh().listPrimitives()) {const a=p.getAttribute('POSITION').getArray().slice();for(let i=0;i<a.length;i+=3)v.fromArray(a,i).applyMatrix4(m).multiplyScalar(scale).add(offset).toArray(a,i);const prim=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(a).setBuffer(buffer)).setMaterial(mat);const ns=p.getAttribute('NORMAL')?.getArray().slice();if(ns){for(let i=0;i<ns.length;i+=3)v.fromArray(ns,i).applyMatrix3(normal).normalize().toArray(ns,i);prim.setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(ns).setBuffer(buffer));}if(p.getIndices())prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(p.getIndices().getArray().slice()).setBuffer(buffer));mesh.addPrimitive(prim);}
scene.addChild(doc.createNode(id).setMesh(mesh));added.push({id,name:raw.replace(/^VH_M_/,'').replaceAll('_',' ').replace('posetrior','posterior')+' (HRA reference)',system:'respiratory',region:'thorax',sex:'male',source:'hra-male-v1.10',referenceOnly:true,aliases:[raw]});}
mergeDocuments(master,doc);const scenes=master.getRoot().listScenes();for(const s of scenes.slice(1)){for(const n of s.listChildren()){s.removeChild(n);scenes[0].addChild(n);}s.dispose();}
await master.transform(unpartition(),prune(),draco());
writeFileSync('public/models/male-body.glb',await io.writeBinary(master));
const indices=added.map((_,i)=>rows.length+i);
writeFileSync('src/data/catalog-male.json',JSON.stringify([...rows,...added,{id:'hra-male-lung-reference',name:'Lungs (HRA male reference)',system:'respiratory',region:'thorax',sex:'male',source:'hra-male-v1.10',referenceOnly:true,m:indices}]));
writeFileSync('data/hra-male-lungs.json',JSON.stringify({source:'https://cdn.humanatlas.io/digital-objects/ref-organ/united-male/v1.10/assets/3d-vh-m-united.glb',sha256:createHash('sha256').update(readFileSync(sourceFile)).digest('hex'),license:'CC BY 4.0',scale,offset:offset.toArray(),alignment:'Uniform height/centre fit for isolated display only. Different donor; not validated registration to BodyParts3D.',added},null,2));
console.log('Imported 20 reference lung segments; split and verify packs.');
