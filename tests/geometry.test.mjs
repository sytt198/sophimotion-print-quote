import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { analyzeGeometry } from '../src/geometry.js';
test('20mm cube is 8cm3 and 24cm2 with unit scaling',()=>{const g=new THREE.BoxGeometry(20,20,20).toNonIndexed();const a=analyzeGeometry([g]);assert.equal(a.closed,true);assert.ok(Math.abs(a.volume-8)<1e-9);assert.equal(a.area,24);assert.deepEqual(a.size,[20,20,20]);const s=analyzeGeometry([g],10);assert.ok(Math.abs(s.volume-8000)<1e-8);assert.equal(s.area,2400);});
test('open surface is not accepted as a solid',()=>{const g=new THREE.PlaneGeometry(10,10).toNonIndexed();assert.equal(analyzeGeometry([g]).closed,false);});
test('empty and nonfinite geometry rejected',()=>{assert.throws(()=>analyzeGeometry([new THREE.BufferGeometry()]));const g=new THREE.BoxGeometry();g.attributes.position.array[0]=Infinity;assert.throws(()=>analyzeGeometry([g]));});
