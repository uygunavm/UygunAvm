/* ============================================================
   UYGUN AVM TAKİP — Uygulama Mantığı
   Bağımlılık: config.js (GAS_URL, PATRON_PASSWORD, BREAK_LIMIT_MIN)
   ============================================================ */

// ── GLOBAL DEĞİŞKENLER ───────────────────────────────────────
let toastTimer       = null;
let currentEmployee  = '';
let patronRefreshTimer = null;
let workerTimers     = {};

// ── SAAT ──────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  document.getElementById('clock').textContent =
    now.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    + ' — ' + now.toLocaleTimeString('tr-TR');
}
updateClock();
setInterval(updateClock, 1000);

// ── ÇALIŞAN İSMİ ─────────────────────────────────────────────
function init() {
  const saved = localStorage.getItem('employeeName');
  if (saved && saved.trim()) {
    currentEmployee = saved.trim();
    document.getElementById('employeeDisplay').textContent = currentEmployee;
    loadHistory();
    show('mainApp');
  } else {
    show('setupScreen');
  }
}

function saveName() {
  const val = document.getElementById('nameInput').value.trim();
  if (!val) {
    shake(document.getElementById('nameInput'));
    return;
  }
  localStorage.setItem('employeeName', val);
  currentEmployee = val;
  document.getElementById('employeeDisplay').textContent = currentEmployee;
  show('mainApp');
}

function changeName() {
  document.getElementById('nameInput').value = currentEmployee;
  show('setupScreen');
  setTimeout(() => document.getElementById('nameInput').focus(), 100);
}

// ── GEÇMİŞ (localStorage) ────────────────────────────────────
function loadHistory() {
  const saved = localStorage.getItem('actionHistory');
  if (!saved) return;
  const items = JSON.parse(saved);
  const list  = document.getElementById('historyList');
  const empty = list.querySelector('.empty-state');
  if (empty && items.length > 0) empty.remove();

  items.forEach(({ icon, name, action, time, overBreak }) => {
    const item = document.createElement('div');
    item.className = 'history-item' + (overBreak ? ' over-break' : '');
    item.innerHTML = `
      <span class="history-icon">${icon}</span>
      <div class="history-info">
        <div class="history-name">${name}</div>
        <div class="history-action">${action}${overBreak ? ' — ⚠️ 15 dk aşıldı!' : ''}</div>
      </div>
      <div class="history-time">${time}</div>`;
    list.appendChild(item);
  });

  // Son işleme göre status dot'u güncelle
  if (items.length > 0) {
    const last   = items[0];
    const dotMap = {
      'İşe Başladı':  'green',
      'Molaya Çıktı': 'yellow',
      'Moladan Döndü':'green',
      'Mesaisi Bitti':'red'
    };
    const dot = document.getElementById('statusDot');
    if (dotMap[last.action]) dot.className = 'status-dot ' + dotMap[last.action];
  }
}

function addHistory(icon, name, action, time, overBreak = false) {
  const list  = document.getElementById('historyList');
  const empty = list.querySelector('.empty-state');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'history-item' + (overBreak ? ' over-break' : '');
  item.innerHTML = `
    <span class="history-icon">${icon}</span>
    <div class="history-info">
      <div class="history-name">${name}</div>
      <div class="history-action">${action}${overBreak ? ' — ⚠️ 15 dk aşıldı!' : ''}</div>
    </div>
    <div class="history-time">${time}</div>`;
  list.insertBefore(item, list.firstChild);
  while (list.children.length > 10) list.removeChild(list.lastChild);

  // localStorage'a kaydet
  const saved   = localStorage.getItem('actionHistory');
  const history = saved ? JSON.parse(saved) : [];
  history.unshift({ icon, name, action, time, overBreak });
  if (history.length > 10) history.pop();
  localStorage.setItem('actionHistory', JSON.stringify(history));
}

