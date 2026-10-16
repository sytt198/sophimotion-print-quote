import {test} from 'node:test';
import assert from 'node:assert/strict';
import {calculatePart} from '../src/quote.js';
test('slicer weight supersedes hollow resin shell estimate',()=>{
  const p={process:'resin',volume:8,area:24,closed:true,quantity:1,density:1.1,price:150,fill:20,wall:1,support:null,loss:10,hours:1,hourRate:10,post:2,setup:0,markup:20,minimum:0,weightOverride:50,volumeOverride:null,hollow:true,shellVolume:null};
  const r=calculatePart(p);assert.equal(r.ready,true);assert.equal(r.weight,50);assert.equal(r.warnings.length,0);
});
