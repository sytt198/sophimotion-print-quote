import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';

export const MAX_TRIANGLES=300000;
export async function loadModel(file){
  if(!/\.(stl|step|stp)$/i.test(file.name))throw new Error('请选择 STL、STEP 或 STP 文件');
  if(!file.size)throw new Error('文件为空');
  if(file.size>50*1024*1024)throw new Error('单文件不能超过 50 MB');
  const data=await file.arrayBuffer();
  if(/\.stl$/i.test(file.name)){
    const geometry=new STLLoader().parse(data);
    if(geometry.attributes.position.count/3>MAX_TRIANGLES){geometry.dispose();throw new Error('模型超过 300,000 三角形，请简化后重试');}
    return [geometry];
  }
  return new Promise((resolve,reject)=>{
    const worker=new Worker(`${import.meta.env.BASE_URL}step-worker.js`);
    const timer=setTimeout(()=>{worker.terminate();reject(new Error('STEP 解析超过 90 秒，请简化模型后重试'));},90000);
    const finish=()=>{clearTimeout(timer);worker.terminate();};
    worker.onerror=()=>{finish();reject(new Error('STEP 解析器加载失败，请通过 HTTP 服务打开网页并确认 WASM 文件可用'));};
    worker.onmessage=({data})=>{
      finish();if(data.error){reject(new Error(data.error));return;}
      resolve(data.meshes.map(m=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(m.positions,3));g.setIndex(new THREE.BufferAttribute(m.indices,1));g.computeVertexNormals();return g;}));
    };
    worker.postMessage(data,[data]);
  });
}
export function demoGeometries(){
  const shape=new THREE.Shape();shape.absarc(0,0,38,0,Math.PI*2,false);
  const hole=new THREE.Path();hole.absarc(0,0,12,0,Math.PI*2,true);shape.holes.push(hole);
  for(let i=0;i<4;i++){const theta=i*Math.PI/2+Math.PI/4,h=new THREE.Path();h.absarc(Math.cos(theta)*28,Math.sin(theta)*28,4,0,Math.PI*2,true);shape.holes.push(h);}
  const base=new THREE.ExtrudeGeometry(shape,{depth:8,bevelEnabled:false,curveSegments:64});
  const top=new THREE.Shape();top.absarc(0,0,20,0,Math.PI*2,false);const inner=new THREE.Path();inner.absarc(0,0,12,0,Math.PI*2,true);top.holes.push(inner);
  const hub=new THREE.ExtrudeGeometry(top,{depth:20,bevelEnabled:false,curveSegments:64});hub.translate(0,0,8);
  return [base,hub];
}
export function createViewer(container){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,0.01,100000);
  let renderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});}catch{throw new Error('当前浏览器无法启用 WebGL。可继续分析和报价，请尝试 Chrome / Edge 或启用硬件加速。');}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);
  container.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','三维模型交互预览');
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=.01;
  scene.add(new THREE.HemisphereLight(0xffffff,0x7188ac,2.4));
  const key=new THREE.DirectionalLight(0xffffff,3.5);key.position.set(60,120,80);scene.add(key);
  const fill=new THREE.DirectionalLight(0xbdd5ff,2.5);fill.position.set(-70,50,-40);scene.add(fill);
  const group=new THREE.Group();group.rotation.x=-Math.PI/2;scene.add(group);
  const material=new THREE.MeshStandardMaterial({color:0x517be1,roughness:.35,metalness:.35,side:THREE.DoubleSide});
  const grid=new THREE.GridHelper(220,22,0xabb8cd,0xdce2ed);grid.material.transparent=true;grid.material.opacity=.38;scene.add(grid);
  let size=100,wire=false,view='iso',raf=0;
  const render=()=>{if(!raf)raf=requestAnimationFrame(()=>{raf=0;renderer.render(scene,camera);});};
  controls.addEventListener('change',render);
  const resize=()=>{const {width,height}=container.getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix();render();};
  const observer=new ResizeObserver(resize);observer.observe(container);
  function setView(v){view=v;const dir={iso:[1.25,.95,1.35],top:[.001,1,0],front:[0,.001,1],side:[1,.001,0]}[v];camera.position.fromArray(dir).normalize().multiplyScalar(size*2.4);camera.near=Math.max(size/10000,.0001);camera.far=size*100;camera.updateProjectionMatrix();controls.target.set(0,0,0);controls.update();render();}
  function show(geometries,scale=1){
    group.clear();group.position.set(0,0,0);group.scale.setScalar(1);
    for(const g of geometries)group.add(new THREE.Mesh(g,material));
    group.scale.setScalar(scale);group.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(group);if(!box.isEmpty()){
      const center=box.getCenter(new THREE.Vector3());group.position.sub(center);
      size=Math.max(box.getSize(new THREE.Vector3()).length(),.01);
      grid.position.y=-box.getSize(new THREE.Vector3()).y/2-.02*size;
      grid.scale.setScalar(size/130);controls.maxDistance=size*30;controls.minDistance=size*.05;
    }
    material.wireframe=wire;setView(view);
  }
  function theme(dark){material.color.setHex(dark?0x7098ff:0x517be1);grid.material.opacity=dark?.18:.38;render();}
  show([]);resize();
  return {show,fit:()=>setView(view),view:setView,wire:()=>{wire=!wire;material.wireframe=wire;render();return wire;},theme,dispose:()=>{observer.disconnect();controls.dispose();grid.geometry.dispose();grid.material.dispose();material.dispose();renderer.dispose();cancelAnimationFrame(raf);}};
}
