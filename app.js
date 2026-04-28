let currentEmployee = '';
let isPatron = false;
let toastTimer = null;
let patronRefreshTimer = null;
let allWorkerRows = [];
let liveTimerInterval = null;
let workerCardTimers ={};
let currentTab = 0;
let touchStartX = 0;
let isSending = false;
function updateClock(){
const now = new Date();
const el = document.getElementById('clock');
if (el) el.textContent =
now.toLocaleDateString('tr-TR',{weekday:'short', month:'short', day:'numeric'})
+ ' ' + now.toLocaleTimeString('tr-TR',{hour:'2-digit', minute:'2-digit'});
}
function checkIsPatron(name){
const norm = name.trim().toLowerCase();
return PATRON_NAMES.some(p => p.trim().toLowerCase()===norm);
}
function init(){
const shell = document.getElementById('appShell');
if (shell) shell.style.display = 'none';
updateClock();
setInterval(updateClock, 1000);
const saved = localStorage.getItem('employeeName');
if (saved&&saved.trim()){
currentEmployee = saved.trim();
isPatron = checkIsPatron(currentEmployee);
startApp();
}else{
document.getElementById('setupScreen').style.display = 'flex';
document.getElementById('mainApp').style.display = 'none';
}
}
function saveName(){
const val = document.getElementById('nameInput').value.trim();
if (!val){shake(document.getElementById('nameInput'));return;}
localStorage.setItem('employeeName', val);
currentEmployee = val;
isPatron = checkIsPatron(val);
startApp();
}
function changeName(){
document.getElementById('nameInput').value = currentEmployee;
document.getElementById('setupScreen').style.display = 'flex';
document.getElementById('mainApp').style.display = 'none';
setTimeout(() => document.getElementById('nameInput').focus(), 100);
}
function startApp(){
document.getElementById('setupScreen').style.display = 'none';
document.getElementById('mainApp').style.display = 'block';
const shortName = currentEmployee.split(' ')[0];
document.getElementById('tabNameShort').textContent = shortName;
document.getElementById('employeeDisplay').textContent = currentEmployee;
if (!isPatron){
document.getElementById('tabBtnPatron').style.display = 'none';
switchTab(1, true);
}else{
document.getElementById('tabBtnPatron').style.display = '';
switchTab(0, true);
startPatronRefresh();
}
loadHistory();
startLiveTimer();
}
function switchTab(index, instant = false){
currentTab = index;
const viewport = document.getElementById('tabViewport');
const pills = document.querySelectorAll('.tab-pill');
const indicator = document.getElementById('tabIndicator');
viewport.scrollTo({left: index * viewport.offsetWidth, behavior: instant ? 'instant' : 'smooth'});
pills.forEach((p, i) => p.classList.toggle('active', i===index));
const activePill = pills[index];
if (activePill){
indicator.style.width = activePill.offsetWidth + 'px';
indicator.style.transform = `translateX(${activePill.offsetLeft}px)`;
}
if (index===0&&isPatron) loadPatronData();
}
(function initSwipe(){
const vp = document.getElementById('tabViewport');
if (!vp) return;
vp.addEventListener('touchstart', e =>{touchStartX = e.touches[0].clientX;},{passive: true});
vp.addEventListener('touchend', e =>{
const diff = touchStartX - e.changedTouches[0].clientX;
if (Math.abs(diff) > 50) switchTab(diff > 0 ? 1 : 0);
});
})();
function startLiveTimer(){
clearInterval(liveTimerInterval);
liveTimerInterval = setInterval(updateLiveTimer, 1000);
updateLiveTimer();
}
function updateLiveTimer(){
const timerEl = document.getElementById('lastActionTimer');
if (!timerEl) return;
const saved = localStorage.getItem('actionHistory');
if (!saved){timerEl.style.display = 'none';return;}
const history = JSON.parse(saved);
const last = history[0];
const isMola = last&&(last.action==='Çay Molası'||last.action==='Yemek Molası');
if (!last||!isMola){timerEl.style.display = 'none';return;}
let base;
if (last.timeMs){
base = new Date(last.timeMs);
}else{
const [hh, mm] = last.time.split(':').map(Number);
base = new Date();
base.setHours(hh, mm, 0, 0);
}
const diffMs = Date.now() - base;
if (diffMs < 0){timerEl.style.display = 'none';return;}
const diffMin = Math.floor(diffMs / 60000);
const diffSec = Math.floor((diffMs % 60000) / 1000);
const limit = last.action==='Yemek Molası' ? LUNCH_LIMIT_MIN : BREAK_LIMIT_MIN;
const isOver = diffMin>=limit;
timerEl.style.display = 'inline-flex';
timerEl.textContent = `${diffMin}dk ${diffSec}s`;
timerEl.style.color = isOver ? 'var(--red)' : 'var(--yellow)';
timerEl.style.fontWeight = '700';
}
function loadHistory(){
const saved = localStorage.getItem('actionHistory');
if (!saved) return;
const items = JSON.parse(saved);
const list = document.getElementById('historyList');
const empty = list.querySelector('.empty-state');
if (empty&&items.length > 0) empty.remove();
items.forEach(({icon, name, action, time, overBreak, overBreakMsg}, idx) =>{
const warnText = overBreak ? ` — ⚠️ ${overBreakMsg||'Süre aşıldı!'}` : '';
const isMola = action==='Çay Molası'||action==='Yemek Molası';
const timerHtml = (idx===0&&isMola)
? `<span class="history-live-timer" id="lastActionTimer" style="display:none;margin-left:6px;font-size:12px;"></span>`
: '';
const item = document.createElement('div');
item.className = 'history-item' + (overBreak ? ' over-break' : '');
item.innerHTML = `
<span class="history-icon">${icon}</span>
<div class="history-info">
<div class="history-name">${name}</div>
<div class="history-action">${action}${warnText}${timerHtml}</div>
</div>
<div class="history-time">${time}</div>`;
list.appendChild(item);
});
if (items.length > 0){
const dotMap ={
'İşe Başladı':'green','Çay Molası':'yellow',
'Yemek Molası':'yellow','Moladan Döndü':'green','Mesaisi Bitti':'red'
};
const dot = document.getElementById('statusDot');
if (dot&&dotMap[items[0].action]) dot.className = 'status-dot ' + dotMap[items[0].action];
}
}
function addHistory(icon, name, action, time, overBreak = false, overBreakMsg = '', timeMs = null){
const list = document.getElementById('historyList');
const empty = list.querySelector('.empty-state');
if (empty) empty.remove();
const prevTimer = list.querySelector('#lastActionTimer');
if (prevTimer) prevTimer.remove();
const isMola = action==='Çay Molası'||action==='Yemek Molası';
const timerHtml = isMola
? `<span class="history-live-timer" id="lastActionTimer" style="display:none;margin-left:6px;font-size:12px;"></span>`
: '';
const warnText = overBreak ? ` — ⚠️ ${overBreakMsg||'Süre aşıldı!'}` : '';
const item = document.createElement('div');
item.className = 'history-item' + (overBreak ? ' over-break' : '');
item.innerHTML = `
<span class="history-icon">${icon}</span>
<div class="history-info">
<div class="history-name">${name}</div>
<div class="history-action">${action}${warnText}${timerHtml}</div>
</div>
<div class="history-time">${time}</div>`;
list.insertBefore(item, list.firstChild);
while (list.children.length > 10) list.removeChild(list.lastChild);
const saved = localStorage.getItem('actionHistory');
const history = saved ? JSON.parse(saved) : [];
history.unshift({icon, name, action, time, timeMs: timeMs||Date.now(), overBreak, overBreakMsg});
if (history.length > 10) history.pop();
localStorage.setItem('actionHistory', JSON.stringify(history));
}
const ALLOWED_NEXT ={
'İşe Başladı': new Set(['Çay Molası', 'Yemek Molası', 'Mesaisi Bitti']),
'Çay Molası': new Set(['Moladan Döndü']),
'Yemek Molası': new Set(['Moladan Döndü']),
'Moladan Döndü': new Set(['Çay Molası', 'Yemek Molası', 'Mesaisi Bitti']),
'Mesaisi Bitti': new Set(['İşe Başladı']),
};
const ACTION_ERROR_MSG ={
'İşe Başladı': 'Zaten çalışıyorsunuz, önce mola alın veya mesai bitirin!',
'Çay Molası': 'Önce moladan dönmelisiniz!',
'Yemek Molası': 'Önce moladan dönmelisiniz!',
'Moladan Döndü': 'Zaten çalışıyorsunuz!',
'Mesaisi Bitti': 'Önce işe başlamalınız!',
};
async function sendAction(action, icon, dotColor){
if (!currentEmployee){showToast('⚠️','Önce isminizi girin!','error');return;}
if (isSending) return;
const saved = localStorage.getItem('actionHistory');
if (saved){
const hist = JSON.parse(saved);
const lastAction = hist[0]?.action;
if (lastAction&&ALLOWED_NEXT[lastAction]&&!ALLOWED_NEXT[lastAction].has(action)){
const msg = ACTION_ERROR_MSG[lastAction]||'Geçersiz işlem sırası!';
showToast('⚠️', msg, 'error');
return;
}
}
isSending = true;
const now = new Date();
const timestamp = now.toLocaleString('tr-TR',{
year:'numeric', month:'2-digit', day:'2-digit',
hour:'2-digit', minute:'2-digit', second:'2-digit'
});
let overBreak = false, overBreakMsg = '';
if (action==='Moladan Döndü'){
const saved = localStorage.getItem('actionHistory');
if (saved){
const hist = JSON.parse(saved);
const lb = hist.find(h => h.action==='Çay Molası'||h.action==='Yemek Molası');
if (lb){
const breakStart = lb.timeMs ? new Date(lb.timeMs) : (() =>{
const [hh, mm] = lb.time.split(':').map(Number);
const d = new Date();d.setHours(hh, mm, 0, 0);return d;
})();
const diffMin = Math.floor((now - breakStart) / 60000);
const limit = lb.action==='Yemek Molası' ? LUNCH_LIMIT_MIN : BREAK_LIMIT_MIN;
if (diffMin > limit){overBreak = true;overBreakMsg = `${limit}dk aşıldı! (${diffMin}dk)`;}
}
}
}
const dot = document.getElementById('statusDot');
if (dot) dot.className = 'status-dot ' + dotColor;
showToast('','','loading', true);
const btns = document.querySelectorAll('.btn');
btns.forEach(b =>{b.disabled = true;b.classList.add('sending');});
try{
await fetch(GAS_URL,{
method:'POST', mode:'no-cors',
headers:{'Content-Type':'application/json'},
body: JSON.stringify({employee: currentEmployee, action, timestamp})
});
const timeStr = now.toLocaleTimeString('tr-TR',{hour:'2-digit', minute:'2-digit'});
addHistory(icon, currentEmployee, action, timeStr, overBreak, overBreakMsg, now.getTime());
showToast('\u2705', `"${action}" kaydedildi!`, 'success');
}catch (err){
showToast('\u274C','Bağlantı hatası!','error');
}finally{
setTimeout(() =>{
isSending = false;
btns.forEach(b =>{b.disabled = false;b.classList.remove('sending');});
}, 3000);
}
}
function startPatronRefresh(){
clearInterval(patronRefreshTimer);
patronRefreshTimer = setInterval(() =>{
if (currentTab===0) loadPatronData();
}, 60000);
}
function loadPatronData(){
document.getElementById('refreshInfo').textContent = 'Güncelleniyor...';
loadViaScript();
}
function loadViaScript(){
const cbName = 'gasCallback_' + Date.now();
const script = document.createElement('script');
window[cbName] = function(data){
allWorkerRows = data;
renderWorkers(data);
const now = new Date();
document.getElementById('refreshInfo').textContent =
`Son güncelleme: ${now.toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}· 60sn'de bir yenilenir`;
delete window[cbName];script.remove();
};
script.onerror = function(){
document.getElementById('refreshInfo').textContent = '⚠️ Veri alınamadı.';
delete window[cbName];script.remove();
};
script.src = GAS_URL + '?callback=' + cbName;
document.head.appendChild(script);
}
function renderWorkers(rows){
allWorkerRows = rows;
const latest ={};
rows.forEach(row =>{
const [rawName, action, ts] = row;
if (!rawName||rawName==='—'||!action||action==='—') return;
const name = normName(rawName);
const t = parseTS(ts);
if (!latest[name]||t > latest[name].time) latest[name] ={action, ts, time: t};
});
const list = document.getElementById('workerList');
list.innerHTML = '';
if (Object.keys(latest).length===0){
list.innerHTML = '<div class="patron-empty">📭 Henüz kayıt yok</div>';return;
}
Object.values(workerCardTimers).forEach(clearInterval);
workerCardTimers ={};
let working = 0, onBreak = 0, overLimit = 0;
const sorted = Object.entries(latest).sort((a, b) =>{
const o ={'Çay Molası':0,'Yemek Molası':0,'İşe Başladı':1,'Moladan Döndü':1,'Mesaisi Bitti':2};
return (o[a[1].action]??1) - (o[b[1].action]??1);
});
sorted.forEach(([name, data]) =>{
const{action, time}= data;
const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
const isMola = action==='Çay Molası'||action==='Yemek Molası';
const limit = action==='Yemek Molası' ? LUNCH_LIMIT_MIN : BREAK_LIMIT_MIN;
const diffMin = Math.floor((Date.now() - time) / 60000);
let cardClass = 'worker-card', statusText = '', timerText = '', alertBadge = '';
if (action==='Çay Molası'){
const over = diffMin > BREAK_LIMIT_MIN;
cardClass += over ? ' over-limit' : ' on-break';
statusText = over ? `🔴 Çay molasında — <b>${diffMin}dk</b>` : `🟡 Çay molasında — ${diffMin}dk`;
timerText = diffMin + ' dk';
if (over){alertBadge = '<span class="alert-badge">AŞILDI</span>';overLimit++;}else onBreak++;
}else if (action==='Yemek Molası'){
const over = diffMin > LUNCH_LIMIT_MIN;
cardClass += over ? ' over-limit' : ' on-break';
statusText = over ? `🔴 Yemek molasında — <b>${diffMin}dk</b>` : `🍽️ Yemek molasında — ${diffMin}dk`;
timerText = diffMin + ' dk';
if (over){alertBadge = '<span class="alert-badge">AŞILDI</span>';overLimit++;}else onBreak++;
}else if (action==='İşe Başladı'||action==='Moladan Döndü'){
cardClass += ' working';
statusText = '🟢 Çalışıyor';
working++;
}else if (action==='Mesaisi Bitti'){
cardClass += ' off';statusText = '⚫ Mesai bitti';
}else{
cardClass += ' off';statusText = action;
}
const card = document.createElement('div');
card.className = cardClass;
card.innerHTML = `
<div class="worker-avatar">${initials}</div>
<div class="worker-info">
<div class="worker-name">${name}${alertBadge}</div>
<div class="worker-status">${statusText}</div>
</div>
${isMola ? `<div class="worker-timer" id="wtimer-${initials}-${Date.now()}">${timerText}</div>` : ''}
`;
if (isMola){
const timerId = `wtimer-${initials}-${Date.now()}`;
const timerDiv = card.querySelector('.worker-timer');
const lim = action==='Yemek Molası' ? LUNCH_LIMIT_MIN : BREAK_LIMIT_MIN;
const interval = setInterval(() =>{
if (!timerDiv.isConnected){clearInterval(interval);return;}
const d = Math.floor((Date.now() - time) / 60000);
const s = Math.floor(((Date.now() - time) % 60000) / 1000);
timerDiv.textContent = `${d}dk ${s}s`;
if (d > lim) timerDiv.style.color = 'var(--red)';
}, 1000);
workerCardTimers[timerId] = interval;
}
card.addEventListener('click', () => openWorkerDetail(name));
list.appendChild(card);
});
document.getElementById('countWorking').textContent = working;
document.getElementById('countBreak').textContent = onBreak;
document.getElementById('countAlert').textContent = overLimit;
}
function openWorkerDetail(name){
const initials = name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
document.getElementById('detailAvatar').textContent = initials;
document.getElementById('detailName').textContent = name;
document.getElementById('detailSubtitle').textContent = 'Yükleniyor...';
document.getElementById('detailTotalBreaks').textContent = '—';
document.getElementById('detailOverBreaks').textContent = '—';
document.getElementById('detailTotalMoves').textContent = '—';
document.getElementById('detailLoading').style.display = 'flex';
document.getElementById('detailTimeline').style.display = 'none';
document.getElementById('detailTimeline').innerHTML = '';
document.getElementById('detailOverlay').classList.add('show');
loadWorkerDetailViaScript(name);
}
function closeDetailModal(event){
if (event&&event.target!==document.getElementById('detailOverlay')) return;
document.getElementById('detailOverlay').classList.remove('show');
}
function loadWorkerDetailViaScript(targetName){
const cbName = 'detailCallback_' + Date.now();
const script = document.createElement('script');
window[cbName] = function(data){
try{renderWorkerDetail(targetName, data);}
catch(e){
document.getElementById('detailSubtitle').textContent = '⚠️ Veri işlenemedi.';
document.getElementById('detailLoading').style.display = 'none';
}
delete window[cbName];script.remove();
};
script.onerror = function(){
document.getElementById('detailSubtitle').textContent = '⚠️ Veri alınamadı.';
document.getElementById('detailLoading').style.display = 'none';
delete window[cbName];script.remove();
};
script.src = GAS_URL + '?callback=' + cbName + '&type=log&name=' + encodeURIComponent(targetName);
document.head.appendChild(script);
}
function renderWorkerDetail(targetName, rows){
const todayStart = new Date();todayStart.setHours(0,0,0,0);
const myRows = [];
rows.forEach(row =>{
const [rawName, action, ts] = row;
if (!rawName||rawName==='—'||!action||action==='—') return;
const name = normName(rawName);
if (name!==targetName) return;
const t = parseTS(ts);
if (t < todayStart) return;
myRows.push({action, time: t});
});
myRows.sort((a, b) => a.time - b.time);
let totalBreaks = 0, overBreaks = 0, pendingTime = null, pendingLimit = BREAK_LIMIT_MIN;
myRows.forEach(row =>{
if (row.action==='Çay Molası'||row.action==='Yemek Molası'){
pendingTime = row.time;
pendingLimit = row.action==='Yemek Molası' ? LUNCH_LIMIT_MIN : BREAK_LIMIT_MIN;
totalBreaks++;
}else if ((row.action==='Moladan Döndü'||row.action==='Mesaisi Bitti')&&pendingTime){
if (Math.floor((row.time - pendingTime)/60000) > pendingLimit) overBreaks++;
pendingTime = null;pendingLimit = BREAK_LIMIT_MIN;
}
});
if (pendingTime&&Math.floor((Date.now() - pendingTime)/60000) > pendingLimit) overBreaks++;
document.getElementById('detailTotalBreaks').textContent = totalBreaks;
document.getElementById('detailOverBreaks').textContent = overBreaks;
document.getElementById('detailTotalMoves').textContent = myRows.length;
document.getElementById('detailOverStatBox').className = 'detail-stat ' + (overBreaks > 0 ? 'danger' : 'warn');
document.getElementById('detailSubtitle').textContent =
myRows.length > 0 ? `Bugün ${myRows.length}hareket · ${totalBreaks}mola` : 'Bugün henüz kayıt yok';
const timeline = document.getElementById('detailTimeline');
timeline.innerHTML = '';
if (myRows.length===0){
timeline.innerHTML = '<div class="detail-loading" style="display:flex"><span>📭 Bugün henüz kayıt yok</span></div>';
document.getElementById('detailLoading').style.display = 'none';
timeline.style.display = 'flex';
return;
}
let lastStart = null, lastLimit = BREAK_LIMIT_MIN;
myRows.forEach(row =>{
const timeStr = row.time.toLocaleTimeString('tr-TR',{hour:'2-digit', minute:'2-digit'});
let rowClass = 'detail-row', icon = '⚪', note = '', noteClass = '';
if (row.action==='İşe Başladı'){
rowClass += ' row-start';icon = '🟢';
}else if (row.action==='Çay Molası'){
rowClass += ' row-break';icon = '☕';lastStart = row.time;lastLimit = BREAK_LIMIT_MIN;
}else if (row.action==='Yemek Molası'){
rowClass += ' row-break';icon = '🍽️';lastStart = row.time;lastLimit = LUNCH_LIMIT_MIN;
}else if (row.action==='Moladan Döndü'){
if (lastStart){
const d = Math.floor((row.time - lastStart)/60000);
const over = d > lastLimit;
rowClass += over ? ' row-over' : ' row-break-end';
icon = over ? '🔴' : '🔵';
note = `Mola süresi: ${d}dk (limit: ${lastLimit}dk)`;
noteClass = over ? 'over' : '';
lastStart = null;
}else{rowClass += ' row-break-end';icon = '🔵';}
}else if (row.action==='Mesaisi Bitti'){
rowClass += ' row-end';icon = '🔴';
if (lastStart){
const d = Math.floor((row.time - lastStart)/60000);
note = `Mola kapanmadan mesai bitti (${d}dk)`;
noteClass = d > lastLimit ? 'over' : '';
lastStart = null;
}
}
const el = document.createElement('div');
el.className = rowClass;
el.innerHTML = `
<span class="detail-row-icon">${icon}</span>
<div class="detail-row-info">
<div class="detail-row-action">${row.action}</div>
${note ? `<div class="detail-row-note ${noteClass}">${note}</div>` : ''}
</div>
<div class="detail-row-time">${timeStr}</div>`;
timeline.appendChild(el);
});
document.getElementById('detailLoading').style.display = 'none';
timeline.style.display = 'flex';
}
function normName(raw){
return raw.trim().split(' ')
.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
.join(' ');
}
function parseTS(ts){
if (!ts) return new Date(0);
if (ts instanceof Date) return ts;
ts = String(ts).trim();
if (!ts||ts==='—') return new Date(0);
const m1 = ts.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
if (m1) return new Date(+m1[3],+m1[2]-1,+m1[1],+m1[4],+m1[5],+m1[6]);
const m2 = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
if (m2) return new Date(+m2[1],+m2[2]-1,+m2[3],+m2[4],+m2[5],+m2[6]);
const m3 = ts.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
if (m3) return new Date(+m3[3],+m3[2]-1,+m3[1],+m3[4],+m3[5],0);
const d = new Date(ts);
return isNaN(d) ? new Date(0) : d;
}
function shake(el){
el.classList.remove('shake');void el.offsetWidth;el.classList.add('shake');
el.style.borderColor = 'var(--red)';
setTimeout(() => el.style.borderColor = '', 1500);
}
function showToast(icon, msg, type, isLoading = false){
clearTimeout(toastTimer);
const toast = document.getElementById('toast');
toast.className = 'toast ' + type;
if (isLoading){
document.getElementById('toastIcon').innerHTML = '<div class="spinner"></div>';
document.getElementById('toastMsg').textContent = 'Gönderiliyor...';
}else{
document.getElementById('toastIcon').textContent = icon;
document.getElementById('toastMsg').textContent = msg;
}
toast.classList.add('show');
if (!isLoading) toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}
document.addEventListener('keydown', e =>{
if (e.key==='Enter'&&document.getElementById('setupScreen').style.display==='flex') saveName();
if (e.key==='Escape') document.getElementById('detailOverlay').classList.remove('show');
});
init();