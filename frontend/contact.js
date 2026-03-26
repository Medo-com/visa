/* ===================================================================
   CONTACT PAGE — Form handling + Grid canvas + Nav toggle
   =================================================================== */

(function () {
  'use strict';

  /* ---------- Grid canvas (same as other pages) ---------- */
  const canvas = document.getElementById('grid-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h;
    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      const gap = 60;
      const off = (t * 0.008) % gap;
      ctx.strokeStyle = 'rgba(139,125,107,0.10)';
      ctx.lineWidth = 0.5;
      for (let x = -gap + off; x < w + gap; x += gap) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = -gap + off; y < h + gap; y += gap) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      requestAnimationFrame(draw);
    }
    window.addEventListener('resize', resize);
    resize();
    requestAnimationFrame(draw);
  }

  /* ---------- Mobile nav toggle ---------- */
  const toggle = document.getElementById('nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }

  /* ---------- Form elements ---------- */
  const form      = document.getElementById('contact-form');
  const nameIn    = document.getElementById('contact-name');
  const emailIn   = document.getElementById('contact-email');
  const subjectIn = document.getElementById('contact-subject');
  const messageIn = document.getElementById('contact-message');
  const btn       = document.getElementById('contact-btn');
  const successEl = document.getElementById('contact-success');
  const errorEl   = document.getElementById('contact-error-banner');

  const nameErr    = document.getElementById('name-error');
  const emailErr   = document.getElementById('email-error');
  const subjectErr = document.getElementById('subject-error');
  const messageErr = document.getElementById('message-error');

  /* ---------- Validation ---------- */
  function validate() {
    let ok = true;
    nameErr.textContent = emailErr.textContent = subjectErr.textContent = messageErr.textContent = '';

    if (!nameIn.value.trim()) { nameErr.textContent = 'Please enter your name.'; ok = false; }
    if (!emailIn.value.trim()) { emailErr.textContent = 'Please enter your email.'; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn.value.trim())) {
      emailErr.textContent = 'Please enter a valid email address.'; ok = false;
    }
    if (!subjectIn.value.trim()) { subjectErr.textContent = 'Please enter a subject.'; ok = false; }
    if (!messageIn.value.trim()) { messageErr.textContent = 'Please enter a message.'; ok = false; }

    return ok;
  }

  /* ---------- Submit ---------- */
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    successEl.hidden = true;
    errorEl.hidden = true;

    if (!validate()) return;

    btn.disabled = true;
    btn.textContent = 'Sending…';

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    nameIn.value.trim(),
          email:   emailIn.value.trim(),
          subject: subjectIn.value.trim(),
          message: messageIn.value.trim()
        })
      });

      if (!res.ok) throw new Error('Server error');

      form.hidden = true;
      successEl.hidden = false;
    } catch {
      errorEl.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  });
})();
