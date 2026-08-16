window.initCronoApp = function(DATA){
  'use strict';

  const WINDOW_START = new Date(DATA.windowStart);
  const WINDOW_END = new Date(DATA.windowEnd);
  const WINDOW_MS = WINDOW_END - WINDOW_START;
  const MASTER = DATA.master
    ? { _start: new Date(DATA.master.start), _end: new Date(DATA.master.end) }
    : { _start: WINDOW_START, _end: WINDOW_END };

  const PALETTE = [
    '#F43F5E','#FB923C','#F59E0B','#EAB308','#84CC16','#22C55E','#10B981',
    '#14B8A6','#06B6D4','#0EA5E9','#3B82F6','#6366F1','#8B5CF6','#A855F7',
    '#D946EF','#EC4899','#F472B6','#0891B2','#EA580C'
  ];
  const colorFor = (idx) => PALETTE[idx % PALETTE.length];

  const TASK_PALETTE = [
    '#3B82F6', // Blue
    '#10B981', // Emerald
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#14B8A6', // Teal
    '#6366F1', // Indigo
    '#84CC16', // Lime
    '#D946EF', // Fuchsia
    '#0284C7', // Sky Blue
    '#E11D48', // Crimson Rose
    '#059669'  // Deep Mint
  ];

  function getTaskColor(t, taskIdx, catIdx) {
    const idx = ((taskIdx !== undefined ? taskIdx : 0) * 3 + ((catIdx || 0) * 5) + (t.id % 7)) % TASK_PALETTE.length;
    return TASK_PALETTE[idx];
  }

  const tasksByCat = {};
  DATA.categories.forEach(c => tasksByCat[c.id] = []);
  DATA.tasks.forEach(t => {
    t._start = new Date(t.start);
    t._end = new Date(t.end);
    tasksByCat[t.category].push(t);
  });
  const byId = {}; DATA.tasks.forEach(t => byId[t.id] = t);
  const OUTAGE_TASK = DATA.master && byId[7] ? byId[7] : null;
  const OUTAGE_START = OUTAGE_TASK ? OUTAGE_TASK._start : null;
  const OUTAGE_END = OUTAGE_TASK ? OUTAGE_TASK._end : null;

  function pct(d){
    return Math.max(0, Math.min(100, ((d - WINDOW_START) / WINDOW_MS) * 100));
  }
  function clampToWindow(d){
    if (d < WINDOW_START) return new Date(WINDOW_START);
    if (d > WINDOW_END) return new Date(WINDOW_END);
    return d;
  }
  function stateOf(t, now){
    if (t._end <= now) return 'done';
    if (t._start <= now) return 'active';
    return 'upcoming';
  }
  function fmtDayTime(d){
    const days = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${days[d.getDay()]} ${dd} · ${hh}:${mm}`;
  }
  function fmtTime(d){ return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }

  const DAY_NAMES = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  function buildDaySegments(){
    const segs = [];
    let cursor = new Date(WINDOW_START); cursor.setHours(0,0,0,0);
    while (cursor < WINDOW_END){
      const next = new Date(cursor.getTime() + 86400000);
      const segStart = cursor < WINDOW_START ? WINDOW_START : cursor;
      const segEnd = next > WINDOW_END ? WINDOW_END : next;
      segs.push({ label: DAY_NAMES[cursor.getDay()], date: cursor.getDate(), start: segStart, end: segEnd });
      cursor = next;
    }
    return segs;
  }
  const DAY_SEGMENTS = buildDaySegments();

  let scrubTime = clampToWindow(new Date());
  let autoFollow = true;
  let playing = false;
  let playTimer = null;
  let activeFilter = 'all';
  let searchQuery = '';
  const openCats = new Set();
  let viewMode = 'systems';

  const $ = id => document.getElementById(id);
  const sysRuler = $('sysRuler');
  const sysList = $('sysList');
  const boardEmpty = $('boardEmpty');
  const kpiActive = $('kpiActive'), kpiNext = $('kpiNext'), kpiDone = $('kpiDone'), kpiTotal = $('kpiTotal');
  const hdrLive = $('hdrLive'), liveLabel = $('liveLabel'), hdrClock = $('hdrClock');
  const summaryPhase = $('summaryPhase'), summaryPct = $('summaryPct'), summaryFill = $('summaryFill');
  const summaryFrom = $('summaryFrom'), summaryTo = $('summaryTo');
  const searchInput = $('searchInput');
  const filterChips = $('filterChips');
  const drawer = $('drawer'), drawerBackdrop = $('drawerBackdrop'), drawerClose = $('drawerClose');
  const viewToggle = $('viewToggle');
  const viewSystems = $('viewSystems');
  const viewAgenda = $('viewAgenda');
  const agendaEl = $('agenda');

  const scrubberBubbleDay = $('scrubberBubbleDay'), scrubberBubbleTime = $('scrubberBubbleTime');
  const scrubberDaysEl = $('scrubberDays');
  const scrubberTrack = $('scrubberTrack'), scrubberSegments = $('scrubberSegments');
  const scrubberTicks = $('scrubberTicks'), scrubberHandle = $('scrubberHandle');
  const btnPlay = $('btnPlay'), playIcon = $('playIcon'), btnLive = $('btnLive');

  const MIN_LABEL_PCT = 9;

  function buildSysRuler(){
    const month = document.createElement('div');
    month.className = 'sys-ruler-month';
    month.textContent = 'Agosto 2026';

    const track = document.createElement('div');
    track.className = 'sys-ruler-track';
    DAY_SEGMENTS.forEach((seg, i) => {
      const left = pct(seg.start);
      const width = pct(seg.end) - left;
      const el = document.createElement('div');
      el.className = 'sys-ruler-day';
      el.style.left = left + '%';
      el.style.width = width + '%';
      if (width >= MIN_LABEL_PCT){
        el.textContent = seg.label + ' ' + String(seg.date).padStart(2,'0');
      }
      track.appendChild(el);
    });
    sysRuler.innerHTML = '';
    sysRuler.appendChild(month);
    sysRuler.appendChild(track);
  }
  buildSysRuler();

  function buildScrubberChrome(){
    scrubberDaysEl.innerHTML = '';
    scrubberSegments.innerHTML = '';
    scrubberTicks.innerHTML = '';

    DAY_SEGMENTS.forEach((seg, i) => {
      const left = pct(seg.start);
      const width = pct(seg.end) - left;
      const center = left + width / 2;

      const segEl = document.createElement('div');
      segEl.className = 'scrubber-seg';
      segEl.style.left = left + '%';
      segEl.style.width = width + '%';
      scrubberSegments.appendChild(segEl);

      if (width < MIN_LABEL_PCT) return;

      const label = document.createElement('span');
      label.textContent = seg.label + ' ' + String(seg.date).padStart(2,'0');
      label.dataset.segIndex = i;
      const isFirst = i === 0;
      const isLast = i === DAY_SEGMENTS.length - 1;
      if (isFirst){ label.classList.add('align-start'); label.style.left = left + '%'; }
      else if (isLast){ label.classList.add('align-end'); label.style.left = (left + width) + '%'; }
      else { label.classList.add('align-center'); label.style.left = center + '%'; }
      scrubberDaysEl.appendChild(label);
    });

    let h = new Date(WINDOW_START); h.setMinutes(0,0,0);
    while (h < WINDOW_END){
      if (h.getHours() % 3 === 0){
        const tick = document.createElement('div');
        tick.className = 'scrubber-tick' + (h.getHours() % 12 === 0 ? ' major' : '');
        tick.style.left = pct(h) + '%';
        scrubberTicks.appendChild(tick);
      }
      h = new Date(h.getTime() + 3600000);
    }
  }
  buildScrubberChrome();

  function matchesSearch(t, cat){
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return t.name.toLowerCase().includes(q) || (t.om||'').toLowerCase().includes(q) ||
      (t.eps||'').toLowerCase().includes(q) || cat.label.toLowerCase().includes(q);
  }
  function matchesFilter(t, now){
    if (activeFilter === 'all') return true;
    if (activeFilter === 'soon'){
      const in2h = new Date(now.getTime() + 2*3600000);
      return stateOf(t, now) === 'upcoming' && t._start <= in2h;
    }
    return stateOf(t, now) === activeFilter;
  }

  function renderSystems(now){
    sysList.innerHTML = '';
    let anyVisible = false;

    DATA.categories.forEach((cat, idx) => {
      const all = tasksByCat[cat.id] || [];
      if (!all.length) return;
      const visible = all.filter(t => matchesSearch(t, cat) && matchesFilter(t, now));
      if (!visible.length) return;
      anyVisible = true;

      const color = colorFor(idx);
      const isOpen = openCats.has(cat.id) || !!searchQuery || activeFilter !== 'all';
      const activeCount = all.filter(t => stateOf(t, now) === 'active').length;
      const doneCount = all.filter(t => stateOf(t, now) === 'done').length;

      let badgeText, badgeClass;
      if (activeCount > 0){ badgeText = activeCount + ' en curso'; badgeClass = 'active'; }
      else if (doneCount === all.length){ badgeText = 'completado'; badgeClass = 'done'; }
      else { badgeText = all.length + ' pendientes'; badgeClass = 'upcoming'; }

      const card = document.createElement('div');
      card.className = 'sys-card' + (isOpen ? ' open' : '') + (activeCount > 0 ? ' has-active' : '');
      card.dataset.cat = cat.id;
      card.innerHTML = `
        <div class="sys-card-head">
          <div class="sys-icon">${cat.icon}</div>
          <div class="sys-title">
            <div class="name">${cat.label}</div>
            <div class="sub">${all.length} tarea${all.length>1?'s':''}</div>
          </div>
          <div class="sys-badge ${badgeClass}">${badgeText}</div>
          <svg class="sys-chev" viewBox="0 0 24 24" width="16" height="16"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="sys-bar-wrap"><div class="sys-bar"></div></div>
        <div class="sys-tasklist"></div>
      `;
      const barEl = card.querySelector('.sys-bar');
      DAY_SEGMENTS.slice(1).forEach(seg => {
        const div = document.createElement('div');
        div.className = 'sys-daydiv';
        div.style.left = pct(seg.start) + '%';
        barEl.appendChild(div);
      });
      all.forEach((t, tIdx) => {
        const s = stateOf(t, now);
        const tColor = getTaskColor(t, tIdx, idx);
        const seg = document.createElement('div');
        seg.className = 'sys-seg state-' + s + (t.isMilestone ? ' is-milestone' : '');
        const left = pct(t._start);
        const width = Math.max(1.8, pct(t._end) - left);
        seg.style.left = left + '%';
        seg.style.width = width + '%';
        seg.style.background = tColor;
        seg.title = `${t.name} (${fmtTime(t._start)}${t.isMilestone ? '' : ' - ' + fmtTime(t._end)})`;
        seg.addEventListener('click', (e) => {
          e.stopPropagation();
          openDrawer(t, scrubTime);
        });
        barEl.appendChild(seg);
      });
      const marker = document.createElement('div');
      marker.className = 'sys-now-marker';
      marker.style.left = pct(now) + '%';
      barEl.appendChild(marker);

      card.querySelector('.sys-card-head').addEventListener('click', () => {
        if (openCats.has(cat.id)) openCats.delete(cat.id); else openCats.add(cat.id);
        renderSystems(scrubTime);
      });

      const listEl = card.querySelector('.sys-tasklist');
      visible.slice().sort((a,b)=>a._start-b._start).forEach(t => {
        const s = stateOf(t, now);
        const tIdx = all.indexOf(t);
        const tColor = getTaskColor(t, tIdx, idx);
        const tagText = s==='active' ? 'En curso' : s==='upcoming' ? 'Próximo' : '✓ Listo';
        const row = document.createElement('div');
        row.className = 'sys-task state-' + s;
        row.innerHTML = `
          <div class="sys-task-dot" style="background:${tColor}; box-shadow: 0 0 0 2px ${tColor}33;"></div>
          <div class="sys-task-main">
            <div class="sys-task-name${s==='done'?' done':''}">${t.name}</div>
            <div class="sys-task-meta">${fmtTime(t._start)}${t.isMilestone?'':'–'+fmtTime(t._end)} · ${t.duration}${t.om?' · OM '+t.om:''}</div>
          </div>
          <div class="sys-task-chip ${s}">${tagText}</div>
        `;
        row.addEventListener('click', () => openDrawer(t, scrubTime));
        listEl.appendChild(row);
      });

      sysList.appendChild(card);
    });

    boardEmpty.hidden = anyVisible;
  }

  function dayKey(d){ return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  const dayNamesLong = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

  function renderAgenda(now){
    agendaEl.innerHTML = '';

    let items = [];
    DATA.categories.forEach((cat, idx) => {
      const all = tasksByCat[cat.id] || [];
      all.forEach((t, tIdx) => {
        if (!matchesSearch(t, cat) || !matchesFilter(t, now)) return;
        items.push({ t, cat, color: getTaskColor(t, tIdx, idx) });
      });
    });
    if (!items.length){ boardEmpty.hidden = false; return; }
    boardEmpty.hidden = true;
    items.sort((a,b) => a.t._start - b.t._start);

    const groups = new Map();
    items.forEach(item => {
      const k = dayKey(item.t._start);
      if (!groups.has(k)) groups.set(k, { date: item.t._start, items: [] });
      groups.get(k).items.push(item);
    });
    const sortedKeys = [...groups.keys()].sort((a,b) => groups.get(a).date - groups.get(b).date);

    sortedKeys.forEach(k => {
      const group = groups.get(k);
      const d = group.date;
      const isToday = dayKey(now) === k;

      const dayEl = document.createElement('div');
      dayEl.className = 'agenda-day';
      const activeInDay = group.items.filter(it => stateOf(it.t, now)==='active').length;
      dayEl.innerHTML = `
        <div class="agenda-day-header">
          <span class="agenda-day-name">${dayNamesLong[d.getDay()]} ${d.getDate()}</span>
          <span class="agenda-day-sub">agosto 2026${isToday ? ' · hoy' : ''}</span>
          <span class="agenda-day-count">${activeInDay > 0 ? activeInDay + ' en curso' : group.items.length + ' tareas'}</span>
        </div>
        <div class="agenda-list"></div>
      `;
      const listEl = dayEl.querySelector('.agenda-list');

      let nowInserted = false;
      group.items.forEach(item => {
        if (!nowInserted && isToday && item.t._start > now){
          listEl.appendChild(makeNowMarker(now));
          nowInserted = true;
        }
        listEl.appendChild(makeAgendaItem(item, now));
      });
      if (!nowInserted && isToday) listEl.appendChild(makeNowMarker(now));

      agendaEl.appendChild(dayEl);
    });
  }

  function makeNowMarker(now){
    const row = document.createElement('div');
    row.className = 'agenda-now';
    row.id = 'agendaNowMarker';
    row.innerHTML = `
      <div class="agenda-now-dot"><span></span></div>
      <div class="agenda-now-line"><span class="agenda-now-label">${fmtTime(now)}</span></div>
    `;
    return row;
  }

  function makeAgendaItem(item, now){
    const { t, cat, color } = item;
    const s = stateOf(t, now);
    const row = document.createElement('div');
    row.className = 'agenda-item';
    const tagText = s==='active' ? 'En curso' : s==='upcoming' ? 'Próximo' : '✓ Listo';
    const metaTags = [];
    if (t.om) metaTags.push(`<span class="agenda-tag">OM ${t.om}</span>`);
    if (t.eps) metaTags.push(`<span class="agenda-tag">${t.eps}</span>`);
    metaTags.push(`<span class="agenda-tag">${t.duration}</span>`);

    row.innerHTML = `
      <div class="agenda-time">
        <span class="t-start">${fmtTime(t._start)}</span>
        <span class="t-end">${t.isMilestone ? 'hito' : '– ' + fmtTime(t._end)}</span>
      </div>
      <div class="agenda-dot state-${s}" style="color:${color}"></div>
      <div class="agenda-card ${s==='active'?'is-active':''} ${s==='done'?'is-done':''}">
        <div class="agenda-card-top">
          <span class="agenda-cat-chip" style="background:${color}">${cat.icon} ${cat.label}</span>
          <span class="agenda-status-chip ${s}">${tagText}</span>
        </div>
        <div class="agenda-name-row">
          <div class="agenda-name">${t.name}</div>
          <button class="agenda-goto" aria-label="Ver en Sistemas" title="Ver en Sistemas">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <div class="agenda-meta">${metaTags.join('')}</div>
      </div>
    `;
    row.querySelector('.agenda-card').addEventListener('click', (e) => {
      if (e.target.closest('.agenda-goto')) return;
      openDrawer(t, now);
    });
    row.querySelector('.agenda-goto').addEventListener('click', (e) => {
      e.stopPropagation();
      goToSystem(cat.id);
    });
    return row;
  }

  function goToSystem(catId){
    viewMode = 'systems';
    [...viewToggle.children].forEach(c => c.classList.toggle('active', c.dataset.view === 'systems'));
    viewSystems.hidden = false;
    viewAgenda.hidden = true;
    openCats.add(catId);
    renderSystems(scrubTime);
    requestAnimationFrame(() => {
      const el = sysList.querySelector(`[data-cat="${catId}"]`);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 150;
      window.scrollTo({ top, behavior: 'smooth' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1400);
    });
  }

  function renderActiveView(now){
    if (viewMode === 'agenda') renderAgenda(now); else renderSystems(now);
  }

  viewToggle.addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    viewMode = btn.dataset.view;
    [...viewToggle.children].forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    viewSystems.hidden = viewMode !== 'systems';
    viewAgenda.hidden = viewMode !== 'agenda';
    renderActiveView(scrubTime);
    if (viewMode === 'agenda') requestAnimationFrame(() => scrollAgendaToNow(false));
  });

  function scrollAgendaToNow(smooth){
    const marker = $('agendaNowMarker');
    if (!marker) return;
    const top = marker.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }

  function openDrawer(t, now){
    const catIdx = DATA.categories.findIndex(c => c.id === t.category);
    const cat = DATA.categories[catIdx];
    const all = tasksByCat[t.category] || [];
    const tIdx = all.indexOf(t);
    const tColor = getTaskColor(t, tIdx, catIdx >= 0 ? catIdx : 0);

    $('drawerCat').textContent = cat ? (cat.icon + ' ' + cat.label) : '';
    $('drawerName').textContent = t.name;
    const s = stateOf(t, now);
    const stateEl = $('drawerState');
    stateEl.className = 'drawer-state ' + s;
    stateEl.textContent = s==='active' ? '⚡ En ejecución' : s==='upcoming' ? '⏳ Programado' : '✔ Completado';
    $('drawerWindow').textContent = `${fmtDayTime(t._start)} → ${fmtDayTime(t._end)}`;
    $('drawerDuration').textContent = t.duration;
    $('drawerOM').textContent = t.om || '—';
    $('drawerEPS').textContent = t.eps || '—';
    let progress = 0;
    if (s==='done') progress = 100;
    else if (s==='active') progress = Math.round(((now - t._start) / (t._end - t._start || 1)) * 100);
    const progressEl = $('drawerProgress');
    progressEl.style.width = progress + '%';
    progressEl.style.background = tColor;
    $('drawerPct').textContent = progress + '% avance';
    drawer.classList.add('show'); drawerBackdrop.classList.add('show');
  }
  function closeDrawer(){ drawer.classList.remove('show'); drawerBackdrop.classList.remove('show'); }
  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  const btnShare = $('btnShare');
  const shareDrawer = $('shareDrawer');
  const shareClose = $('shareClose');
  const shareUrlText = $('shareUrlText');
  const btnCopyLink = $('btnCopyLink');
  const btnShareWsp = $('btnShareWsp');
  const shareQr = $('shareQr');

  function currentShareUrl(){
    return window.location.origin + window.location.pathname + window.location.search;
  }

  function openShare(){
    const url = currentShareUrl();
    const display = url.replace(/^https?:\/\//, '');
    shareUrlText.textContent = display;
    const msg = 'Mira el cronograma en vivo: ' + url;
    btnShareWsp.href = 'https://wa.me/?text=' + encodeURIComponent(msg);
    shareQr.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url);
    btnCopyLink.textContent = 'Copiar';
    btnCopyLink.classList.remove('copied');
    refreshInstallUI();
    shareDrawer.classList.add('show');
    drawerBackdrop.classList.add('show');
  }
  function closeShare(){ shareDrawer.classList.remove('show'); drawerBackdrop.classList.remove('show'); }

  btnShare.addEventListener('click', openShare);
  shareClose.addEventListener('click', closeShare);
  drawerBackdrop.addEventListener('click', closeShare);

  btnCopyLink.addEventListener('click', async () => {
    const url = currentShareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = url; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    }
    btnCopyLink.textContent = '¡Copiado!';
    btnCopyLink.classList.add('copied');
    setTimeout(() => { btnCopyLink.textContent = 'Copiar'; btnCopyLink.classList.remove('copied'); }, 2000);
  });

  const btnInstall = $('btnInstall');
  const installHint = $('installHint');
  let deferredInstallPrompt = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

  function refreshInstallUI(){
    if (isStandalone()){
      btnInstall.hidden = true;
      installHint.hidden = false;
      installHint.textContent = '✓ Ya tienes CronoApp instalada en este dispositivo.';
      return;
    }
    if (deferredInstallPrompt){
      btnInstall.hidden = false;
      installHint.hidden = true;
      return;
    }
    if (isIOS()){
      btnInstall.hidden = true;
      installHint.hidden = false;
      installHint.textContent = 'En iPhone: toca el ícono compartir de Safari (⬆️) y elige "Añadir a pantalla de inicio".';
      return;
    }
    btnInstall.hidden = true;
    installHint.hidden = false;
    installHint.textContent = 'Abre el menú de tu navegador y elige "Añadir a pantalla de inicio" o "Instalar app".';
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    refreshInstallUI();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    refreshInstallUI();
  });

  btnInstall.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    refreshInstallUI();
  });

  function updateChrome(now){
    hdrClock.textContent = fmtTime(new Date());
    const in2h = new Date(now.getTime() + 2*3600000);
    let active=0, upcoming2h=0, done=0;
    DATA.tasks.forEach(t=>{
      const s = stateOf(t, now);
      if (s==='active') active++; else if (s==='done') done++;
      if (s==='upcoming' && t._start <= in2h) upcoming2h++;
    });
    kpiActive.textContent = active; kpiNext.textContent = upcoming2h;
    kpiDone.textContent = done; kpiTotal.textContent = DATA.tasks.length;

    let phase, hdrClass, label;
    if (now < WINDOW_START){
      const days = Math.ceil((WINDOW_START - now)/86400000);
      phase = 'Antes de iniciar'; hdrClass = 'state-soon'; label = `Inicia en ${days} día${days===1?'':'s'}`;
    } else if (OUTAGE_START && now < OUTAGE_START){
      phase = 'Preparación'; hdrClass = 'state-soon'; label = 'Trabajos previos';
    } else if (OUTAGE_START && OUTAGE_END && now < OUTAGE_END){
      phase = 'Corte total de energía'; hdrClass = 'state-outage'; label = 'Sin energía SF1 · SF2';
    } else if (now < MASTER._end){
      phase = OUTAGE_START ? 'Restableciendo energía' : 'En ejecución'; hdrClass = OUTAGE_START ? 'state-soon' : 'state-live'; label = OUTAGE_START ? 'Reenergizando' : 'En curso';
    } else {
      phase = 'Programa finalizado'; hdrClass = 'state-live'; label = 'Completado';
    }
    hdrLive.className = 'hdr-status ' + hdrClass;
    liveLabel.textContent = label + (autoFollow ? ' · en vivo' : '');

    const p = Math.max(0, Math.min(100, Math.round(((now-WINDOW_START)/WINDOW_MS)*100)));
    summaryPct.textContent = p + '%';
    summaryFill.style.width = p + '%';
    summaryPhase.textContent = phase;
    summaryPhase.className = 'summary-phase ' + (hdrClass==='state-outage' ? 'outage' : hdrClass==='state-soon' ? 'soon' : hdrClass==='state-live' ? 'live' : '');
    summaryFrom.textContent = fmtDayTime(MASTER._start);
    summaryTo.textContent = fmtDayTime(MASTER._end);
  }

  function updateScrubberUI(){
    const p = pct(scrubTime);
    scrubberHandle.style.left = p + '%';
    scrubberBubbleDay.textContent = DAY_NAMES[scrubTime.getDay()] + ' ' + String(scrubTime.getDate()).padStart(2,'0');
    scrubberBubbleTime.textContent = fmtTime(scrubTime);
    [...scrubberDaysEl.children].forEach(el => {
      const seg = DAY_SEGMENTS[+el.dataset.segIndex];
      el.classList.toggle('today', scrubTime >= seg.start && scrubTime < seg.end);
    });
  }

  function setScrubTime(t){
    scrubTime = clampToWindow(t);
    updateScrubberUI();
    updateChrome(scrubTime);
    renderActiveView(scrubTime);
  }

  function trackToTime(clientX){
    const rect = scrubberTrack.getBoundingClientRect();
    let f = (clientX - rect.left) / rect.width;
    f = Math.min(1, Math.max(0, f));
    return new Date(WINDOW_START.getTime() + f * WINDOW_MS);
  }

  // Scrubber al estilo "video slow-scrub" de iOS: por defecto el cursor sigue
  // el dedo 1:1 (cero retraso). Si el usuario desliza el dedo hacia abajo,
  // se activa un modo de precisión por tramos que reduce la velocidad para
  // ajustar minuto a minuto sin perder la sensación natural del arrastre.
  const SPEED_ZONES = [
    { dy: 0,  factor: 1,    label: '' },
    { dy: 26, factor: 0.35, label: 'PRECISO' },
    { dy: 68, factor: 0.08, label: 'MUY PRECISO' },
  ];
  function speedForDy(dy){
    let zone = SPEED_ZONES[0];
    for (const z of SPEED_ZONES) if (dy >= z.dy) zone = z;
    return zone;
  }

  const scrubberEl = $('scrubber');
  const scrubberSpeedTag = $('scrubberSpeedTag');
  let dragging = false;
  let dragTime = null;
  let lastX = 0;
  function onPointerDown(e){
    dragging = true; autoFollow = false; stopPlaying();
    scrubberEl.classList.add('is-dragging');
    const point = e.touches ? e.touches[0] : e;
    lastX = point.clientX;
    dragTime = trackToTime(point.clientX);
    setScrubTime(dragTime);
    e.preventDefault();
  }
  function onPointerMove(e){
    if (!dragging) return;
    const point = e.touches ? e.touches[0] : e;
    const rect = scrubberTrack.getBoundingClientRect();
    const dy = Math.max(0, point.clientY - rect.bottom);
    const zone = speedForDy(dy);
    const deltaPx = (point.clientX - lastX) * zone.factor;
    lastX = point.clientX;
    dragTime = clampToWindow(new Date(dragTime.getTime() + (deltaPx / rect.width) * WINDOW_MS));
    setScrubTime(dragTime);
    scrubberEl.classList.toggle('precision', !!zone.label);
    scrubberSpeedTag.textContent = zone.label;
  }
  function onPointerUp(){
    dragging = false;
    scrubberEl.classList.remove('is-dragging', 'precision');
    scrubberSpeedTag.textContent = '';
  }
  scrubberTrack.addEventListener('mousedown', onPointerDown);
  scrubberTrack.addEventListener('touchstart', onPointerDown, {passive:false});
  window.addEventListener('mousemove', onPointerMove);
  window.addEventListener('touchmove', onPointerMove, {passive:false});
  window.addEventListener('mouseup', onPointerUp);
  window.addEventListener('touchend', onPointerUp);

  function stopPlaying(){
    playing = false; clearInterval(playTimer);
    playIcon.innerHTML = '<path d="M8 5v14l11-7z" fill="currentColor"/>';
  }
  function startPlaying(){
    autoFollow = false; playing = true;
    playIcon.innerHTML = '<rect x="6" y="5" width="4" height="14" fill="currentColor"/><rect x="14" y="5" width="4" height="14" fill="currentColor"/>';
    playTimer = setInterval(() => {
      const advanceMs = 20 * 60000;
      let next = new Date(scrubTime.getTime() + advanceMs);
      if (next >= WINDOW_END){ next = WINDOW_END; stopPlaying(); }
      setScrubTime(next);
    }, 260);
  }
  btnPlay.addEventListener('click', () => {
    if (playing){ stopPlaying(); return; }
    autoFollow = false;
    setScrubTime(clampToWindow(new Date()));
    startPlaying();
  });

  btnLive.addEventListener('click', () => {
    stopPlaying(); autoFollow = true;
    setScrubTime(new Date());
  });

  const kpiStrip = $('kpiStrip');
  searchInput.addEventListener('input', e => { searchQuery = e.target.value.trim(); renderActiveView(scrubTime); });
  filterChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    [...filterChips.children].forEach(c => c.classList.remove('active'));
    btn.classList.add('active'); activeFilter = btn.dataset.filter;
    [...kpiStrip.children].forEach(c => c.classList.toggle('selected', c.dataset.kpi === activeFilter));
    renderActiveView(scrubTime);
  });

  function syncFilterChipsUI(){
    [...filterChips.children].forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter));
  }
  kpiStrip.addEventListener('click', e => {
    const btn = e.target.closest('.kpi'); if (!btn) return;
    activeFilter = btn.dataset.kpi;
    [...kpiStrip.children].forEach(c => c.classList.toggle('selected', c === btn));
    syncFilterChipsUI();
    renderActiveView(scrubTime);
    const target = viewMode === 'agenda' ? viewAgenda : viewSystems;
    const top = target.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  setInterval(() => {
    if (autoFollow && !playing){
      setScrubTime(new Date());
    } else {
      updateChrome(scrubTime);
    }
  }, 15000);

  const hdrEl = document.querySelector('.hdr');
  function syncHeaderHeight(){
    if (!hdrEl) return;
    document.documentElement.style.setProperty('--hdr-h', hdrEl.offsetHeight + 'px');
  }
  syncHeaderHeight();
  window.addEventListener('resize', syncHeaderHeight);
  window.addEventListener('load', syncHeaderHeight);
  if (window.ResizeObserver){
    new ResizeObserver(syncHeaderHeight).observe(hdrEl);
  }

  if (new Date() < WINDOW_START || new Date() > WINDOW_END) autoFollow = false;
  scrubTime = clampToWindow(new Date());

  DATA.categories.forEach(cat => {
    const all = tasksByCat[cat.id] || [];
    if (all.some(t => stateOf(t, scrubTime) === 'active')) openCats.add(cat.id);
  });

  updateScrubberUI();
  updateChrome(scrubTime);
  renderActiveView(scrubTime);
  syncHeaderHeight();
};