// ── ANA EYLEMLER ─────────────────────────────────────────────
async function sendAction(action, icon, dotColor) {
  if (!currentEmployee) {
    showToast('⚠️', 'Önce isminizi girin!', 'error');
    return;
  }

  const now       = new Date();
  const timestamp = now.toLocaleString('tr-TR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  // Mola aşımı tespiti: "Moladan Döndü" geliyorsa son "Molaya Çıktı" kaydını bul
  let overBreak = false;
  if (action === 'Moladan Döndü') {
    const saved = localStorage.getItem('actionHistory');
    if (saved) {
      const history = JSON.parse(saved);
      const lastBreak = history.find(h => h.action === 'Molaya Çıktı');
      if (lastBreak) {
        // "HH:MM" formatındaki time'dan dakika farkı hesapla
        const [hh, mm] = lastBreak.time.split(':').map(Number);
        const breakDate = new Date();
        breakDate.setHours(hh, mm, 0, 0);
        const diffMin = Math.floor((now - breakDate) / 60000);
        if (diffMin > BREAK_LIMIT_MIN) overBreak = true;
      }
    }
  }

  document.getElementById('statusDot').className = 'status-dot ' + dotColor;
  showToast('', '', 'loading', true);

  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employee: currentEmployee, action, timestamp })
    });
    addHistory(icon, currentEmployee, action,
      now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      overBreak);
    showToast('✅', `"${action}" kaydedildi!`, 'success');
  } catch (err) {
    showToast('❌', 'Bağlantı hatası!', 'error');
  }
}

// ── PATRON ŞİFRESİ ───────────────────────────────────────────
function openPasswordModal() {
  document.getElementById('passwordInput').value = '';
  document.getElementById('passwordModal').classList.add('show');
  setTimeout(() => document.getElementById('passwordInput').focus(), 200);
}

function closePasswordModal() {
  document.getElementById('passwordModal').classList.remove('show');
}

function checkPassword() {
  const val = document.getElementById('passwordInput').value;
  if (val === PATRON_PASSWORD) {
    closePasswordModal();
    openPatronPanel();
  } else {
    shake(document.getElementById('passwordInput'));
    document.getElementById('passwordInput').value = '';
    showToast('❌', 'Hatalı şifre!', 'error');
  }
}

// ── PATRON PANELİ ────────────────────────────────────────────
function openPatronPanel() {
  document.getElementById('mainApp').style.display    = 'none';
  document.getElementById('setupScreen').style.display = 'none';
  document.getElementById('patronPanel').style.display = 'block';
  loadPatronData();
  // Her 30 saniyede otomatik yenile
  patronRefreshTimer = setInterval(loadPatronData, 30000);
}

function exitPatron() {
  clearInterval(patronRefreshTimer);
  document.getElementById('patronPanel').style.display = 'none';
  init(); // tekrar isim kontrolü yap
}

async function loadPatronData() {
  document.getElementById('refreshInfo').textContent = 'Veriler güncelleniyor...';
  try {
    await fetch(GAS_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'getAll' })
    });
    // no-cors'ta response okunamaz — JSONP yaklaşımı kullanılıyor
    loadViaScript();
  } catch (err) {
    document.getElementById('refreshInfo').textContent = '⚠️ Veri alınamadı.';
  }
}

function loadViaScript() {
  const callbackName = 'gasCallback_' + Date.now();
  const script       = document.createElement('script');

  window[callbackName] = function(data) {
    document.getElementById('refreshInfo').textContent = '';
    try {
      renderWorkers(data);
      const now = new Date();
      document.getElementById('refreshInfo').textContent =
        `Son güncelleme: ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · 30 sn'de bir yenilenir`;
    } catch (e) {
      document.getElementById('refreshInfo').textContent = '⚠️ Veri işlenemedi.';
    }
    delete window[callbackName];
    script.remove();
  };

  script.onerror = function() {
    document.getElementById('refreshInfo').textContent =
      '⚠️ Veri alınamadı. GAS URL\'ini ve yayın ayarlarını kontrol edin.';
    delete window[callbackName];
    script.remove();
  };

  script.src = GAS_URL + '?callback=' + callbackName;
  document.head.appendChild(script);
}

