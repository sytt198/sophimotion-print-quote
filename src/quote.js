const cents = n => Math.round((n + Number.EPSILON) * 100) / 100;
const supplied = n => n !== null && n !== undefined && n !== '';
function number(value, name, max = 1e12, min = 0) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name}超出有效范围`);
  return value;
}
export const materials = {
  fdm: [ ['PLA',1.24,80], ['PETG',1.27,95], ['ABS',1.04,90], ['ASA',1.07,130], ['TPU',1.21,180], ['PA 尼龙',1.14,240] ],
  resin: [ ['标准树脂',1.10,150], ['韧性树脂',1.12,260], ['耐高温树脂',1.15,450], ['可水洗树脂',1.10,190] ],
};
export function calculatePart(p) {
  const warnings=[];
  if (!['fdm','resin'].includes(p.process)) throw new Error('不支持的打印工艺');
  for(const k of ['volume','area','density','price','wall','hourRate','post','setup','markup','minimum']) number(p[k],k);
  if(p.density<=0)throw new Error('密度必须大于零');
  number(p.quantity,'数量',100000,1); if(!Number.isInteger(p.quantity))throw new Error('数量须为整数');
  number(p.fill,'填充率',100); number(p.loss,'损耗率',1000);
  for(const k of ['support','hours','rowHours','weightOverride','volumeOverride','shellVolume'])if(supplied(p[k]))number(p[k],k);
  const volume=supplied(p.volumeOverride)?p.volumeOverride:p.volume;
  const overridden=supplied(p.weightOverride);
  if(!p.closed&&!supplied(p.volumeOverride)&&!overridden)warnings.push('网格未闭合或朝向异常，请输入确认体积或切片重量');
  if(p.closed&&volume===0&&!overridden)warnings.push('未获得有效实体体积');
  if(!supplied(p.support)&&!overridden)warnings.push('请填写单件支撑体积；无支撑请明确填 0');
  if(!supplied(p.hours)&&!supplied(p.rowHours))warnings.push('请填写打印机时；可填写整行总机时');
  let printVolume=volume;
  const shell=Math.min(volume,p.area*p.wall/10);
  if(p.process==='fdm')printVolume=shell+(volume-shell)*p.fill/100;
  else if(p.hollow) {
    printVolume=supplied(p.shellVolume)?p.shellVolume:shell;
    if(!supplied(p.shellVolume)&&!overridden)warnings.push('空心树脂使用壳体近似，请用切片重量或实际壳体积确认');
  }
  const consumedVolume=(printVolume+(p.support??0))*(1+p.loss/100);
  const weight=overridden?p.weightOverride:consumedVolume*p.density;
  const rawMaterial=weight/1000*p.price,material=cents(rawMaterial),rowMaterial=cents(rawMaterial*p.quantity);
  const rowHours=supplied(p.rowHours)?p.rowHours:(p.hours??0)*p.quantity;
  const machine=cents(rowHours*p.hourRate);
  const cost=cents(rowMaterial+machine+p.post*p.quantity+p.setup);
  const beforeMinimum=cents(cost*(1+p.markup/100));
  const sale=cents(Math.max(beforeMinimum,p.minimum));
  return {weight,consumedVolume:weight/p.density,solidWeight:volume*p.density,printVolume,material,rowMaterial,machine,cost,sale,unit:cents(sale/p.quantity),rowHours,minimumAdjustment:cents(sale-beforeMinimum),warnings,ready:!warnings.length};
}
export function calculateOrder(rows,{shipping=0,discount=0,tax=0}={}) {
  number(shipping,'运费');number(discount,'优惠');number(tax,'税率',100);
  const lines=cents(rows.reduce((n,r)=>n+r.sale,0));
  if(discount>cents(lines+shipping))throw new Error('优惠不能大于未税金额与运费之和');
  const subtotal=cents(lines+shipping-discount), taxAmount=cents(subtotal*tax/100);
  return {lines,subtotal,tax:taxAmount,total:cents(subtotal+taxAmount),cost:cents(rows.reduce((n,r)=>n+r.cost,0)),weight:rows.reduce((n,r)=>n+r.weight,0),ready:rows.length>0&&rows.every(r=>r.ready)};
}
