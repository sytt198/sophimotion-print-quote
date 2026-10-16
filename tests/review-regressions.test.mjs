import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {calculatePart} from '../src/quote.js';
import {analyzeGeometry} from '../src/geometry.js';
test('small parts batch preserves subcent material costs until row rounding',()=>{
  const p={process:'fdm',volume:1,area:6,closed:true,quantity:10000,density:1.24,price:80,fill:20,wall:1,support:0,loss:0,hours:0,hourRate:0,post:0,setup:0,markup:0,minimum:0,weightOverride:.05};
  const r=calculatePart(p);assert.equal(r.rowMaterial,40);assert.equal(r.cost,40);assert.equal(r.sale,40);
  assert.equal(calculatePart({...p,minimum:40.555}).sale,40.56);
});
test('disconnected shells with mixed winding require volume confirmation',()=>{
  const a=new THREE.BoxGeometry(20,20,20).toNonIndexed(),b=new THREE.BoxGeometry(10,10,10).toNonIndexed();b.translate(50,0,0);
  const p=b.attributes.position;
  for(let i=0;i<p.count;i+=3){const u=new THREE.Vector3().fromBufferAttribute(p,i+1),v=new THREE.Vector3().fromBufferAttribute(p,i+2);p.setXYZ(i+1,v.x,v.y,v.z);p.setXYZ(i+2,u.x,u.y,u.z);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array([...a.attributes.position.array,...b.attributes.position.array]),3));
  const result=analyzeGeometry([g]);assert.equal(result.orientationAmbiguous,true);assert.equal(result.closed,false);assert.equal(result.volume,0);
});
