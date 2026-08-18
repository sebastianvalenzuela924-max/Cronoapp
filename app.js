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
    if (t.subtasks && t.subtasks.length){
      t.subtasks.forEach(st => {
        st._start = new Date(st.start);
        st._end = new Date(st.end);
      });
    }
    if (tasksByCat[t.category]) tasksByCat[t.category].push(t);
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
  // Estado global de un sistema: activo si tiene alguna tarea en curso,
  // completado si todas ya terminaron, próximo en el resto de los casos.
  // Se usa para el color de fondo de cada tarjeta en Sistemas.
  function categoryState(all, now){
    const activeCount = all.filter(t => stateOf(t, now) === 'active').length;
    const doneCount = all.filter(t => stateOf(t, now) === 'done').length;
    const state = activeCount > 0 ? 'active' : (doneCount === all.length ? 'done' : 'upcoming');
    return { state, activeCount, doneCount };
  }
  function fmtDayTime(d){
    const days = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
    const dd = String(d.getDate()).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mm = String(d.getMinutes()).padStart(2,'0');
    return `${days[d.getDay()]} ${dd} · ${hh}:${mm}`;
  }
  function fmtTime(d){ return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0'); }
  // Ventana de una tarea con día de inicio y, si difiere, día de término
  // (las tareas pueden cruzar la medianoche y durar más de un día).
  function fmtTaskWindow(t){
    const dayLabel = d => DAY_NAMES[d.getDay()] + ' ' + String(d.getDate()).padStart(2, '0');
    const startDay = dayLabel(t._start);
    if (t.isMilestone) return startDay + ' · ' + fmtTime(t._start);
    const endDay = dayLabel(t._end);
    if (startDay === endDay) return startDay + ' · ' + fmtTime(t._start) + '–' + fmtTime(t._end);
    return startDay + ' ' + fmtTime(t._start) + ' → ' + endDay + ' ' + fmtTime(t._end);
  }

  // Cuenta regresiva en días/horas/minutos (sin segundos) para saber cuánto
  // falta para que una tarea comience o termine, relativa al scrubTime.
  function fmtCountdown(ms){
    if (ms <= 0) return null;
    const totalMin = Math.floor(ms / 60000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const mins = totalMin % 60;
    const parts = [];
    if (days > 0) parts.push(days + 'd');
    if (days > 0 || hours > 0) parts.push(hours + 'h');
    parts.push(mins + 'm');
    return parts.join(' ');
  }
  function countdownInfo(t, now){
    const s = stateOf(t, now);
    if (s === 'upcoming'){
      const txt = fmtCountdown(t._start - now);
      return txt ? { text: 'Comienza en ' + txt, kind: 'upcoming' } : null;
    }
    if (s === 'active'){
      const txt = fmtCountdown(t._end - now);
      return txt ? { text: 'Termina en ' + txt, kind: 'active' } : null;
    }
    return null;
  }

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
  let agendaCategoryFilter = 'all';
  let sysCategoryFilter = 'all';
  const openCats = new Set();
  const expandedTasks = new Set();
  let viewMode = 'systems';

  const $ = id => document.getElementById(id);
  const sysRuler = $('sysRuler');
  const sysList = $('sysList');
  const boardEmpty = $('boardEmpty');
  const kpiActive = $('kpiActive'), kpiNext = $('kpiNext'), kpiDone = $('kpiDone'), kpiTotal = $('kpiTotal');
  const hdrLive = $('hdrLive'), liveLabel = $('liveLabel');
  const summaryPhase = $('summaryPhase'), summaryPct = $('summaryPct'), summaryFill = $('summaryFill');
  const summaryFrom = $('summaryFrom'), summaryTo = $('summaryTo');
  const searchInput = $('searchInput');
  const searchClear = $('searchClear');
  const filterChips = $('filterChips');
  const drawer = $('drawer'), drawerBackdrop = $('drawerBackdrop'), drawerClose = $('drawerClose');
  const viewToggle = $('viewToggle');
  const viewSystems = $('viewSystems');
  const agendaEl = $('agenda');
  const btnToggleAllSys = $('btnToggleAllSys');
  const btnToggleAllOverview = $('btnToggleAllOverview');
  let selectedEpsFilter = 'all';

  function autoExpandFiltered(now){
    openCats.clear();
    overviewOpenCats.clear();
    DATA.categories.forEach(cat => {
      const all = tasksByCat[cat.id] || [];
      const hasMatch = all.some(t => matchesEps(t) && matchesFilter(t, now));
      if (hasMatch){
        openCats.add(cat.id);
        overviewOpenCats.add(cat.id);
      }
    });
  }

  function updateToggleAllBtn(){
    if (!btnToggleAllSys) return;
    const visibleCats = DATA.categories.filter(cat => {
      const all = tasksByCat[cat.id] || [];
      return (sysCategoryFilter === 'all' || cat.id === sysCategoryFilter) &&
             all.some(t => matchesSearch(t, cat) && matchesFilter(t, scrubTime));
    });
    const allOpen = visibleCats.length > 0 && visibleCats.every(c => openCats.has(c.id));
    const txt = btnToggleAllSys.querySelector('.toggle-all-text');
    if (txt) txt.textContent = allOpen ? 'Minimizar' : 'Desplegar';
    btnToggleAllSys.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
    btnToggleAllSys.classList.toggle('active', allOpen);
  }

  if (btnToggleAllSys){
    btnToggleAllSys.addEventListener('click', () => {
      const visibleCats = DATA.categories.filter(cat => {
        const all = tasksByCat[cat.id] || [];
        return (sysCategoryFilter === 'all' || cat.id === sysCategoryFilter) &&
               all.some(t => matchesSearch(t, cat) && matchesFilter(t, scrubTime));
      });
      const allOpen = visibleCats.length > 0 && visibleCats.every(c => openCats.has(c.id));
      if (allOpen){
        visibleCats.forEach(c => openCats.delete(c.id));
      } else {
        visibleCats.forEach(c => openCats.add(c.id));
      }
      renderSystems(scrubTime);
      updateToggleAllBtn();
    });
  }

  function updateToggleAllOverviewBtn(){
    if (!btnToggleAllOverview) return;
    const visibleCats = DATA.categories.filter(cat => {
      const all = tasksByCat[cat.id] || [];
      return all.some(t => matchesEps(t) && matchesFilter(t, scrubTime));
    });
    const allOpen = visibleCats.length > 0 && visibleCats.every(c => overviewOpenCats.has(c.id));
    const txt = btnToggleAllOverview.querySelector('.toggle-all-text');
    if (txt) txt.textContent = allOpen ? 'Minimizar' : 'Desplegar';
    btnToggleAllOverview.setAttribute('aria-expanded', allOpen ? 'true' : 'false');
    btnToggleAllOverview.classList.toggle('active', allOpen);
  }

  if (btnToggleAllOverview){
    btnToggleAllOverview.addEventListener('click', () => {
      const visibleCats = DATA.categories.filter(cat => {
        const all = tasksByCat[cat.id] || [];
        return all.some(t => matchesEps(t) && matchesFilter(t, scrubTime));
      });
      const allOpen = visibleCats.length > 0 && visibleCats.every(c => overviewOpenCats.has(c.id));
      if (allOpen){
        visibleCats.forEach(c => overviewOpenCats.delete(c.id));
      } else {
        visibleCats.forEach(c => overviewOpenCats.add(c.id));
      }
      renderOverview(scrubTime);
      updateToggleAllOverviewBtn();
    });
  }

  function getUniqueEpsList(){
    const map = new Map();
    DATA.tasks.forEach(t => {
      const raw = (t.eps || '').trim();
      const name = raw ? raw : 'Interno / Planta';
      if (!map.has(name)){
        map.set(name, { name, raw, count: 0, tasks: [] });
      }
      const item = map.get(name);
      item.count++;
      item.tasks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  function matchesEps(t){
    if (selectedEpsFilter === 'all') return true;
    const raw = (t.eps || '').trim();
    const name = raw ? raw : 'Interno / Planta';
    return name === selectedEpsFilter;
  }

  function updateEpsLabels(){
    const labelText = selectedEpsFilter === 'all' ? 'Todas las empresas' : `👷 ${selectedEpsFilter}`;
    if ($('sysEpsFilterLabel')) $('sysEpsFilterLabel').textContent = labelText;
    if ($('agendaEpsFilterLabel')) $('agendaEpsFilterLabel').textContent = labelText;
    if ($('overviewEpsFilterLabel')) $('overviewEpsFilterLabel').textContent = labelText;
    if ($('sysEpsFilterBtn')) $('sysEpsFilterBtn').classList.toggle('filtered', selectedEpsFilter !== 'all');
    if ($('agendaEpsFilterBtn')) $('agendaEpsFilterBtn').classList.toggle('filtered', selectedEpsFilter !== 'all');
    if ($('overviewEpsFilterBtn')) $('overviewEpsFilterBtn').classList.toggle('filtered', selectedEpsFilter !== 'all');
  }

  // Filtro de sistema (dropdown propio, en vez de <select> nativo, para
  // combinar con la estética de la app). Se usa tanto en Agenda como en
  // Sistemas, cada uno con su propio botón/panel pero la misma lógica.
  function buildFilterOption(id, icon, label, count, isSelected){
    const opt = document.createElement('div');
    opt.className = 'agenda-filter-option' + (isSelected ? ' selected' : '');
    opt.setAttribute('role', 'option');
    opt.dataset.value = id;
    opt.innerHTML = `<span class="opt-icon">${icon}</span><span class="opt-label">${label}</span><span class="opt-count">${count}</span>`;
    return opt;
  }
  const filterControls = [];
  function setupCategoryFilter(btn, label, panel, getValue, onSelect){
    function renderPanel(){
      const current = getValue();
      panel.innerHTML = '';
      panel.appendChild(buildFilterOption('all', '🗂️', 'Todos los sistemas', DATA.tasks.length, current === 'all'));
      DATA.categories.forEach(cat => {
        const all = tasksByCat[cat.id] || [];
        if (!all.length) return;
        panel.appendChild(buildFilterOption(cat.id, cat.icon, cat.label, all.length, current === cat.id));
      });
    }
    function close(){
      panel.hidden = true;
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open(){
      filterControls.forEach(c => { if (c.close !== close) c.close(); });
      panel.hidden = false;
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });
    panel.addEventListener('click', (e) => {
      const opt = e.target.closest('.agenda-filter-option');
      if (!opt) return;
      const value = opt.dataset.value;
      const cat = DATA.categories.find(c => c.id === value);
      label.textContent = cat ? (cat.icon + ' ' + cat.label) : 'Todos los sistemas';
      btn.classList.toggle('filtered', value !== 'all');
      onSelect(value);
      renderPanel();
      close();
      renderActiveView(scrubTime);
    });
    renderPanel();
    const control = { renderPanel, close };
    filterControls.push(control);
    return control;
  }

  function setupEpsFilter(btn, label, panel){
    if (!btn || !label || !panel) return null;
    function renderPanel(){
      panel.innerHTML = '';
      const epsList = getUniqueEpsList();
      const isAll = selectedEpsFilter === 'all';
      
      const allOpt = document.createElement('div');
      allOpt.className = 'agenda-filter-option' + (isAll ? ' selected' : '');
      allOpt.setAttribute('role', 'option');
      allOpt.dataset.value = 'all';
      allOpt.innerHTML = `<span class="opt-icon">👷</span><span class="opt-label">Todas las empresas</span><span class="opt-count">${DATA.tasks.length}</span>`;
      panel.appendChild(allOpt);

      epsList.forEach(eps => {
        const isSelected = selectedEpsFilter === eps.name;
        const opt = document.createElement('div');
        opt.className = 'agenda-filter-option' + (isSelected ? ' selected' : '');
        opt.setAttribute('role', 'option');
        opt.dataset.value = eps.name;
        const icon = eps.name === 'Interno / Planta' ? '⚡' : '🏢';
        const activeCount = eps.tasks.filter(t => stateOf(t, scrubTime) === 'active').length;
        const countText = activeCount > 0 ? `${eps.count} (${activeCount} en curso)` : `${eps.count}`;
        opt.innerHTML = `<span class="opt-icon">${icon}</span><span class="opt-label">${eps.name}</span><span class="opt-count">${countText}</span>`;
        panel.appendChild(opt);
      });
    }

    function close(){
      panel.hidden = true;
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
    function open(){
      filterControls.forEach(c => { if (c.close !== close) c.close(); });
      renderPanel();
      panel.hidden = false;
      btn.classList.add('open');
      btn.setAttribute('aria-expanded', 'true');
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (panel.hidden) open(); else close();
    });

    panel.addEventListener('click', (e) => {
      const opt = e.target.closest('.agenda-filter-option');
      if (!opt) return;
      selectedEpsFilter = opt.dataset.value;
      if (selectedEpsFilter !== 'all'){
        autoExpandFiltered(scrubTime);
      }
      updateEpsLabels();
      updateChrome(scrubTime);
      filterControls.forEach(c => c.renderPanel && c.renderPanel());
      close();
      renderActiveView(scrubTime);
      if (overviewOpen) renderOverview(scrubTime);
      updateToggleAllBtn();
      updateToggleAllOverviewBtn();
    });

    renderPanel();
    const control = { renderPanel, close };
    filterControls.push(control);
    return control;
  }

  setupCategoryFilter($('agendaFilterBtn'), $('agendaFilterLabel'), $('agendaFilterPanel'),
    () => agendaCategoryFilter, (v) => { agendaCategoryFilter = v; });
  setupCategoryFilter($('sysFilterBtn'), $('sysFilterLabel'), $('sysFilterPanel'),
    () => sysCategoryFilter, (v) => { sysCategoryFilter = v; });
  setupEpsFilter($('sysEpsFilterBtn'), $('sysEpsFilterLabel'), $('sysEpsFilterPanel'));
  setupEpsFilter($('agendaEpsFilterBtn'), $('agendaEpsFilterLabel'), $('agendaEpsFilterPanel'));
  setupEpsFilter($('overviewEpsFilterBtn'), $('overviewEpsFilterLabel'), $('overviewEpsFilterPanel'));

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.agenda-filter-wrap')) filterControls.forEach(c => c.close());
  });

  const scrubberBubbleDay = $('scrubberBubbleDay'), scrubberBubbleTime = $('scrubberBubbleTime');
  const wheelViewport = $('wheelViewport'), wheelTrack = $('wheelTrack');
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

  function matchesSearch(t, cat){
    if (!matchesEps(t)) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (t.name && t.name.toLowerCase().includes(q)) return true;
    if (t.om && String(t.om).toLowerCase().includes(q)) return true;
    if (t.eps && t.eps.toLowerCase().includes(q)) return true;
    if (cat && cat.label && cat.label.toLowerCase().includes(q)) return true;
    if (t.subtasks && t.subtasks.some(st => 
      (st.name && st.name.toLowerCase().includes(q)) || 
      (st.pto_trab && st.pto_trab.toLowerCase().includes(q)) || 
      (st.ejecutor && st.ejecutor.toLowerCase().includes(q))
    )) {
      return true;
    }
    return false;
  }
  function matchesFilter(t, now){
    if (activeFilter === 'all') return true;
    if (activeFilter === 'today'){
      const tStartDay = dayKey(t._start);
      const tEndDay = dayKey(t._end);
      const currentDay = dayKey(now);
      return tStartDay === currentDay || tEndDay === currentDay || (t._start <= now && t._end >= now);
    }
    if (activeFilter === 'soon'){
      const in2h = new Date(now.getTime() + 2*3600000);
      return stateOf(t, now) === 'upcoming' && t._start <= in2h;
    }
    return stateOf(t, now) === activeFilter;
  }

  function renderSystems(now){
    sysList.innerHTML = '';
    let anyVisible = false;

    const orderedCats = DATA.categories
      .map((cat, idx) => ({ cat, idx }))
      .filter(({ cat }) => (tasksByCat[cat.id] || []).length)
      .filter(({ cat }) => sysCategoryFilter === 'all' || cat.id === sysCategoryFilter);

    orderedCats.forEach(({ cat, idx }) => {
      const all = tasksByCat[cat.id] || [];
      const visible = all.filter(t => matchesSearch(t, cat) && matchesFilter(t, now));
      if (!visible.length) return;
      anyVisible = true;

      const color = colorFor(idx);
      const isOpen = openCats.has(cat.id);
      const { state: cardState, activeCount, doneCount } = categoryState(all, now);

      let badgeText, badgeClass;
      if (cardState === 'active'){ badgeText = activeCount + ' en curso'; badgeClass = 'active'; }
      else if (cardState === 'done'){ badgeText = 'completado'; badgeClass = 'done'; }
      else { badgeText = all.length + ' pendientes'; badgeClass = 'upcoming'; }

      const card = document.createElement('div');
      card.className = 'sys-card card-' + cardState + (isOpen ? ' open' : '');
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
      marker.className = 'sys-now-marker live-red-marker';
      marker.style.left = pct(now) + '%';
      barEl.appendChild(marker);

      card.querySelector('.sys-card-head').addEventListener('click', () => {
        if (openCats.has(cat.id)) openCats.delete(cat.id); else openCats.add(cat.id);
        renderSystems(scrubTime);
        updateToggleAllBtn();
      });

      const listEl = card.querySelector('.sys-tasklist');
      visible.slice().sort((a,b)=>a._start-b._start).forEach(t => {
        const s = stateOf(t, now);
        const tIdx = all.indexOf(t);
        const tColor = getTaskColor(t, tIdx, idx);
        const tagText = s==='active' ? 'En curso' : s==='upcoming' ? 'Próximo' : '✓ Listo';
        const countdown = countdownInfo(t, now);
        const hasSub = t.subtasks && t.subtasks.length > 0;
        const isTaskExpanded = expandedTasks.has(t.id);

        const taskWrap = document.createElement('div');
        taskWrap.className = 'sys-task-wrap' + (isTaskExpanded ? ' is-expanded' : '');

        const row = document.createElement('div');
        row.className = 'sys-task state-' + s + (hasSub ? ' has-subtasks' : '');
        row.innerHTML = `
          <div class="sys-task-dot" style="background:${tColor}; box-shadow: 0 0 0 2px ${tColor}33;"></div>
          <div class="sys-task-main">
            <div class="sys-task-name${s==='done'?' done':''}">${t.name}</div>
            <div class="sys-task-meta">${fmtTaskWindow(t)} · ${t.duration}${t.om?' · OM '+t.om:''}${hasSub ? ` · <span class="subtask-inline-pill">${t.subtasks.length} pasos ${isTaskExpanded?'▴':'▾'}</span>` : ''}</div>
          </div>
          <div class="sys-task-right">
            <div class="sys-task-chip ${s}">${tagText}</div>
            ${countdown ? `<div class="sys-task-countdown ${countdown.kind}">⏱ ${countdown.text}</div>` : ''}
          </div>
        `;
        row.addEventListener('click', (e) => {
          if (window.innerWidth >= 768 && hasSub){
            if (expandedTasks.has(t.id)) expandedTasks.delete(t.id);
            else expandedTasks.add(t.id);
            renderSystems(scrubTime);
          } else {
            openDrawer(t, scrubTime);
          }
        });
        taskWrap.appendChild(row);

        if (isTaskExpanded && hasSub){
          const treeEl = document.createElement('div');
          treeEl.className = 'overview-subtasks-tree';
          t.subtasks.forEach((st, sIdx) => {
            const s_sub = stateOf(st, now);
            const stRow = document.createElement('div');
            stRow.className = 'subtask-tree-item state-' + s_sub;
            const badgeIcon = s_sub === 'done' ? '✓' : s_sub === 'active' ? '⚡' : String(sIdx + 1);
            stRow.innerHTML = `
              <div class="tree-line"></div>
              <div class="tree-badge ${s_sub}">${badgeIcon}</div>
              <div class="tree-content">
                <div class="tree-name">${st.name}</div>
                <div class="tree-meta">
                  <span class="tree-window">${fmtTaskWindow(st)}</span>
                  ${st.duration ? `<span class="tree-tag dur">⏱ ${st.duration}</span>` : ''}
                  ${st.pto_trab ? `<span class="tree-tag pto">${st.pto_trab}</span>` : ''}
                  ${st.ejecutor ? `<span class="tree-tag ejecutor">👤 ${st.ejecutor}</span>` : ''}
                </div>
              </div>
            `;
            stRow.addEventListener('click', (e) => {
              e.stopPropagation();
              openDrawer(t, scrubTime);
            });
            treeEl.appendChild(stRow);
          });
          taskWrap.appendChild(treeEl);
        }

        listEl.appendChild(taskWrap);
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
      if (agendaCategoryFilter !== 'all' && cat.id !== agendaCategoryFilter) return;
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
    const countdown = countdownInfo(t, now);
    const metaTags = [];
    if (countdown) metaTags.push(`<span class="agenda-tag countdown ${countdown.kind}">⏱ ${countdown.text}</span>`);
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

  let currentDrawerTask = null;
  function openDrawer(t, now){
    currentDrawerTask = t;
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
    const countdown = countdownInfo(t, now);
    const drowCountdown = $('drowCountdown');
    drowCountdown.hidden = !countdown;
    drowCountdown.className = 'drow' + (countdown ? ' ' + countdown.kind : '');
    if (countdown) $('drawerCountdown').textContent = countdown.text;
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

    // Desglose de subtareas si existen
    const subtasksWrap = $('drawerSubtasksWrap');
    const subtasksList = $('drawerSubtasksList');
    const subtasksCount = $('drawerSubtasksCount');

    if (subtasksWrap && subtasksList){
      if (t.subtasks && t.subtasks.length > 0){
        subtasksWrap.hidden = false;
        const totalSub = t.subtasks.length;
        const doneSub = t.subtasks.filter(st => stateOf(st, now) === 'done').length;
        const activeSub = t.subtasks.filter(st => stateOf(st, now) === 'active').length;
        
        if (subtasksCount){
          subtasksCount.textContent = `${totalSub} pasos · ${doneSub} listos${activeSub > 0 ? ' (' + activeSub + ' en curso)' : ''}`;
        }
        subtasksList.innerHTML = '';

        t.subtasks.forEach((st, idx) => {
          const s_sub = stateOf(st, now);
          const stEl = document.createElement('div');
          stEl.className = 'drawer-subtask-item state-' + s_sub;

          const badgeContent = s_sub === 'done' 
            ? '✓' 
            : s_sub === 'active' 
            ? '⚡' 
            : String(idx + 1);

          const durTag = st.duration ? `<span class="subtask-tag dur">⏱ ${st.duration}</span>` : '';
          const ptoTag = st.pto_trab ? `<span class="subtask-tag pto">${st.pto_trab}</span>` : '';
          const ejecutorTag = st.ejecutor ? `<span class="subtask-tag ejecutor">👤 ${st.ejecutor}</span>` : '';

          stEl.innerHTML = `
            <div class="subtask-badge ${s_sub}">${badgeContent}</div>
            <div class="subtask-content">
              <div class="subtask-name">${st.name}</div>
              <div class="subtask-meta">
                <span class="subtask-window">${fmtTaskWindow(st)}</span>
                ${durTag}
                ${ptoTag}
                ${ejecutorTag}
              </div>
            </div>
          `;
          subtasksList.appendChild(stEl);
        });
      } else {
        subtasksWrap.hidden = true;
      }
    }

    drawer.scrollTop = 0;
    drawer.classList.add('show'); drawerBackdrop.classList.add('show');
  }
  function closeDrawer(){ drawer.classList.remove('show'); drawerBackdrop.classList.remove('show'); }
  drawerClose.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  $('drawerGoto').addEventListener('click', () => {
    if (!currentDrawerTask) return;
    const catId = currentDrawerTask.category;
    closeDrawer();
    closeOverview();
    goToSystem(catId);
  });

  // ===== Panorama general: todos los sistemas en una sola línea de tiempo =====
  const btnOverview = $('btnOverview');
  const overviewPanel = $('overviewPanel');
  const overviewClose = $('overviewClose');
  const overviewRows = $('overviewRows');
  const overviewKpiStrip = $('overviewKpiStrip');
  const overviewFilterChips = $('overviewFilterChips');
  const ovKpiActive = $('ovKpiActive'), ovKpiNext = $('ovKpiNext'), ovKpiDone = $('ovKpiDone'), ovKpiTotal = $('ovKpiTotal');
  let overviewOpen = false;

  const overviewOpenCats = new Set();

  function renderOverview(now){
    overviewRows.innerHTML = '';
    DATA.categories.forEach((cat, idx) => {
      const all = tasksByCat[cat.id] || [];
      if (!all.length) return;
      const visible = all.filter(t => matchesEps(t) && matchesFilter(t, now));
      if (!visible.length) return;
      const isOpen = overviewOpenCats.has(cat.id);
      const activeCount = all.filter(t => matchesEps(t) && stateOf(t, now) === 'active').length;
      const doneCount = all.filter(t => matchesEps(t) && stateOf(t, now) === 'done').length;
      const upcomingCount = visible.length - activeCount - doneCount;
      const { state: rowState } = categoryState(all, now);

      const row = document.createElement('div');
      row.className = 'overview-row card-' + rowState + (isOpen ? ' open' : '');
      row.innerHTML = `
        <div class="overview-row-head">
          <div class="overview-row-label">
            <span class="icon">${cat.icon}</span>
            <div class="label-text">
              <span class="name">${cat.label}</span>
              <span class="stats"><b class="s-active">${activeCount}</b>/<b class="s-done">${doneCount}</b>/<b class="s-upcoming">${upcomingCount}</b></span>
            </div>
          </div>
          <div class="overview-bar-wrap"></div>
          <svg class="overview-chev" viewBox="0 0 24 24" width="14" height="14"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="overview-tasklist"></div>
      `;
      const barEl = row.querySelector('.overview-bar-wrap');
      DAY_SEGMENTS.slice(1).forEach(seg => {
        const div = document.createElement('div');
        div.className = 'overview-daydiv';
        div.style.left = pct(seg.start) + '%';
        barEl.appendChild(div);
      });
      all.forEach((t, tIdx) => {
        if (!matchesEps(t) || !matchesFilter(t, now)) return;
        const s = stateOf(t, now);
        const left = pct(t._start);
        const width = Math.max(1, pct(t._end) - left);
        const seg = document.createElement('div');
        seg.className = 'overview-seg state-' + s;
        seg.style.left = left + '%';
        seg.style.width = width + '%';
        seg.title = t.name;
        seg.addEventListener('click', (e) => { e.stopPropagation(); openDrawer(t, scrubTime); });
        barEl.appendChild(seg);
      });
      const nowLine = document.createElement('div');
      nowLine.className = 'overview-now-line live-red-marker';
      nowLine.style.left = pct(now) + '%';
      barEl.appendChild(nowLine);

      if (isOpen){
        const listEl = row.querySelector('.overview-tasklist');
        all.slice().sort((a, b) => a._start - b._start).forEach((t, tIdx) => {
          if (!matchesEps(t) || !matchesFilter(t, now)) return;
          const s = stateOf(t, now);
          const dotColor = s === 'active' ? 'var(--warning)' : s === 'upcoming' ? 'var(--upcoming)' : 'var(--success)';
          const tagText = s === 'active' ? 'En curso' : s === 'upcoming' ? 'Próximo' : '✓ Listo';
          const countdown = countdownInfo(t, now);
          const hasSub = t.subtasks && t.subtasks.length > 0;
          const isTaskExpanded = expandedTasks.has(t.id);

          const taskWrap = document.createElement('div');
          taskWrap.className = 'overview-task-wrap' + (isTaskExpanded ? ' is-expanded' : '');

          const taskRow = document.createElement('div');
          taskRow.className = 'overview-task state-' + s + (hasSub ? ' has-subtasks' : '');
          taskRow.innerHTML = `
            <span class="dot" style="background:${dotColor}"></span>
            <span class="name">${t.name}</span>
            ${hasSub ? `<span class="subtasks-count-pill">${t.subtasks.length} pasos ${isTaskExpanded ? '▴' : '▾'}</span>` : ''}
            <span class="chip ${s}">${tagText}</span>
            <div class="meta">
              <span class="window">${fmtTaskWindow(t)}</span>
              ${countdown ? `<span class="countdown ${countdown.kind}">⏱ ${countdown.text}</span>` : ''}
            </div>
          `;

          taskRow.addEventListener('click', (e) => {
            e.stopPropagation();
            if (window.innerWidth >= 768 && hasSub){
              if (expandedTasks.has(t.id)) expandedTasks.delete(t.id);
              else expandedTasks.add(t.id);
              renderOverview(scrubTime);
            } else {
              openDrawer(t, scrubTime);
            }
          });

          taskWrap.appendChild(taskRow);

          if (isTaskExpanded && hasSub){
            const treeEl = document.createElement('div');
            treeEl.className = 'overview-subtasks-tree';
            t.subtasks.forEach((st, sIdx) => {
              const s_sub = stateOf(st, now);
              const stRow = document.createElement('div');
              stRow.className = 'subtask-tree-item state-' + s_sub;
              const badgeIcon = s_sub === 'done' ? '✓' : s_sub === 'active' ? '⚡' : String(sIdx + 1);
              stRow.innerHTML = `
                <div class="tree-line"></div>
                <div class="tree-badge ${s_sub}">${badgeIcon}</div>
                <div class="tree-content">
                  <div class="tree-name">${st.name}</div>
                  <div class="tree-meta">
                    <span class="tree-window">${fmtTaskWindow(st)}</span>
                    ${st.duration ? `<span class="tree-tag dur">⏱ ${st.duration}</span>` : ''}
                    ${st.pto_trab ? `<span class="tree-tag pto">${st.pto_trab}</span>` : ''}
                    ${st.ejecutor ? `<span class="tree-tag ejecutor">👤 ${st.ejecutor}</span>` : ''}
                  </div>
                </div>
              `;
              stRow.addEventListener('click', (e) => {
                e.stopPropagation();
                openDrawer(t, scrubTime);
              });
              treeEl.appendChild(stRow);
            });
            taskWrap.appendChild(treeEl);
          }

          listEl.appendChild(taskWrap);
        });
      }

      row.querySelector('.overview-row-head').addEventListener('click', () => {
        if (overviewOpenCats.has(cat.id)) overviewOpenCats.delete(cat.id); else overviewOpenCats.add(cat.id);
        renderOverview(scrubTime);
        updateToggleAllOverviewBtn();
      });
      overviewRows.appendChild(row);
    });
    if (!overviewRows.children.length){
      const empty = document.createElement('div');
      empty.className = 'overview-empty';
      empty.textContent = 'Sin actividades para este filtro.';
      overviewRows.appendChild(empty);
    }
    [...overviewKpiStrip.children].forEach(c => c.classList.toggle('selected', c.dataset.kpi === activeFilter));
    [...overviewFilterChips.children].forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter));
  }

  function openOverview(){
    overviewOpen = true;
    renderOverview(scrubTime);
    overviewPanel.classList.add('show');
    document.body.classList.add('overview-active');
  }
  function closeOverview(){
    overviewOpen = false;
    overviewPanel.classList.remove('show');
    document.body.classList.remove('overview-active');
  }
  btnOverview.addEventListener('click', openOverview);
  overviewClose.addEventListener('click', closeOverview);

  const btnShare = $('btnShare');
  const shareDrawer = $('shareDrawer');
  const shareClose = $('shareClose');
  const shareUrlText = $('shareUrlText');
  const btnCopyLink = $('btnCopyLink');
  const btnShareWsp = $('btnShareWsp');
  const shareQr = $('shareQr');

  function currentShareUrl(){
    return 'https://cronoapp-red.vercel.app/';
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

  // "Abrir en Chrome": en Android se puede forzar Chrome específicamente vía
  // un intent:// URL; en iOS, Chrome expone el esquema googlechrome(s)://
  // si está instalada. En desktop no hay forma de elegir el navegador desde
  // JS, así que simplemente se abre en una pestaña nueva.
  $('btnOpenChrome').addEventListener('click', () => {
    const url = currentShareUrl();
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)){
      const noProtocol = url.replace(/^https?:\/\//, '');
      window.location.href = 'intent://' + noProtocol + '#Intent;scheme=https;package=com.android.chrome;end';
    } else if (/iPhone|iPad|iPod/i.test(ua)){
      window.location.href = url.replace(/^https:\/\//, 'googlechromes://').replace(/^http:\/\//, 'googlechrome://');
    } else {
      window.open(url, '_blank', 'noopener');
    }
  });

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
    const in2h = new Date(now.getTime() + 2*3600000);
    let active=0, upcoming2h=0, done=0;
    const isEpsFiltered = selectedEpsFilter !== 'all';
    const filteredTasks = isEpsFiltered 
      ? DATA.tasks.filter(t => matchesEps(t))
      : DATA.tasks;

    let sumProgress = 0;
    filteredTasks.forEach(t=>{
      const s = stateOf(t, now);
      if (s==='active'){
        active++;
        const duration = t._end - t._start;
        const taskProg = duration > 0 ? Math.max(0, Math.min(1, (now - t._start) / duration)) : 0.5;
        sumProgress += taskProg;
      } else if (s==='done'){
        done++;
        sumProgress += 1;
      }
      if (s==='upcoming' && t._start <= in2h) upcoming2h++;
    });
    const total = filteredTasks.length;
    kpiActive.textContent = active; kpiNext.textContent = upcoming2h;
    kpiDone.textContent = done; kpiTotal.textContent = total;
    ovKpiActive.textContent = active; ovKpiNext.textContent = upcoming2h;
    ovKpiDone.textContent = done; ovKpiTotal.textContent = total;

    let phase, hdrClass, label, p;

    if (isEpsFiltered){
      if ($('summaryEyebrow')) $('summaryEyebrow').textContent = `Avance Empresa · ${selectedEpsFilter}`;
      p = total > 0 ? Math.max(0, Math.min(100, Math.round((sumProgress / total) * 100))) : 0;

      if (done === total && total > 0){
        phase = 'Trabajos finalizados'; hdrClass = 'state-live'; label = `${selectedEpsFilter} · Completado`;
      } else if (active > 0){
        phase = `${active} tarea${active>1?'s':''} en ejecución (${done}/${total} listas)`;
        hdrClass = 'state-live';
        label = `${selectedEpsFilter} · En curso`;
      } else if (done > 0){
        phase = `${done} de ${total} tareas listas (en pausa)`;
        hdrClass = 'state-soon';
        label = `${selectedEpsFilter} · Parcial`;
      } else {
        phase = 'Sin iniciar'; hdrClass = 'state-soon'; label = `${selectedEpsFilter} · Pendiente`;
      }

      if (filteredTasks.length > 0){
        const epsStarts = filteredTasks.map(t => t._start.getTime());
        const epsEnds = filteredTasks.map(t => t._end.getTime());
        summaryFrom.textContent = fmtDayTime(new Date(Math.min(...epsStarts)));
        summaryTo.textContent = fmtDayTime(new Date(Math.max(...epsEnds)));
      } else {
        summaryFrom.textContent = '—'; summaryTo.textContent = '—';
      }
    } else {
      if ($('summaryEyebrow')) $('summaryEyebrow').textContent = 'Programa general · PG26L2';
      p = Math.max(0, Math.min(100, Math.round(((now-WINDOW_START)/WINDOW_MS)*100)));

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
      summaryFrom.textContent = fmtDayTime(MASTER._start);
      summaryTo.textContent = fmtDayTime(MASTER._end);
    }

    hdrLive.className = 'hdr-status ' + hdrClass;
    liveLabel.textContent = label + (autoFollow ? ' · en vivo' : '');

    summaryPct.textContent = p + '%';
    summaryFill.style.width = p + '%';
    summaryPhase.textContent = phase;
    summaryPhase.className = 'summary-phase ' + (hdrClass==='state-outage' ? 'outage' : hdrClass==='state-soon' ? 'soon' : hdrClass==='state-live' ? 'live' : '');
  }

  function updateScrubberBubble(){
    scrubberBubbleDay.textContent = DAY_NAMES[scrubTime.getDay()] + ' ' + String(scrubTime.getDate()).padStart(2,'0');
    scrubberBubbleTime.textContent = fmtTime(scrubTime);
  }

  let lastRenderedMinute = -1;
  function setScrubTime(t, force = false){
    scrubTime = clampToWindow(t);
    updateScrubberBubble();
    updateChrome(scrubTime);
    const curMin = Math.floor(scrubTime.getTime() / 60000);
    if (force || curMin !== lastRenderedMinute){
      lastRenderedMinute = curMin;
      renderActiveView(scrubTime);
      if (overviewOpen) renderOverview(scrubTime);
    }
  }

  // ===== Rueda horizontal infinita de tiempo (estilo Zoom Earth) =====
  // Cada día es un bloque de ancho fijo (PX_PER_MIN px por minuto) que se
  // desliza bajo una línea central fija (el "playhead"). El contenedor usa
  // scroll nativo horizontal (drag/touch suave gratis) y solo se montan en
  // el DOM los bloques de día cercanos al área visible: al hacer scroll se
  // agregan los días que entran y se quitan los que quedan lejos.
  const PX_PER_MIN = 1; // 60px = 1 hora, 1440px = 1 día
  function offsetPx(d){ return (d - WINDOW_START) / 60000 * PX_PER_MIN; }
  function timeAtPx(px){ return new Date(WINDOW_START.getTime() + (px / PX_PER_MIN) * 60000); }
  const TRACK_WIDTH = WINDOW_MS / 60000 * PX_PER_MIN;

  let sidePad = 0;
  const mountedDays = new Set();
  const dayElId = i => 'wheelDay' + i;

  function buildDayEl(i){
    const seg = DAY_SEGMENTS[i];
    const left = sidePad + offsetPx(seg.start);
    const width = offsetPx(seg.end) - offsetPx(seg.start);
    const el = document.createElement('div');
    el.className = 'wheel-day';
    el.id = dayElId(i);
    el.style.left = left + 'px';
    el.style.width = width + 'px';

    const label = document.createElement('div');
    label.className = 'wheel-day-label';
    label.textContent = seg.label + ' ' + String(seg.date).padStart(2, '0');
    el.appendChild(label);

    let h = new Date(seg.start); h.setMinutes(0, 0, 0);
    if (h < seg.start) h = new Date(h.getTime() + 3600000);
    while (h < seg.end){
      const tickLeft = offsetPx(h) - offsetPx(seg.start);
      const isMajor = h.getHours() % 6 === 0;
      const tick = document.createElement('div');
      tick.className = 'wheel-tick' + (isMajor ? ' major' : '');
      tick.style.left = tickLeft + 'px';
      el.appendChild(tick);
      if (isMajor){
        const tl = document.createElement('div');
        tl.className = 'wheel-tick-label';
        tl.style.left = tickLeft + 'px';
        tl.textContent = String(h.getHours()).padStart(2, '0') + ':00';
        el.appendChild(tl);
      }
      h = new Date(h.getTime() + 3600000);
    }
    return el;
  }

  function updateMountedDays(){
    const bufferPx = wheelViewport.clientWidth * 1.5;
    const minPx = wheelViewport.scrollLeft - bufferPx;
    const maxPx = wheelViewport.scrollLeft + wheelViewport.clientWidth + bufferPx;
    const wanted = new Set();
    DAY_SEGMENTS.forEach((seg, i) => {
      const segLeft = sidePad + offsetPx(seg.start);
      const segRight = sidePad + offsetPx(seg.end);
      if (segRight >= minPx && segLeft <= maxPx) wanted.add(i);
    });
    mountedDays.forEach(i => {
      if (!wanted.has(i)){
        const el = document.getElementById(dayElId(i));
        if (el) el.remove();
        mountedDays.delete(i);
      }
    });
    wanted.forEach(i => {
      if (!mountedDays.has(i)){
        wheelTrack.appendChild(buildDayEl(i));
        mountedDays.add(i);
      }
    });
  }

  function layoutWheel(){
    sidePad = wheelViewport.clientWidth / 2;
    wheelTrack.style.width = (sidePad * 2 + TRACK_WIDTH) + 'px';
    mountedDays.forEach(i => { const el = document.getElementById(dayElId(i)); if (el) el.remove(); });
    mountedDays.clear();
    updateMountedDays();
  }

  function scrollToTime(t, opts){
    const px = Math.max(0, sidePad + offsetPx(clampToWindow(t)) - wheelViewport.clientWidth / 2);
    wheelViewport.scrollTo({ left: px, behavior: (opts && opts.smooth) ? 'smooth' : 'auto' });
  }

  function onWheelScroll(){
    updateMountedDays();
    const centerPx = wheelViewport.scrollLeft + wheelViewport.clientWidth / 2 - sidePad;
    setScrubTime(timeAtPx(centerPx));
  }
  wheelViewport.addEventListener('scroll', onWheelScroll, { passive: true });

  // El touch/trackpad ya desliza nativo vía overflow-x; para mouse (drag con
  // click sostenido) se traduce el movimiento a scrollLeft manualmente.
  const scrubberEl = $('scrubber');
  let mouseDrag = null;
  wheelViewport.addEventListener('mousedown', (e) => {
    mouseDrag = { startX: e.clientX, startScroll: wheelViewport.scrollLeft };
    wheelViewport.classList.add('is-dragging');
    scrubberEl.classList.add('is-dragging');
    autoFollow = false; stopPlaying();
    e.preventDefault();
  });
  window.addEventListener('mousemove', (e) => {
    if (!mouseDrag) return;
    wheelViewport.scrollLeft = mouseDrag.startScroll - (e.clientX - mouseDrag.startX);
  });
  window.addEventListener('mouseup', () => {
    if (mouseDrag){ wheelViewport.classList.remove('is-dragging'); scrubberEl.classList.remove('is-dragging'); }
    mouseDrag = null;
  });
  wheelViewport.addEventListener('touchstart', () => {
    autoFollow = false; stopPlaying();
    scrubberEl.classList.add('is-dragging');
  }, { passive: true });
  wheelViewport.addEventListener('touchend', () => { scrubberEl.classList.remove('is-dragging'); }, { passive: true });
  wheelViewport.addEventListener('wheel', () => { autoFollow = false; stopPlaying(); }, { passive: true });

  window.addEventListener('resize', () => {
    const keepTime = scrubTime;
    layoutWheel();
    scrollToTime(keepTime, { smooth: false });
  });

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
      scrollToTime(next, { smooth: false });
    }, 260);
  }
  btnPlay.addEventListener('click', () => {
    if (playing){ stopPlaying(); return; }
    autoFollow = false;
    scrollToTime(clampToWindow(new Date()), { smooth: false });
    startPlaying();
  });

  btnLive.addEventListener('click', () => {
    stopPlaying(); autoFollow = true;
    const now = new Date();
    scrollToTime(now, { smooth: true });
    setScrubTime(now);
  });

  if (searchInput) {
    searchInput.addEventListener('input', e => { 
      searchQuery = e.target.value.trim(); 
      if (searchClear) searchClear.hidden = !searchQuery;
      renderActiveView(scrubTime);
      if (overviewOpen) renderOverview(scrubTime);
    });
  }
  if (searchClear) {
    searchClear.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      searchQuery = '';
      searchClear.hidden = true;
      renderActiveView(scrubTime);
      if (overviewOpen) renderOverview(scrubTime);
    });
  }

  function syncFilterChipsUI(){
    [...filterChips.children].forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter));
    [...overviewFilterChips.children].forEach(c => c.classList.toggle('active', c.dataset.filter === activeFilter));
  }
  function applyFilter(filter){
    activeFilter = filter;
    if (activeFilter !== 'all'){
      autoExpandFiltered(scrubTime);
    }
    syncFilterChipsUI();
    [...kpiStrip.children].forEach(c => c.classList.toggle('selected', c.dataset.kpi === activeFilter));
    [...overviewKpiStrip.children].forEach(c => c.classList.toggle('selected', c.dataset.kpi === activeFilter));
    renderActiveView(scrubTime);
    if (overviewOpen) renderOverview(scrubTime);
    updateToggleAllBtn();
    updateToggleAllOverviewBtn();
  }
  filterChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    applyFilter(btn.dataset.filter);
  });

  kpiStrip.addEventListener('click', e => {
    const btn = e.target.closest('.kpi'); if (!btn) return;
    applyFilter(btn.dataset.kpi);
    const target = viewMode === 'agenda' ? viewAgenda : viewSystems;
    const top = target.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top, behavior: 'smooth' });
  });

  overviewKpiStrip.addEventListener('click', e => {
    const btn = e.target.closest('.kpi'); if (!btn) return;
    applyFilter(btn.dataset.kpi);
  });

  overviewFilterChips.addEventListener('click', e => {
    const btn = e.target.closest('.chip'); if (!btn) return;
    applyFilter(btn.dataset.filter);
  });

  setInterval(() => {
    if (autoFollow && !playing){
      const now = new Date();
      scrollToTime(now, { smooth: false });
      setScrubTime(now);
    } else {
      updateChrome(scrubTime);
    }
  }, 1000);

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

  layoutWheel();
  scrollToTime(scrubTime, { smooth: false });
  setScrubTime(scrubTime);
  syncHeaderHeight();
};
