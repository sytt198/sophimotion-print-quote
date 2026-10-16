import './style.css';
import { analyzeGeometry } from './geometry.js';
import { calculatePart, calculateOrder, materials } from './quote.js';
import { createViewer, loadModel, demoGeometries } from './viewer.js';

const $=id=>document.getElementById(id);
export const escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const esc=escapeHtml,fmt=(n,d=2)=>Number(n).toLocaleString('zh-CN',{minimumFractionDigits:d,maximumFractionDigits:d}),money=n=>'¥'+fmt(n);
const icons={upload:'M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5',sheet:'M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h8M11 10v9',document:'M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h5',box:'m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9M7 5l10 6',fit:'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[name]||icons.box}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el=>el.outerHTML=icon(el.dataset.icon));
let parts=[],selected=null,viewer=null,busy=false,exporter=null,toastTimer;
function notify(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,6500);}
function busyState(on,text='正在处理…'){busy=on;$('busy').hidden=!on;$('busyText').textContent=text;}
const today=new Date();const localDate=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
$('quoteNo').value='SM-'+localDate(today).replaceAll('-','')+'-001';
$('validity').value=localDate(new Date(today.getFullYear(),today.getMonth(),today.getDate()+15));
function isDark(){return document.documentElement.dataset.theme==='dark'||(!document.documentElement.dataset.theme&&matchMedia('(prefers-color-scheme:dark)').matches);}
function applyTheme(value){if(value==='system')delete document.documentElement.dataset.theme;else document.documentElement.dataset.theme=value;$('brand').src=`${import.meta.env.BASE_URL}assets/logo-${isDark()?'light':'blue'}.svg`;viewer?.theme(isDark());}
try{$('theme').value=localStorage.getItem('sm-theme')||'system';}catch{}
$('theme').addEventListener('change',()=>{applyTheme($('theme').value);try{localStorage.setItem('sm-theme',$('theme').value);}catch{}});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>applyTheme($('theme').value));applyTheme($('theme').value);
try{viewer=createViewer($('viewer'));viewer.theme(isDark());}catch(e){$('viewerError').hidden=false;$('viewerError').textContent=e.message;}
function current(){return parts.find(p=>p.id===selected);}
function newPart(name,geometries,isStep=false,demo=false){
  const stats=analyzeGeometry(geometries);
  return {id:crypto.randomUUID(),name,geometries,stats,isStep,demo,scale:1,process:'fdm',material:'PLA',quantity:1,density:1.24,price:80,fill:20,wall:1.2,support:demo?2:null,loss:8,hours:demo?2.4:null,rowHours:null,hourRate:12,post:3,setup:0,markup:30,minimum:0,weightOverride:null,volumeOverride:null,shellVolume:null,hollow:false,confirmed:false,printHeight:stats.size[2],layer:.05,exposure:3,lift:5};
}
function result(p){const r=calculatePart({...p,volume:p.stats.volume,area:p.stats.area,closed:p.stats.closed});if(!p.confirmed)r.warnings.push('请核对本零件材料密度、单价和加工费率');if(p.demo)r.warnings.push('示例零件与示例参数，仅用于演示');r.ready=!r.warnings.length;return r;}
function getOrder(){return {shipping:Number($('shipping').value||0),discount:Number($('discount').value||0),tax:Number($('tax').value||0)};}
function snapshot(){
  if(!parts.length)throw new Error('请先上传模型或载入示例');
  const items=parts.map(p=>{const {geometries,...rest}=p;return {...rest,r:result(p)};});
  const order=getOrder(),totals=calculateOrder(items.map(p=>p.r),order);
  return {items,order,totals,customer:$('customer').value.trim()||'待填写',quoteNo:$('quoteNo').value.trim()||'SM-QUOTE',validity:$('validity').value||'待确认',delivery:$('delivery').value.trim()||'待确认',notes:$('notes').value.trim(),date:localDate(new Date())};
}
function renderParts(){
  $('partCount').textContent=parts.length;
  $('parts').innerHTML=parts.map(p=>`<div class="part-item ${p.id===selected?'selected':''}"><button class="part-select" data-select="${p.id}" aria-pressed="${p.id===selected}">${icon('box')}<span class="part-text"><strong title="${esc(p.name)}">${esc(p.name)}</strong><small>${p.demo?'演示零件':p.isStep?'STEP':'STL'} · ${p.process==='fdm'?'FDM':'光固化'} · ${p.quantity} 件</small></span></button><button class="part-remove" data-remove="${p.id}" aria-label="移除 ${esc(p.name)}">×</button></div>`).join('');
}
function field(label,key,value,{wide=false,min=0,max,step='any',placeholder='',type='number'}={}){
  return `<label class="${wide?'wide':''}">${label}<input data-field="${key}" type="${type}" value="${value??''}" min="${min}" ${max!==undefined?`max="${max}"`:''} step="${step}" placeholder="${placeholder}"></label>`;
}
function renderSettings(){
  const p=current();document.querySelectorAll('[data-process]').forEach(b=>{b.classList.toggle('active',b.dataset.process===p?.process);b.disabled=!p;b.setAttribute('aria-pressed',b.dataset.process===p?.process);});
  if(!p){$('settings').innerHTML='<p class="settings-empty">上传模型后，在这里选择材料与工艺参数。</p>';return;}
  $('settings').innerHTML=`<div class="form-grid"><label class="wide">打印材料<select data-field="material">${materials[p.process].map(([name])=>`<option ${p.material===name?'selected':''}>${name}</option>`).join('')}</select></label>${field('材料密度 · g/cm³','density',p.density,{min:.01})}${field('材料单价 · 元/kg','price',p.price)}${field('数量 · 件','quantity',p.quantity,{min:1,max:100000,step:1})}${field('损耗率 · %','loss',p.loss,{max:1000})}</div><p class="field-help">材料库为参考值，密度和价格可直接修改，请按实际品牌与供应商核对。</p><div class="section-label">${p.process==='fdm'?'填充与壳体':'树脂与壳体'}</div><div class="form-grid">${p.process==='fdm'?field('内部填充率 · %','fill',p.fill,{max:100})+field('等效壳厚 · mm','wall',p.wall):`<label class="wide">打印模式<select data-field="hollow"><option value="false" ${!p.hollow?'selected':''}>实心打印</option><option value="true" ${p.hollow?'selected':''}>空心打印</option></select></label>${p.hollow?field('等效壳厚 · mm','wall',p.wall)+field('实际壳体积 · cm³','shellVolume',p.shellVolume,{placeholder:'留空为壳体近似'}):''}`}${field('单件支撑体积 · cm³','support',p.support,{placeholder:'无支撑请填 0'})}${field('单件机时 · h','hours',p.hours,{placeholder:'请输入或填写整行机时'})}</div><details id="slicerDetails"><summary>切片结果与人工覆盖</summary><div class="form-grid">${field('单件切片耗材重量 · g','weightOverride',p.weightOverride,{wide:true,placeholder:'留空使用几何估算'})}${field('整行总机时 · h（优先）','rowHours',p.rowHours,{wide:true,placeholder:'共板打印请填写此项'})}${field('确认实体体积 · cm³','volumeOverride',p.volumeOverride,{wide:true,placeholder:'用于修复网格分析或人工确认'})}</div><p class="field-help">切片重量包含支撑与损耗，不再重复叠加；整行机时不会再乘以数量。</p></details>${p.process==='resin'?`<details><summary>光固化机时参考计算</summary><div class="form-grid">${field('实际打印高度 · mm','printHeight',p.printHeight)}${field('层高 · mm','layer',p.layer,{min:.001})}${field('曝光时间 · 秒/层','exposure',p.exposure)}${field('抬升等耗时 · 秒/层','lift',p.lift)}</div><button id="resinTime" class="text-button" style="margin-top:12px">计算并填入整行机时 ↗</button><p class="field-help">按高度÷层高×每层耗时估算；未含底层额外曝光和设备准备，请核对实际摆放方向并按切片结果覆盖。</p></details>`:''}<details open><summary>加工与计价规则</summary><div class="form-grid">${field('设备机时费 · 元/h','hourRate',p.hourRate)}${field('单件后处理 · 元','post',p.post)}${field('整行设置费 · 元','setup',p.setup)}${field('成本加价率 · %','markup',p.markup)}${field('整行最低收费 · 元','minimum',p.minimum,{wide:true})}</div></details><label class="confirm-label"><input type="checkbox" id="confirmed" ${p.confirmed?'checked':''}>已核对本零件密度、单价与费率</label><div class="weight-result"><span>单件预计耗材${p.process==='resin'?'<br><small id="resinMl"></small>':''}</span><strong><span id="partWeight">—</span> <small>g</small></strong></div><p id="paramWarnings" class="param-warning"></p><p class="field-help">${p.process==='fdm'?'壳体 + 内部填充 + 支撑，计入损耗。等效壳厚模型不等同于实际切片。':'实体 / 壳体 + 支撑，计入损耗。实际用量与打印方向、排液孔和支撑有关。'}</p>`;
}
function renderGeometry(){
  const p=current();$('modelName').textContent=p?p.name:'模型预览';$('modelSub').textContent=p?`${p.demo?'示例模型 · ':''}${fmt(p.stats.triangles,0)} 个三角形 · 本地解析`:'上传模型，开始分析';
  $('modelTag').textContent=p?(p.demo?'DEMO':p.isStep?'STEP':'STL'):'THREE.JS';
  $('dimensions').textContent=p?p.stats.size.map(n=>fmt(n,1)).join(' × '):'—';$('volume').textContent=p?(p.stats.orientationAmbiguous?'待确认':fmt(p.stats.volume)):'—';$('area').textContent=p?fmt(p.stats.area):'—';
  $('meshStatus').textContent=p?(p.stats.orientationAmbiguous?'△ 多壳体朝向混合 · 请确认体积':p.stats.closed?'● 闭合网格 · 体积为估算':`△ 网格待检查 · ${p.stats.badEdges} 条异常边`):'等待模型';
  $('meshStatus').style.color=p?(p.stats.closed?'var(--sm-success)':'var(--sm-danger)'):'';$('unit').value=p?.scale||1;$('unit').disabled=!p||p.isStep||p.demo;
  viewer?.show(p?.geometries||[],p?.scale||1);
}
function updateQuote(){
  let allValid=true;const rows=[];
  $('quoteRows').innerHTML=parts.length?parts.map(p=>{
    try{const r=result(p);rows.push(r);return `<tr><td><span class="row-name">${esc(p.name)}</span><small>${esc(p.material)} · ${p.demo?'示例 · ':''}${r.ready?'参数已填写':'估算 / 待确认'}</small></td><td>${p.process==='fdm'?'FDM 熔丝':'光固化'}</td><td>${fmt(r.weight)} g${p.process==='resin'?`<small>${fmt(r.consumedVolume)} ml</small>`:''}</td><td>${p.quantity}</td><td>${p.hours===null&&p.rowHours===null?'待填写':fmt(r.rowHours)+' h'}</td><td>${money(r.unit)}</td><td>${money(r.sale)}</td></tr>`;}
    catch(e){allValid=false;return `<tr><td>${esc(p.name)}</td><td colspan="6" class="error-text">${esc(e.message)}</td></tr>`;}
  }).join(''):'<tr><td colspan="7" class="empty-row">上传模型，建立您的第一份报价。</td></tr>';
  try{
    if(!allValid)throw new Error('请修正零件参数后继续');const o=calculateOrder(rows,getOrder());$('linesTotal').textContent=money(o.lines);$('taxTotal').textContent=money(o.tax);const [whole,dec]=fmt(o.total).split('.');$('grandTotal').innerHTML=`¥${whole}<span>.${dec}</span>`;$('orderError').textContent='';$('quoteState').textContent=o.ready?'参数已填写 · 请复核后报价':'估算草稿 · 含待确认项';$('quoteState').classList.toggle('ready',o.ready);
  }catch(e){$('orderError').textContent=e.message;$('grandTotal').textContent='—';$('linesTotal').textContent='—';$('taxTotal').textContent='—';$('quoteState').textContent='参数需修正';$('quoteState').classList.remove('ready');}
  const p=current();if(p&&$('partWeight'))try{const r=result(p);$('partWeight').textContent=fmt(r.weight);if($('resinMl'))$('resinMl').textContent=fmt(r.consumedVolume)+' ml';$('paramWarnings').textContent=r.warnings.join('；');}catch(e){$('partWeight').textContent='—';$('paramWarnings').textContent=e.message;}
}
function render(){renderParts();renderSettings();renderGeometry();updateQuote();}
async function upload(files){
  if(busy)return;let added=0;const errors=[];
  for(const file of files){let geometries;
    try{if(parts.filter(p=>!p.demo).length>=30)throw new Error('每单最多 30 个模型');busyState(true,`正在解析 ${file.name}…`);await new Promise(r=>setTimeout(r,40));geometries=await loadModel(file);const p=newPart(file.name,geometries,/\.(step|stp)$/i.test(file.name));for(const demo of parts.filter(p=>p.demo))demo.geometries.forEach(g=>g.dispose());parts=parts.filter(p=>!p.demo);parts.push(p);selected=p.id;added++;}
    catch(e){geometries?.forEach(g=>g.dispose());errors.push(`${file.name}：${e.message}`);}finally{busyState(false);}
  }
  render();$('file').value='';if(errors.length)notify(errors.join('；'));else if(added)notify(`已添加 ${added} 个模型，请核对单位与报价参数`);
}
const pick=()=>{if(!busy)$('file').click();};$('upload').onclick=pick;$('addPart').onclick=pick;$('file').onchange=e=>upload([...e.target.files]);
$('upload').ondragover=e=>{e.preventDefault();$('upload').classList.add('dragging');};$('upload').ondragleave=()=>$('upload').classList.remove('dragging');$('upload').ondrop=e=>{e.preventDefault();$('upload').classList.remove('dragging');upload([...e.dataTransfer.files]);};
window.addEventListener('dragover',e=>e.preventDefault());window.addEventListener('drop',e=>e.preventDefault());
$('parts').onclick=e=>{const select=e.target.closest('[data-select]'),remove=e.target.closest('[data-remove]');if(select){selected=select.dataset.select;render();}if(remove){const id=remove.dataset.remove,p=parts.find(p=>p.id===id);parts=parts.filter(p=>p.id!==id);if(selected===id)selected=parts[0]?.id||null;render();p.geometries.forEach(g=>g.dispose());}};
$('demo').onclick=()=>{const old=parts.find(p=>p.demo);if(old){selected=old.id;render();return;}if(parts.length>=30){notify('每单最多 30 个模型');return;}const p=newPart('安装法兰 · 示例',demoGeometries(),false,true);parts.push(p);selected=p.id;render();};
document.querySelectorAll('[data-process]').forEach(b=>b.onclick=()=>{const p=current();if(!p||p.process===b.dataset.process)return;p.process=b.dataset.process;const m=materials[p.process][0];p.material=m[0];p.density=m[1];p.price=m[2];p.confirmed=false;renderParts();renderSettings();updateQuote();});
$('settings').addEventListener('input',e=>{
  const p=current();if(!p)return;if(e.target.id==='confirmed'){p.confirmed=e.target.checked;updateQuote();return;}
  const k=e.target.dataset.field;if(!k)return;
  if(k==='material'){const m=materials[p.process].find(m=>m[0]===e.target.value);[p.material,p.density,p.price]=m;p.confirmed=false;renderSettings();renderParts();}
  else if(k==='hollow'){p.hollow=e.target.value==='true';renderSettings();}
  else{p[k]=e.target.value===''?(['support','hours','rowHours','weightOverride','volumeOverride','shellVolume'].includes(k)?null:NaN):Number(e.target.value);if(['density','price','hourRate','post','setup','markup','minimum'].includes(k)){p.confirmed=false;if($('confirmed'))$('confirmed').checked=false;}if(k==='quantity')renderParts();}
  updateQuote();
});
$('settings').addEventListener('click',e=>{if(e.target.id!=='resinTime')return;const p=current();if(!p||!Number.isFinite(p.layer)||p.layer<=0||![p.printHeight,p.exposure,p.lift].every(n=>Number.isFinite(n)&&n>=0)){notify('请填写有效的高度、层高与每层耗时');return;}p.rowHours=Math.ceil(p.printHeight/p.layer)*(p.exposure+p.lift)/3600;renderSettings();$('settings').querySelector('#slicerDetails').open=true;updateQuote();notify('已填入整行参考机时，请核对底层与准备耗时');});
$('unit').onchange=()=>{const p=current();if(!p||p.isStep)return;try{p.scale=Number($('unit').value);p.stats=analyzeGeometry(p.geometries,p.scale);p.volumeOverride=null;p.shellVolume=null;p.weightOverride=null;p.confirmed=false;render();notify('单位已更新，人工覆盖值已清除，请重新确认工艺参数');}catch(e){notify(e.message);}};
$('fit').onclick=()=>viewer?.fit();$('wire').onclick=()=>$('wire').setAttribute('aria-pressed',viewer?.wire()||false);
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{viewer?.view(b.dataset.view);$('viewLabel').textContent=({iso:'透视视图',top:'顶部视图',front:'前方视图',side:'侧方视图'})[b.dataset.view];});
for(const id of ['shipping','discount','tax'])$(id).addEventListener('input',updateQuote);
async function getExporter(){return exporter??=await import('./export.js');}
$('excel').onclick=async()=>{try{const data=snapshot();busyState(true,'正在生成 Excel 报价明细…');await(await getExporter()).downloadExcel(data);notify('Excel 已生成，包含报价与内部成本明细');}catch(e){notify(e.message);}finally{busyState(false);}};
$('quotePreview').onclick=async()=>{try{const data=snapshot();busyState(true,'正在准备报价单…');(await getExporter()).renderQuote(data,$('previewPages'));$('previewDialog').showModal();}catch(e){notify(e.message);}finally{busyState(false);}};
$('downloadPdf').onclick=async()=>{const b=$('downloadPdf');try{b.disabled=true;b.textContent='正在生成…';await(await getExporter()).downloadPdf($('previewPages'),$('quoteNo').value);notify('PDF 报价单已生成');}catch(e){notify('PDF 生成失败：'+e.message);}finally{b.disabled=false;b.textContent='下载 PDF';}};
$('closePreview').onclick=()=>$('previewDialog').close();$('help').onclick=()=>$('helpDialog').showModal();$('closeHelp').onclick=()=>$('helpDialog').close();
render();$('demo').click();
