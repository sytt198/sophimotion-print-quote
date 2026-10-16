import { Box3, Vector3 } from 'three';
export function analyzeGeometry(geometries, scale=1) {
  if(!Number.isFinite(scale)||scale<=0)throw new Error('无效缩放');
  const box=new Box3(),a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3(),cross=new Vector3();
  let area=0,volume=0,triangles=0,badEdges=0,degenerate=0,orientationAmbiguous=false;
  for(const g of geometries){
    const p=g.getAttribute('position');if(!p||p.count<3)throw new Error('文件没有有效三角形');
    for(let i=0;i<p.count;i++){a.fromBufferAttribute(p,i);if(![a.x,a.y,a.z].every(Number.isFinite))throw new Error('模型包含无效坐标');box.expandByPoint(a);}
  }
  if(box.isEmpty())throw new Error('空模型');
  const origin=box.getCenter(new Vector3());
  const epsilon=Math.max(box.getSize(new Vector3()).length()*1e-7,1e-9);
  const key=v=>[v.x,v.y,v.z].map(x=>Math.round(x/epsilon)).join(',');
  for(const g of geometries){
    const edges=new Map(),parents=new Map(),records=[],p=g.getAttribute('position'),idx=g.index,count=idx?idx.count:p.count;let signed=0;
    const root=k=>{let r=k;while(parents.get(r)!==r)r=parents.get(r);while(k!==r){const next=parents.get(k);parents.set(k,r);k=next;}return r;};
    if(count%3)throw new Error('三角形索引不完整');
    for(let i=0;i<count;i+=3){
      a.fromBufferAttribute(p,idx?idx.getX(i):i).sub(origin);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).sub(origin);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).sub(origin);
      ab.subVectors(b,a);ac.subVectors(c,a);cross.crossVectors(ab,ac);const triangleArea=cross.length()/2;
      if(triangleArea<epsilon*epsilon){degenerate++;continue;}
      const contribution=a.dot(cross.crossVectors(b,c))/6;
      area+=triangleArea;signed+=contribution;triangles++;
      const keys=[key(a),key(b),key(c)];
      for(const k of keys)if(!parents.has(k))parents.set(k,k);
      for(let j=1;j<3;j++)parents.set(root(keys[j]),root(keys[0]));
      records.push([keys[0],contribution]);
      for(let e=0;e<3;e++){const x=keys[e],y=keys[(e+1)%3],k=x<y?x+'|'+y:y+'|'+x;const v=edges.get(k)||[0,0];v[0]++;v[1]+=x<y?1:-1;edges.set(k,v);}
    }
    for(const [count,orientation]of edges.values())if(count!==2||orientation!==0)badEdges++;
    const components=new Map();for(const [k,v] of records){const r=root(k);components.set(r,(components.get(r)||0)+v);}
    const values=[...components.values()],tolerance=Math.max(epsilon**3,1e-12);
    if(values.some(v=>v>tolerance)&&values.some(v=>v< -tolerance))orientationAmbiguous=true;
    volume+=Math.abs(signed);
  }
  if(!triangles)throw new Error('模型没有非退化三角形');
  const size=box.getSize(new Vector3()).multiplyScalar(scale).toArray();
  return {volume:orientationAmbiguous?0:volume*scale**3/1000,area:area*scale**2/100,size,triangles,closed:badEdges===0&&!orientationAmbiguous,badEdges,degenerate,orientationAmbiguous};
}