function renderWorkers(rows) {
  allWorkerRows = rows; // detay modalı için sakla
  const latest = {};

  rows.forEach(row => {
    const [rawName, action, ts] = row;
    if (!rawName || rawName === '—' || !action || action === '—') return;

    // İsmi normalize et: trim + her kelimenin baş harfi büyük
    const name = rawName.trim().split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const parsedTime = parseTS(ts);
    if (!latest[name] || parsedTime > latest[name].time) {
      latest[name] = { action, ts, time: parsedTime };
    }
  });

  const list = document.getElementById('workerList');
  list.innerHTML = '';

  if (Object.keys(latest).length === 0) {
    list.innerHTML = '<div class="patron-empty">📭 Henüz kayıt yok</div>';
    return;
  }

  let working = 0, onBreak = 0, overLimit = 0;

  const sorted = Object.entries(latest).sort((a, b) => {
    const order = { 'Molaya Çıktı': 0, 'İşe Başladı': 1, 'Moladan Döndü': 1, 'Mesaisi Bitti': 2 };
    return (order[a[1].action] ?? 1) - (order[b[1].action] ?? 1);
  });

  sorted.forEach(([name, data]) => {
    const { action, time } = data;
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const diffMin  = Math.floor((Date.now() - time) / 60000);

    let cardClass   = 'worker-card';
    let statusText  = '';
    let timerText   = '';
    let alertBadge  = '';

    if (action === 'Molaya Çıktı') {
      const over = diffMin > BREAK_LIMIT_MIN;
      cardClass  += over ? ' over-limit' : ' on-break';
      statusText  = over
        ? `🔴 Molada — <b>${diffMin} dk</b>`
        : `🟡 Molada — ${diffMin} dk`;
      timerText = diffMin + ' dk';
      if (over) alertBadge = '<span class="alert-badge">AŞILDI</span>';
      if (over) overLimit++; else onBreak++;
    } else if (action === 'İşe Başladı' || action === 'Moladan Döndü') {
      cardClass  += ' working';
      statusText  = '🟢 Çalışıyor';
      working++;
    } else if (action === 'Mesaisi Bitti') {
      cardClass  += ' off';
      statusText  = '⚫ Mesai bitti';
    } else {
      cardClass  += ' off';
      statusText  = action;
    }

    const card = document.createElement('div');
    card.className = cardClass;
    card.innerHTML = `
      <div class="worker-avatar">${initials}</div>
      <div class="worker-info">
        <div class="worker-name">${name}${alertBadge}</div>
        <div class="worker-status">${statusText}</div>
      </div>
      ${timerText ? `<div class="worker-timer">${timerText}</div>` : ''}
    `;
    card.addEventListener('click', () => openWorkerDetail(name));
    list.appendChild(card);
  });

  document.getElementById('countWorking').textContent = working;
  document.getElementById('countBreak').textContent   = onBreak;
  document.getElementById('countAlert').textContent   = overLimit;
}

// ── ÇALIŞAN DETAY MODALİ ─────────────────────────────────────

// renderWorkers'dan gelen tüm ham satırları saklıyoruz
let allWorkerRows = [];

function openWorkerDetail(name) {
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('detailAvatar').textContent   = initials;
  document.getElementById('detailName').textContent     = name;
  document.getElementById('detailSubtitle').textContent = 'Bugünkü hareketler yükleniyor...';
  document.getElementById('detailTotalBreaks').textContent = '—';
  document.getElementById('detailOverBreaks').textContent  = '—';
  document.getElementById('detailTotalMoves').textContent  = '—';
  document.getElementById('detailLoading').style.display   = 'flex';
  document.getElementById('detailTimeline').style.display  = 'none';
  document.getElementById('detailTimeline').innerHTML      = '';
  document.getElementById('detailOverlay').classList.add('show');

  // Sheets'ten tüm veriyi yeniden çekip bu çalışanı filtrele
  loadWorkerDetailViaScript(name);
}

