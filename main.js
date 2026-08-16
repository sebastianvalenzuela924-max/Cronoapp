(function(){
  'use strict';

  if ('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  const menuScreen = document.getElementById('menuScreen');
  const menuCards = document.getElementById('menuCards');
  const appShell = document.getElementById('appShell');
  const btnBackMenu = document.getElementById('btnBackMenu');

  const fmtShortDate = d => d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }).replace('.', '');

  function buildCard(crono){
    const data = crono.getData();
    const start = new Date(data.windowStart);
    const end = new Date(data.windowEnd);
    const card = document.createElement('a');
    card.href = 'index.html?c=' + crono.id;
    card.className = 'menu-card';
    card.style.setProperty('--accent', crono.accent);
    card.innerHTML = `
      <div class="menu-card-icon">${crono.icon}</div>
      <div class="menu-card-body">
        <div class="menu-card-title">${crono.title}</div>
        <div class="menu-card-subtitle">${crono.subtitle}</div>
        <div class="menu-card-stats">${data.tasks.length} tareas · ${data.categories.length} sistemas · ${fmtShortDate(start)}–${fmtShortDate(end)}</div>
      </div>
      <svg class="menu-card-chev" viewBox="0 0 24 24" width="18" height="18"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    `;
    return card;
  }

  CRONOGRAMAS.forEach(c => menuCards.appendChild(buildCard(c)));

  const params = new URLSearchParams(location.search);
  const selected = CRONOGRAMAS.find(c => c.id === params.get('c'));

  if (selected){
    menuScreen.hidden = true;
    appShell.hidden = false;
    document.getElementById('hdrMark').textContent = selected.icon;
    document.getElementById('hdrH1').textContent = selected.title;
    document.getElementById('hdrSubtitle').textContent = selected.subtitle;
    document.title = 'CronoApp · ' + selected.title;
    window.initCronoApp(selected.getData());
  } else {
    menuScreen.hidden = false;
    appShell.hidden = true;
    document.title = 'CronoApp · Elige tu cronograma';
  }

  if (btnBackMenu){
    btnBackMenu.addEventListener('click', () => { location.href = 'index.html'; });
  }
})();
