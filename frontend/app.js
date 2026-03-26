/* ===================================================================
   VISA & TRANSIT ATLAS — Frontend Application
   =================================================================== */
(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────
  let countries = [];
  const selectedTransit = [];

  // ── DOM refs ──────────────────────────────────────────────────────
  const form         = document.getElementById('visa-form');
  const natInput     = document.getElementById('nationality');
  const destInput    = document.getElementById('destination');
  const transitInput = document.getElementById('transit-input');
  const natList      = document.getElementById('ac-nationality');
  const destList     = document.getElementById('ac-destination');
  const transitList  = document.getElementById('ac-transit');
  const tagsWrap     = document.getElementById('transit-tags');
  const submitBtn    = document.getElementById('submit-btn');
  const spinnerEl    = document.getElementById('spinner');
  const resultsSec   = document.getElementById('results');
  const errorBanner  = document.getElementById('error-banner');
  const errorMsg     = document.getElementById('error-message');
  const closeError   = document.getElementById('close-error');

  // ── Init ──────────────────────────────────────────────────────────
  fetchCountries();
  initGridCanvas();
  closeError.addEventListener('click', hideError);

  // Mobile nav toggle
  const navToggle = document.getElementById('nav-toggle');
  if (navToggle) {
    navToggle.addEventListener('click', () => {
      document.querySelector('.nav-links').classList.toggle('open');
    });
  }

  async function fetchCountries() {
    try {
      const res = await fetch('/api/countries');
      if (!res.ok) throw new Error('Failed to load countries');
      const data = await res.json();
      countries = data.countries || data;
    } catch (e) {
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
      // small delay so click can register on the list
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

  // Hook up nationality & destination
  setupAutocomplete(natInput, natList, val => { natInput.value = val; });
  setupAutocomplete(destInput, destList, val => { destInput.value = val; });

  // Transit — select adds tag
  setupAutocomplete(transitInput, transitList, val => {
    transitInput.value = '';
    if (!selectedTransit.includes(val)) {
      selectedTransit.push(val);
      renderTags();
    }
  });

  function renderTags() {
    tagsWrap.innerHTML = selectedTransit.map(c =>
      `<span class="transit-tag">${escapeHtml(c)}<button type="button" data-country="${escapeHtml(c)}">&times;</button></span>`
    ).join('');
    tagsWrap.querySelectorAll('button').forEach(b => {
      b.addEventListener('click', () => {
        const i = selectedTransit.indexOf(b.dataset.country);
        if (i > -1) { selectedTransit.splice(i, 1); renderTags(); }
      });
    });
  }

  // ── Form Submission ───────────────────────────────────────────────
  form.addEventListener('submit', async e => {
    e.preventDefault();
    clearErrors();
    hideError();

    // Normalize typed input to match proper-cased country name
    const natRaw  = natInput.value.trim();
    const destRaw = destInput.value.trim();
    const nationality  = countries.find(c => c.toLowerCase() === natRaw.toLowerCase()) || natRaw;
    const destination   = countries.find(c => c.toLowerCase() === destRaw.toLowerCase()) || destRaw;
    natInput.value = nationality;
    destInput.value = destination;
    const transitArray = [...selectedTransit];

    // Validate
    if (!countries.includes(nationality)) {
      showFieldError('err-nationality', 'Please select a valid nationality.');
      natInput.focus();
      return;
    }
    if (!countries.includes(destination)) {
      showFieldError('err-destination', 'Please select a valid destination.');
      destInput.focus();
      return;
    }
    if (nationality === destination) {
      showFieldError('err-destination', 'Destination must differ from nationality.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/check-visa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nationality, destination, transit: transitArray })
      });
      if (!res.ok) throw new Error('Server error');
      const data = await res.json();
      renderResults(data);
    } catch {
      showError('Something went wrong — please try again.');
    } finally {
      setLoading(false);
    }
  });

  // ── Render Results ────────────────────────────────────────────────
  function renderResults(data) {
    resultsSec.classList.remove('hidden');
    resultsSec.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Route heading
    document.getElementById('result-route').textContent =
      `${data.nationality}  →  ${data.destination}`;

    // Status badge
    const badgeEl = document.getElementById('result-status');
    const visa = data.visa;
    const vType = visa.visaType || '';
    const badgeClass = visa.visaRequired
      ? (vType.includes('e-Visa') || vType.includes('eTA') || vType.includes('ESTA') || vType.includes('ETA'))
        ? 'visa-evisa'
        : (vType.includes('on Arrival'))
          ? 'visa-arrival'
          : 'visa-required'
      : 'visa-free';
    badgeEl.className = `status-badge ${badgeClass}`;
    badgeEl.textContent = visa.visaRequired ? vType || 'Visa Required' : 'Visa-Free';

    // Info table
    const tbody = document.querySelector('#result-table tbody');
    tbody.innerHTML = '';
    const rows = [];
    if (visa.visaType)           rows.push(['Type', visa.visaType]);
    if (visa.maxStay)            rows.push(['Max Stay', visa.maxStay]);
    rows.forEach(([label, val]) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${escapeHtml(val)}</td>`;
      tbody.appendChild(tr);
    });

    // Documents — only show entry/travel authorization documents
    const docsEl = document.getElementById('result-documents');
    docsEl.innerHTML = '';
    if (visa.documents && visa.documents.length) {
      const entryKeywords = ['passport', 'visa', 'esta', 'eta', 'evisa', 'e-visa', 'evisitor',
        'tourist card', 'tarjeta', 'nzeta', 'asan', 'travel authorization', 'national id'];
      const entryDocs = visa.documents.filter(d =>
        entryKeywords.some(k => d.toLowerCase().includes(k))
      );
      if (entryDocs.length) {
        docsEl.innerHTML = `
          <div class="doc-list">
            <h4>Required Documents</h4>
            <ul>${entryDocs.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>
          </div>`;
      }
    }

    // Notes — show notes only (not the generic message)
    const notesEl = document.getElementById('result-notes');
    notesEl.textContent = visa.notes || '';

    // Application link
    const linkEl = document.getElementById('result-link');
    if (visa.applicationLink) {
      linkEl.href = visa.applicationLink;
      linkEl.classList.remove('hidden');
    } else {
      linkEl.classList.add('hidden');
    }

    // Transit results
    const transitWrap = document.getElementById('transit-results');
    transitWrap.innerHTML = '';
    if (data.transit && data.transit.length) {
      transitWrap.innerHTML = `<p class="transit-heading">Transit Requirements</p>` +
        data.transit.map(t => {
          const ok = !t.transitVisaRequired;
          return `<div class="transit-card ${ok ? 'transit-ok' : 'transit-warn'}">
            <h4>${escapeHtml(t.country)}</h4>
            <p>${ok ? 'Transit without visa allowed' : 'Transit visa required'}</p>
            ${t.notes ? `<p>${escapeHtml(t.notes)}</p>` : ''}
            ${t.applicationLink ? `<a href="${escapeAttr(t.applicationLink)}" target="_blank" rel="noopener noreferrer">Transit info →</a>` : ''}
          </div>`;
        }).join('');
    }

    // Summary box removed per user request
    const summaryBox = document.getElementById('summary-box');
    summaryBox.innerHTML = '';
    summaryBox.className = 'summary-box hidden';
  }

  // ── Helpers ───────────────────────────────────────────────────────
  function setLoading(on) {
    submitBtn.disabled = on;
    spinnerEl.classList.toggle('hidden', !on);
    submitBtn.querySelector('.btn-text').textContent = on ? 'Checking…' : 'Check Requirements';
  }

  function showFieldError(id, msg) {
    document.getElementById(id).textContent = msg;
  }

  function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
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

  function escapeAttr(str) {
    return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

      // Horizontal lines (latitude)
      ctx.strokeStyle = 'rgba(139,125,107,0.08)';
      ctx.lineWidth = 0.5;
      for (let y = drift % spacing; y < h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Vertical lines (longitude)
      const driftV = Math.cos(time * 0.7) * 6;
      for (let x = driftV % spacing; x < w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // Dot intersections
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