function closeDetailModal(event) {
  // Overlay'e tıklandıysa kapat; panel içine tıklandıysa kapatma
  if (event && event.target !== document.getElementById('detailOverlay')) return;
  document.getElementById('detailOverlay').classList.remove('show');
}

function loadWorkerDetailViaScript(targetName) {
  const callbackName = 'detailCallback_' + Date.now();
  const script       = document.createElement('script');

  window[callbackName] = function(data) {
    try {
      renderWorkerDetail(targetName, data);
    } catch (e) {
      document.getElementById('detailSubtitle').textContent = '⚠️ Veri işlenemedi.';
      document.getElementById('detailLoading').style.display = 'none';
    }
    delete window[callbackName];
    script.remove();
  };

  script.onerror = function() {
    document.getElementById('detailSubtitle').textContent = '⚠️ Veri alınamadı.';
    document.getElementById('detailLoading').style.display = 'none';
    delete window[callbackName];
    script.remove();
  };

  script.src = GAS_URL + '?callback=' + callbackName;
  document.head.appendChild(script);
}

function renderWorkerDetail(targetName, rows) {
  // Bugünün başlangıcı
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Bu çalışana ait, bugünkü tüm satırları topla
  const myRows = [];
  rows.forEach(row => {
    const [rawName, action, ts] = row;
    if (!rawName || rawName === '—' || !action || action === '—') return;

    const name = rawName.trim().split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    if (name !== targetName) return;

    const t = parseTS(ts);
    if (t < todayStart) return; // bugün değil

    myRows.push({ action, time: t, ts });
  });

  // Zamana göre sırala (eskiden yeniye)
  myRows.sort((a, b) => a.time - b.time);

  // İstatistikleri hesapla
  let totalBreaks = 0;
  let overBreaks  = 0;
  let pendingBreakTime = null;

  // Her "Molaya Çıktı" – "Moladan Döndü" / "Mesaisi Bitti" çiftini işle
  myRows.forEach(row => {
    if (row.action === 'Molaya Çıktı') {
      pendingBreakTime = row.time;
      totalBreaks++;
    } else if ((row.action === 'Moladan Döndü' || row.action === 'Mesaisi Bitti') && pendingBreakTime) {
      const diffMin = Math.floor((row.time - pendingBreakTime) / 60000);
      if (diffMin > BREAK_LIMIT_MIN) overBreaks++;
      pendingBreakTime = null;
    }
  });

  // Hâlâ molada mı? (kapanmamış mola)
  if (pendingBreakTime) {
    const diffMin = Math.floor((Date.now() - pendingBreakTime) / 60000);
    if (diffMin > BREAK_LIMIT_MIN) overBreaks++;
  }

  // İstatistik kutularını doldur
  document.getElementById('detailTotalBreaks').textContent = totalBreaks;
  document.getElementById('detailOverBreaks').textContent  = overBreaks;
  document.getElementById('detailTotalMoves').textContent  = myRows.length;

  // Aşım varsa kutuyu kırmızıya çevir
  const overBox = document.getElementById('detailOverStatBox');
  overBox.className = 'detail-stat ' + (overBreaks > 0 ? 'danger' : 'warn');

  document.getElementById('detailSubtitle').textContent =
    myRows.length > 0
      ? `Bugün ${myRows.length} hareket · ${totalBreaks} mola`
      : 'Bugün henüz kayıt yok';

  // Timeline'ı oluştur
  const timeline = document.getElementById('detailTimeline');
  timeline.innerHTML = '';

  if (myRows.length === 0) {
    timeline.innerHTML = '<div class="detail-loading" style="display:flex"><span>📭 Bugün henüz kayıt yok</span></div>';
    document.getElementById('detailLoading').style.display = 'none';
    timeline.style.display = 'flex';
    return;
  }

  // Her satırı render et; molalarda süre hesapla
  let lastBreakStart = null;
  myRows.forEach((row, i) => {
    const timeStr = row.time.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    let rowClass  = 'detail-row';
    let icon      = '⚪';
    let note      = '';
    let noteClass = '';

    if (row.action === 'İşe Başladı') {
      rowClass += ' row-start'; icon = '🟢';
    } else if (row.action === 'Molaya Çıktı') {
      rowClass += ' row-break'; icon = '🟡';
      lastBreakStart = row.time;
    } else if (row.action === 'Moladan Döndü') {
      if (lastBreakStart) {
        const diffMin = Math.floor((row.time - lastBreakStart) / 60000);
        const over    = diffMin > BREAK_LIMIT_MIN;
        rowClass += over ? ' row-over' : ' row-break-end';
        icon      = over ? '🔴' : '🔵';
        note      = `Mola süresi: ${diffMin} dk`;
        noteClass = over ? 'over' : '';
        lastBreakStart = null;
      } else {
        rowClass += ' row-break-end'; icon = '🔵';
      }
    } else if (row.action === 'Mesaisi Bitti') {
      rowClass += ' row-end'; icon = '🔴';
      if (lastBreakStart) {
        const diffMin = Math.floor((row.time - lastBreakStart) / 60000);
        note = `Mola kapanmadan mesai bitti (${diffMin} dk)`;
        noteClass = diffMin > BREAK_LIMIT_MIN ? 'over' : '';
        lastBreakStart = null;
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
      <div class="detail-row-time">${timeStr}</div>
    `;
    timeline.appendChild(el);
  });

  document.getElementById('detailLoading').style.display = 'none';
  timeline.style.display = 'flex';
}


// Sheets'ten gelen tüm formatları destekler
function parseTS(ts) {
  if (!ts) return new Date(0);
  if (ts instanceof Date) return ts;

  ts = String(ts).trim();
  if (!ts || ts === '—') return new Date(0);

  // Format 1: "24.04.2026 21:09:07"
  const m1 = ts.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})$/);
  if (m1) return new Date(+m1[3], +m1[2]-1, +m1[1], +m1[4], +m1[5], +m1[6]);

  // Format 2: "2026-04-24T21:09:07"
  const m2 = ts.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (m2) return new Date(+m2[1], +m2[2]-1, +m2[3], +m2[4], +m2[5], +m2[6]);

  // Format 3: "24.04.2026 21:09" (saniyesiz)
  const m3 = ts.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (m3) return new Date(+m3[3], +m3[2]-1, +m3[1], +m3[4], +m3[5], 0);

  // Fallback
  const d = new Date(ts);
  return isNaN(d) ? new Date(0) : d;
}

// ── YARDIMCI FONKSİYONLAR ─────────────────────────────────────
function show(id) {
  ['setupScreen', 'mainApp', 'patronPanel'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(id);
  if (target) target.style.display = id === 'setupScreen' ? 'flex' : 'block';
}

function isHidden(id) {
  const el = document.getElementById(id);
  return !el || el.style.display === 'none' || el.style.display === '';
}

function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth; // reflow tetikle
  el.classList.add('shake');
  el.style.borderColor = 'var(--red)';
  setTimeout(() => el.style.borderColor = '', 1500);
}

function showToast(icon, msg, type, isLoading = false) {
  clearTimeout(toastTimer);
  const toast = document.getElementById('toast');
  toast.className = 'toast ' + type;
  if (isLoading) {
    document.getElementById('toastIcon').innerHTML = '<div class="spinner"></div>';
    document.getElementById('toastMsg').textContent  = 'Gönderiliyor...';
  } else {
    document.getElementById('toastIcon').textContent = icon;
    document.getElementById('toastMsg').textContent  = msg;
  }
  toast.classList.add('show');
  if (!isLoading) toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ── KLAVYE KISA YOLLARI ───────────────────────────────────────
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') {
    if (!isHidden('setupScreen')) saveName();
    if (!isHidden('passwordModal') &&
        document.getElementById('passwordModal').classList.contains('show')) checkPassword();
  }
  if (e.key === 'Escape') {
    document.getElementById('detailOverlay').classList.remove('show');
    closePasswordModal();
  }
});

// ── UYGULAMAYI BAŞLAT ─────────────────────────────────────────
init();
