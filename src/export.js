import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const round=n=>Math.round((n+Number.EPSILON)*100)/100;
const money=n=>'¥'+n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmt=n=>n.toLocaleString('zh-CN',{maximumFractionDigits:2});
function safeName(name){return String(name||'SophiMotion-报价').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,100);}
function saveBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function styleSheet(ws,widths){
  ws.views=[{state:'frozen',ySplit:1}];
  widths.forEach((width,i)=>ws.getColumn(i+1).width=width);
  ws.getRow(1).height=30;ws.getRow(1).font={name:'微软雅黑',bold:true,color:{argb:'FFFFFFFF'},size:11};
  ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0057FF'}};
  ws.eachRow((row,n)=>{if(n!==1){row.font={name:'微软雅黑',size:10,color:{argb:'FF19202C'}};if(n%2===0)row.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF6F7F9'}};}row.alignment={vertical:'middle',wrapText:true};row.height=n===1?30:28;});
  ws.pageSetup={paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0};
  ws.headerFooter.oddFooter='SophiMotion | 第 &P 页 / 共 &N 页';
}
export async function buildWorkbook(data){
  const {items,totals:o,order}=data,wb=new ExcelJS.Workbook();wb.creator='SophiMotion';wb.created=new Date();
  const summary=wb.addWorksheet('报价汇总');summary.addRows([
    ['SophiMotion 报价汇总','内容 / 金额（人民币）'],['报价编号',data.quoteNo],['报价日期',data.date],['客户',data.customer],['有效期',data.validity],['预计交期',data.delivery],['状态',o.ready?'参数已填写，请人工复核':'估算草稿 / 含待确认项'],['零件未税金额',o.lines],['运费',order.shipping],['优惠',order.discount],['未税合计',o.subtotal],['税率 %',order.tax],['税额',o.tax],['含税总额',o.total],['内部基础成本',o.cost],['备注',data.notes||'无'],['使用说明','本文件含内部成本，请核对后分享；客户报价可使用 PDF。'],['估算依据','体积为三角化网格估算；材料由用户选择；耗材与机时最终以切片结果为准。']]);
  styleSheet(summary,[27,86]);for(const row of [8,9,10,11,13,14,15])summary.getCell(row,2).numFmt='"¥"#,##0.00';summary.getRow(14).font={name:'微软雅黑',bold:true,size:14,color:{argb:'FF0057FF'}};summary.getRow(16).height=65;summary.getRow(18).height=45;
  const detail=wb.addWorksheet('零件明细');detail.addRow(['零件','格式','工艺','材料','X mm','Y mm','Z mm','模型体积 cm³','表面积 cm²','单件耗材 g','单件耗材 ml','数量','整行机时 h','未税单价 ¥','未税行金额 ¥','状态']);
  for(const p of items)detail.addRow([p.name,p.demo?'示例':p.isStep?'STEP':'STL',p.process==='fdm'?'FDM 熔丝':'光固化',p.material,...p.stats.size.map(round),p.stats.orientationAmbiguous?'待确认':round(p.stats.volume),round(p.stats.area),round(p.r.weight),round(p.r.consumedVolume),p.quantity,p.hours===null&&p.rowHours===null?'待确认':round(p.r.rowHours),p.r.unit,p.r.sale,p.r.ready?'参数已填写':p.r.warnings.join('；')]);
  styleSheet(detail,[32,12,14,18,12,12,12,18,16,16,16,10,16,17,18,55]);detail.autoFilter={from:'A1',to:`P${items.length+1}`};for(const col of [14,15])detail.getColumn(col).numFmt='"¥"#,##0.00';detail.eachRow((r,i)=>{if(i>1)r.height=60;});
  const cost=wb.addWorksheet('成本明细');cost.addRow(['零件','数量','单件材料费 ¥','整行材料费 ¥','整行设备费 ¥','整行后处理 ¥','整行设置费 ¥','行基础成本 ¥','成本加价率 %','最低收费补差 ¥','未税行金额 ¥']);
  items.forEach(p=>cost.addRow([p.name,p.quantity,p.r.material,p.r.rowMaterial,p.r.machine,round(p.post*p.quantity),p.setup,p.r.cost,p.markup,p.r.minimumAdjustment,p.r.sale]));styleSheet(cost,[34,10,20,20,20,20,20,20,18,20,20]);for(const c of [3,4,5,6,7,8,10,11])cost.getColumn(c).numFmt='"¥"#,##0.00';
  const params=wb.addWorksheet('参数与估算依据');params.addRow(['零件','参数','数值','单位 / 说明']);
  const fields=[['density','材料密度','g/cm³，参考值须核对'],['price','材料单价','元/kg，参考值须核对'],['fill','内部填充率','%，仅 FDM'],['wall','等效壳厚','mm，壳体近似'],['support','单件支撑体积','cm³'],['loss','损耗率','%'],['hours','单件机时','h'],['rowHours','整行总机时覆盖','h，优先于单件机时'],['weightOverride','单件切片重量覆盖','g，含支撑与损耗'],['volumeOverride','确认实体体积覆盖','cm³'],['shellVolume','实际壳体积覆盖','cm³，仅空心树脂'],['hourRate','设备费率','元/h'],['post','单件后处理','元'],['setup','整行设置费','元'],['markup','成本加价率','%，不是毛利率'],['minimum','整行最低收费','元']];
  for(const p of items){params.addRow([p.name,'网格状态',p.stats.orientationAmbiguous?'多壳体朝向混合，体积待确认':p.stats.closed?'闭合':'待检查','闭合不代表没有自相交']);params.addRow([p.name,'树脂打印模式',p.hollow?'空心':'实心','仅光固化']);params.addRow([p.name,'材料与费率核对',p.confirmed?'已勾选确认':'待确认','示例值需按供应商核对']);for(const [key,label,unit]of fields)params.addRow([p.name,label,Number.isFinite(p[key])?p[key]:'未填写',unit]);params.addRow([p.name,'耗材依据',p.weightOverride!==null?'切片重量覆盖':'几何近似估算','实体 / 壳体 + 填充 + 支撑 + 损耗']);}
  params.addRow(['全部','公式','材料费=耗材g÷1000×元/kg；整行设备费=总机时×费率；行售价=max(成本×(1+加价率),最低收费)','金额按分取整']);params.addRow(['全部','几何边界','STEP 与 STL 均使用网格体积；多个实体相互重叠可能重复累计；开口网格需要人工覆盖','不是制造可行性验证']);styleSheet(params,[32,26,75,45]);
  return wb;
}
export async function downloadExcel(data){const wb=await buildWorkbook(data);const buffer=await wb.xlsx.writeBuffer();saveBlob(new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),safeName(data.quoteNo)+'.xlsx');}
function header(data){return `<img src="${import.meta.env.BASE_URL}assets/logo-blue.svg" alt="SophiMotion"><div class="pdf-title"><h1>3D 打印报价单</h1><span>QUOTATION</span></div><div class="pdf-meta"><div><b>客户：</b>${esc(data.customer)}</div><div><b>报价编号：</b>${esc(data.quoteNo)}</div><div><b>报价日期：</b>${esc(data.date)}</div><div><b>有效期至：</b>${esc(data.validity)}</div><div style="grid-column:1/-1"><b>预计交期：</b>${esc(data.delivery)}</div></div>`;}
function table(items){return `<table class="pdf-table"><colgroup><col style="width:37%"><col style="width:18%"><col style="width:10%"><col style="width:17%"><col style="width:18%"></colgroup><thead><tr><th>零件 / 材料</th><th>工艺</th><th>数量</th><th>未税单价</th><th>未税行金额</th></tr></thead><tbody>${items.map(p=>`<tr><td>${esc(p.name)}<small>${esc(p.material)} · ${fmt(p.r.weight)} g/件${p.demo?' · 示例':''}</small></td><td>${p.process==='fdm'?'FDM 熔丝':'光固化'}</td><td>${p.quantity}</td><td>${money(p.r.unit)}</td><td>${money(p.r.sale)}</td></tr>`).join('')}</tbody></table>`;}
function summary(data){const {totals:o,order}=data;return `<div class="pdf-summary"><div><span>零件未税金额</span><span>${money(o.lines)}</span></div><div><span>运费 / 优惠</span><span>${money(order.shipping)} / −${money(order.discount)}</span></div><div><span>未税合计</span><span>${money(o.subtotal)}</span></div><div><span>税额（${fmt(order.tax)}%）</span><span>${money(o.tax)}</span></div><div class="pdf-total"><span>含税总额</span><span>${money(o.total)}</span></div></div>`;}
export function renderQuote(data,container){
  const contents=[],chunks=[];for(let i=0;i<data.items.length;i+=5)chunks.push(data.items.slice(i,i+5));
  const draft=!data.totals.ready?'<div class="pdf-draft">估算草稿 / 含待确认参数。本单暂不作为最终承诺报价，请先确认材料、支撑用量与机时。</div>':'';
  chunks.forEach((items,i)=>{let body=table(items);if(i===chunks.length-1&&items.length<=2)body+=summary(data);contents.push(header(data)+draft+body);});
  if(chunks.at(-1).length>2)contents.push(header(data)+draft+'<h2 style="margin-top:32px">整单金额汇总</h2>'+summary(data));
  // Long notes use their own pages instead of slicing a table or a line of text.
  if(data.notes&&data.notes.length<=200)contents[contents.length-1]+=`<h3>报价备注</h3><p class="pdf-notes">${esc(data.notes)}</p>`;
  else if(data.notes){for(let i=0;i<data.notes.length;i+=500)contents.push(header(data)+`<h2 style="margin-top:32px">报价备注${i?'（续）':''}</h2><p class="pdf-notes">${esc(data.notes.slice(i,i+500))}</p>`);}
  const caution='<div class="pdf-disclaimer">耗材重量与模型体积为估算，最终用量以切片结果为准。模型文件无法可靠识别实际材料，材料由报价方选择并核对。单价展示四舍五入至分，整单以未税行金额之和计算；除特别注明外，币种为人民币 CNY。</div>';
  container.innerHTML=contents.map((html,i)=>`<article class="pdf-page">${html}${i===contents.length-1?caution:''}<div class="pdf-footer"><span>SophiMotion · 3D 打印报价</span><span>${i+1} / ${contents.length}</span></div></article>`).join('');
}
export async function downloadPdf(container,name){
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});pdf.setProperties({title:'SophiMotion 3D Print Quotation',author:'SophiMotion'});
  const pages=[...container.querySelectorAll('.pdf-page')];if(!pages.length)throw new Error('请先生成预览');
  await document.fonts.ready;
  for(let i=0;i<pages.length;i++){
    const canvas=await html2canvas(pages[i],{scale:2,backgroundColor:'#ffffff',logging:false,useCORS:true,windowWidth:1100});
    if(i)pdf.addPage();const width=210,height=canvas.height/canvas.width*width;
    const fittedWidth=height>297?width*297/height:width,fittedHeight=Math.min(height,297);
    pdf.addImage(canvas.toDataURL('image/jpeg',.94),'JPEG',(210-fittedWidth)/2,0,fittedWidth,fittedHeight,undefined,'FAST');
    canvas.width=0;canvas.height=0;
  }
  pdf.save(safeName(name)+'.pdf');
}
