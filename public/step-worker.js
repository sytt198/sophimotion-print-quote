/* OCCT runs in a disposable worker; user models never leave the browser. */
importScripts('./vendor/occt-import-js.js');
self.onmessage=async({data})=>{
  try{
    const occt=await occtimportjs({locateFile:name=>new URL('./vendor/'+name,self.location.href).href});
    const result=occt.ReadStepFile(new Uint8Array(data),{linearUnit:'millimeter',linearDeflectionType:'bounding_box_ratio',linearDeflection:0.002,angularDeflection:0.5});
    if(!result.success||!result.meshes?.length)throw new Error('STEP 无可用实体，或文件格式不受支持');
    let triangles=0;
    const meshes=result.meshes.map(m=>{
      const positions=new Float32Array(m.attributes.position.array),indices=new Uint32Array(m.index.array);
      triangles+=indices.length/3;
      if(triangles>300000)throw new Error('模型超过 300,000 三角形，请简化后重试');
      return {positions,indices};
    });
    self.postMessage({meshes},meshes.flatMap(m=>[m.positions.buffer,m.indices.buffer]));
  }catch(error){self.postMessage({error:error.message||'STEP 解析失败'});}
};
