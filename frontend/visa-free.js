/* ===================================================================
   VISA-FREE DESTINATIONS — Frontend Application
   =================================================================== */
(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  let countries = [];
  let allDestinations = [];
  let currentFilter = 'all';

  // ── DOM refs ──────────────────────────────────────────────────────
  const form        = document.getElementById('vf-form');
  const natInput    = document.getElementById('nationality');
  const natList     = document.getElementById('ac-nationality');
  const submitBtn   = document.getElementById('submit-btn');
  const spinnerEl   = document.getElementById('spinner');
  const resultsSec  = document.getElementById('results');
  const heading     = document.getElementById('results-heading');
  const countEl     = document.getElementById('vf-count');
  const gridEl      = document.getElementById('vf-grid');
  const filtersEl   = document.getElementById('vf-filters');
  const errorBanner = document.getElementById('error-banner');
  const errorMsg    = document.getElementById('error-message');
  const closeError  = document.getElementById('close-error');
  const navToggle   = document.getElementById('nav-toggle');

  // ── Init ──────────────────────────────────────────────────────────
  fetchCountries();
  initGridCanvas();
  closeError.addEventListener('click', hideError);

  // Mobile nav toggle
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      const links = document.querySelector('.nav-links');
      links.classList.toggle('open');
    });
  }

  async function fetchCountries() {
    try {
      const res = await fetch('/api/countries');
      if (!res.ok) throw new Error('Failed to load countries');
      const data = await res.json();
      countries = data.countries || data;
    } catch {
      showError('Unable to load country list — please refresh.');
    }
  }

  // ── Autocomplete ──────────────────────────────────────────────────
  function setupAutocomplete(input, listEl, onSelect) {
    let idx = -1;

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 1) { hide(listEl); return; }
      const matches = countries.filter(c => c.toLowerCase().includes(q)).slice(0, 12);
      if (!matches.length) { hide(listEl); return; }
      renderList(listEl, matches, q);
      idx = -1;
      show(listEl);
    });

    input.addEventListener('keydown', e => {
      const items = listEl.querySelectorAll('li');
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, items.length - 1);
        highlight(items, idx);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        highlight(items, idx);
      } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault();
        items[idx].click();
      } else if (e.key === 'Escape') {
        hide(listEl);
      }
    });

    listEl.addEventListener('click', e => {
      const li = e.target.closest('li');
      if (!li) return;
      onSelect(li.dataset.value);
      hide(listEl);
    });

    input.addEventListener('blur', () => {
      setTimeout(() => hide(listEl), 160);
    });

    input.addEventListener('focus', () => {
      if (input.value.trim().length >= 1) input.dispatchEvent(new Event('input'));
    });
  }

  function renderList(listEl, items, q) {
    listEl.innerHTML = items.map(name => {
      const hl = highlightText(name, q);
      return `<li data-value="${escapeHtml(name)}">${hl}</li>`;
    }).join('');
  }

  function highlightText(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) return escapeHtml(text);
    return escapeHtml(text.slice(0, i))
      + '<mark>' + escapeHtml(text.slice(i, i + q.length)) + '</mark>'
      + escapeHtml(text.slice(i + q.length));
  }

  function highlight(items, idx) {
    items.forEach((li, i) => li.classList.toggle('active', i === idx));
    items[idx]?.scrollIntoView({ block: 'nearest' });
  }

  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }

  setupAutocomplete(natInput, natList, val => { natInput.value = val; });

  // ── Categorize visa type ──────────────────────────────────────────
  function categorize(dest) {
    const vt = (dest.visaType || '').toLowerCase();
    if (!dest.visaRequired && !vt.includes('on arrival') && !vt.includes('tourist card')) {
      return 'visa-free';
    }
    if (vt.includes('on arrival') || vt.includes('tourist card')) {
      return 'on-arrival';
    }
    return 'e-visa';
  }

  function categoryLabel(cat) {
    if (cat === 'visa-free') return 'Visa-Free';
    if (cat === 'on-arrival') return 'On Arrival';
    return 'e-Visa / eTA';
  }

  // ── Filter Tabs ───────────────────────────────────────────────────
  filtersEl.addEventListener('click', e => {
    const btn = e.target.closest('.vf-filter');
    if (!btn) return;
    currentFilter = btn.dataset.filter;
    filtersEl.querySelectorAll('.vf-filter').forEach(b => b.classList.toggle('active', b === btn));
    renderGrid();
  });

  // ── Form Submission ───────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    hideError();
    document.getElementById('err-nationality').textContent = '';

    const raw = natInput.value.trim();
    const nationality = countries.find(c => c.toLowerCase() === raw.toLowerCase()) || raw;
    natInput.value = nationality;

    if (!countries.includes(nationality)) {
      document.getElementById('err-nationality').textContent = 'Please select a valid nationality.';
      natInput.focus();
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/visa-free/${encodeURIComponent(nationality)}`);
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      allDestinations = data.destinations;
      currentFilter = 'all';
      filtersEl.querySelectorAll('.vf-filter').forEach(b =>
        b.classList.toggle('active', b.dataset.filter === 'all')
      );
      heading.textContent = `${data.nationality} Passport`;
      resultsSec.classList.remove('hidden');
      renderGrid();
      resultsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      showError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  });

  // ── Render Destination Grid ───────────────────────────────────────
  function renderGrid() {
    const filtered = currentFilter === 'all'
      ? allDestinations
      : allDestinations.filter(d => categorize(d) === currentFilter);

    // Update counts
    const totalAll = allDestinations.length;
    const totalVF = allDestinations.filter(d => categorize(d) === 'visa-free').length;
    const totalOA = allDestinations.filter(d => categorize(d) === 'on-arrival').length;
    const totalEV = allDestinations.filter(d => categorize(d) === 'e-visa').length;

    // Update filter button labels with counts
    filtersEl.querySelectorAll('.vf-filter').forEach(btn => {
      const f = btn.dataset.filter;
      if (f === 'all') btn.textContent = `All (${totalAll})`;
      else if (f === 'visa-free') btn.textContent = `Visa-Free (${totalVF})`;
      else if (f === 'on-arrival') btn.textContent = `On Arrival (${totalOA})`;
      else if (f === 'e-visa') btn.textContent = `e-Visa / eTA (${totalEV})`;
    });

    countEl.innerHTML = `Showing <strong>${filtered.length}</strong> destination${filtered.length !== 1 ? 's' : ''}`;

    if (!filtered.length) {
      gridEl.innerHTML = '<p class="vf-empty">No destinations found for this filter.</p>';
      return;
    }

    gridEl.innerHTML = filtered.map((dest, i) => {
      const cat = categorize(dest);
      return `<div class="vf-card" style="--i:${i}">
        <div class="vf-card-country">${escapeHtml(dest.destination)}</div>
        <div class="vf-card-meta">
          <span class="vf-badge cat-${cat}">${categoryLabel(cat)}</span>
          <div class="vf-card-stay-wrap">
            <span class="vf-card-stay-label">Max Stay</span>
            <span class="vf-card-stay">${escapeHtml(dest.maxStay || '—')}</span>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function setLoading(on) {
    submitBtn.disabled = on;
    spinnerEl.classList.toggle('hidden', !on);
    submitBtn.querySelector('.btn-text').textContent = on ? 'Loading…' : 'Show Visa-Free Destinations';
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorBanner.classList.remove('hidden');
  }

  function hideError() { errorBanner.classList.add('hidden'); }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── Animated Grid Canvas ──────────────────────────────────────────
  function initGridCanvas() {
    const canvas = document.getElementById('grid-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, time = 0;

    function resize() {
      w = canvas.width  = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    function draw() {
      time += 0.003;
      ctx.clearRect(0, 0, w, h);

      const spacing = 60;
      const drift = Math.sin(time) * 8;

      ctx.strokeStyle = 'rgba(139,125,107,0.08)';
      ctx.lineWidth = 0.5;
      for (let y = drift % spacing; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const driftV = Math.cos(time * 0.7) * 6;
      for (let x = driftV % spacing; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      ctx.fillStyle = 'rgba(139,125,107,0.12)';
      for (let y = drift % spacing; y < h; y += spacing) {
        for (let x = driftV % spacing; x < w; x += spacing) {
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      requestAnimationFrame(draw);
    }
    draw();
  }
})();
