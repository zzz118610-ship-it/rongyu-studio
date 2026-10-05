export const STORE = 'rongyu-studio-v1';
export const SERVICES = ['新娘跟妆', '新娘试妆', '日常妆造', '写真妆造', '宴会妆造'];
export const STATUSES = ['待确认', '已确认', '已完成', '已取消'];
export const HOLIDAYS = [
  {name:'春节',start:'2026-02-15',end:'2026-02-23'},
  {name:'清明节',start:'2026-04-04',end:'2026-04-06'},
  {name:'劳动节',start:'2026-05-01',end:'2026-05-05'},
  {name:'国庆节',start:'2026-10-01',end:'2026-10-07'}
];
export function escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function dateKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function validDate(s) { if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T12:00:00'); return !isNaN(d)&&dateKey(d)===s&&+s.slice(0,4)>=2000&&+s.slice(0,4)<=2100; }
export function minutes(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(s||'') ? +s.slice(0,2)*60 + +s.slice(3) : NaN; }
export function cents(value) { if(value===''||value==null)return 0; const s=String(value); if(!/^\d+(\.\d{1,2})?$/.test(s))throw Error('金额须为非负数字，最多保留两位小数'); const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||n>1e10)throw Error('金额超出范围');return n; }
export const total = b => b.price+b.travelFee;
export const paid = b => b.deposit+b.balancePaid;
export const remaining = b => Math.max(0,total(b)-paid(b));
export const active = b => b.status !== '已取消';
export const money = n => '¥'+(n/100).toLocaleString('zh-CN',{minimumFractionDigits:n%100?2:0,maximumFractionDigits:2});
export function holiday(date) { return HOLIDAYS.find(h=>date>=h.start&&date<=h.end); }
export function conflicts(b,bookings) { return active(b)?bookings.filter(x=>x.id!==b.id&&active(x)&&x.date===b.date&&minutes(x.start)<minutes(b.end)&&minutes(b.start)<minutes(x.end)):[]; }
function string(v,name,max,required=false) { if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error(`${name}格式不正确`);return v.trim(); }
export function validateBooking(b) {
  if(!b||typeof b!=='object')throw Error('预约记录无效');
  const result={id:string(b.id,'编号',100,true),clientName:string(b.clientName,'客户姓名',50,true),phone:string(b.phone??'','联系电话',30),date:b.date,start:b.start,end:b.end,service:string(b.service,'服务项目',50,true),address:string(b.address??'','地址',300),note:string(b.note??'','备注',1000),status:b.status,updatedAt:b.updatedAt};
  if(!validDate(b.date))throw Error('请选择有效日期（2000—2100年）');
  if(!Number.isFinite(minutes(b.start))||!Number.isFinite(minutes(b.end))||minutes(b.end)<=minutes(b.start))throw Error('结束时间须晚于开始时间（同一天）');
  if(result.phone&&!/^[+\d\s()-]{3,30}$/.test(result.phone))throw Error('联系电话格式不正确');
  if(!STATUSES.includes(b.status))throw Error('预约状态无效');
  for(const k of ['price','travelFee','deposit','balancePaid']){if(!Number.isSafeInteger(b[k])||b[k]<0||b[k]>1e10)throw Error('备份中的金额无效');result[k]=b[k];}
  if(paid(result)>total(result))throw Error('已收金额不能超过订单总额');
  if(typeof result.updatedAt!=='string'||!Number.isFinite(Date.parse(result.updatedAt)))throw Error('记录更新时间无效');
  return result;
}
export function freshState(){return {schema:'rongyu-studio',version:1,bookings:[],services:[...SERVICES],lastBackup:null};}
export function validateState(data) {
  if(!data||data.schema!=='rongyu-studio'||data.version!==1||!Array.isArray(data.bookings)||data.bookings.length>10000)throw Error('请使用荣予工作室导出的有效备份文件');
  const bookings=data.bookings.map(validateBooking);
  if(new Set(bookings.map(b=>b.id)).size!==bookings.length)throw Error('备份包含重复预约编号');
  if(!Array.isArray(data.services)||data.services.length<1||data.services.length>50)throw Error('服务项目数据无效');
  const services=[...new Set(data.services.map(s=>string(s,'服务项目',50,true)))];
  return {schema:'rongyu-studio',version:1,bookings,services,lastBackup:typeof data.lastBackup==='string'?data.lastBackup:null};
}
export function mergeStates(current,incoming) { const map=new Map(current.bookings.map(b=>[b.id,b]));for(const b of incoming.bookings){const old=map.get(b.id);if(!old||Date.parse(b.updatedAt)>Date.parse(old.updatedAt))map.set(b.id,b);}return validateState({...current,bookings:[...map.values()],services:[...new Set([...current.services,...incoming.services])]}); }
export function customerKey(b) { return b.phone.replace(/[\s()-]/g,'')||b.clientName; }
export function customers(bookings) { const map=new Map();for(const b of [...bookings].sort((a,b)=>b.date.localeCompare(a.date))){const k=customerKey(b);if(!map.has(k))map.set(k,{key:k,name:b.clientName,phone:b.phone,bookings:[]});map.get(k).bookings.push(b);}return [...map.values()]; }
