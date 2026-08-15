/* ============================================================
   Edulixa 360 — Level 1 · shared behaviour
   1. EN/AR language toggle (full page, RTL mirroring, persisted)
   2. Copy-to-clipboard for editable prompt boxes
   3. Optional images — hide a figure whose file is not present yet
   4. Rail steps that light up when selected (state remembered)
   5. The clickable screen replica and its explanation popup
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'edulixa-l1-lang';

  /* ---------- 1. Language ---------- */
  function apply(lang) {
    var isAr = lang === 'ar';
    var root = document.documentElement;
    root.setAttribute('lang', isAr ? 'ar' : 'en');
    root.setAttribute('dir', isAr ? 'rtl' : 'ltr');

    // Plain text nodes
    document.querySelectorAll('[data-en]').forEach(function (el) {
      var v = isAr ? el.getAttribute('data-ar') : el.getAttribute('data-en');
      if (v !== null) el.textContent = v;
    });
    // Rich (HTML) nodes
    document.querySelectorAll('[data-en-html]').forEach(function (el) {
      var v = isAr ? el.getAttribute('data-ar-html') : el.getAttribute('data-en-html');
      if (v !== null) el.innerHTML = v;
    });
    // Placeholders
    document.querySelectorAll('[data-en-ph]').forEach(function (el) {
      var v = isAr ? el.getAttribute('data-ar-ph') : el.getAttribute('data-en-ph');
      if (v !== null) el.setAttribute('placeholder', v);
    });
    // Accessible labels
    document.querySelectorAll('[data-en-label]').forEach(function (el) {
      var v = isAr ? el.getAttribute('data-ar-label') : el.getAttribute('data-en-label');
      if (v !== null) el.setAttribute('aria-label', v);
    });
    // Document title
    var t = document.querySelector('title');
    if (t && t.getAttribute('data-ar')) {
      document.title = isAr ? t.getAttribute('data-ar') : t.getAttribute('data-en');
    }
    // Toggle buttons show the language you can switch TO
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.textContent = isAr ? 'English' : 'العربية';
      b.setAttribute('aria-label', isAr ? 'Switch to English' : 'التبديل إلى العربية');
      b.setAttribute('lang', isAr ? 'en' : 'ar');
    });

    // A popup holds a copy of its source text, so close it when the language flips
    var openPop = document.getElementById('pop');
    if (openPop && openPop.open) openPop.close();

    try { localStorage.setItem(KEY, lang); } catch (e) {}
  }

  function current() {
    try { return localStorage.getItem(KEY) === 'ar' ? 'ar' : 'en'; } catch (e) { return 'en'; }
  }

  function init() {
    apply(current());
    document.querySelectorAll('[data-lang-toggle]').forEach(function (b) {
      b.addEventListener('click', function () {
        apply(current() === 'ar' ? 'en' : 'ar');
      });
    });

    /* ---------- 2. Copy buttons ---------- */
    /* A prompt box is either a <textarea> or a contenteditable div (the latter so the
       [FIELDS] a teacher must replace can be highlighted). Both are handled here. */
    var isEditable = function (box) { return box.tagName !== 'TEXTAREA'; };
    var readBox = function (box) { return isEditable(box) ? box.innerText : box.value; };

    /* file:// is not a secure context, so the course is normally opened with the
       async Clipboard API unavailable. The hidden-textarea path is the one that
       actually runs offline — keep it. */
    function copyText(text, done) {
      var legacy = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;left:0;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        done();
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done, legacy);
      } else { legacy(); }
    }

    document.querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = document.getElementById(btn.getAttribute('data-copy'));
        if (!box) return;
        copyText(readBox(box), function () {
          var note = btn.parentNode.querySelector('.copied');
          if (!note) return;
          note.textContent = document.documentElement.getAttribute('dir') === 'rtl'
            ? '✓ تم النسخ' : '✓ Copied';
          setTimeout(function () { note.textContent = ''; }, 2400);
        });
      });
    });

    /* Reset an edited prompt back to its original text */
    document.querySelectorAll('[data-reset]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var box = document.getElementById(btn.getAttribute('data-reset'));
        if (!box || box.dataset.original === undefined) return;
        if (isEditable(box)) box.innerHTML = box.dataset.original;
        else box.value = box.dataset.original;
      });
    });
    document.querySelectorAll('.prompt-box').forEach(function (box) {
      box.dataset.original = isEditable(box) ? box.innerHTML : box.value;
    });

    /* Click a highlighted field to select the whole thing, so typing replaces it */
    document.querySelectorAll('.prompt-box .ph').forEach(function (ph) {
      ph.addEventListener('click', function () {
        var r = document.createRange();
        r.selectNodeContents(ph);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      });
    });

    /* ---------- 3. Optional images ---------- */
    /* A figure whose screenshot has not been dropped into assets/ yet hides itself
       instead of showing a broken-image icon. Add the file and it appears. */
    /* ---------- 4. Rail step lamps ---------- */
    /* Each step in "Session at a glance" is a switch: selecting it jumps to that
       part of the page and turns its light on. The lights are remembered per page. */
    var railItems = document.querySelectorAll('.rail ol li');
    if (railItems.length) {
      var lampKey = 'edulixa-l1-lit:' + (location.pathname.split('/').pop() || 'index');
      var lit = {};
      try { lit = JSON.parse(localStorage.getItem(lampKey) || '{}') || {}; } catch (e) { lit = {}; }

      railItems.forEach(function (li, i) {
        li.setAttribute('role', 'button');
        li.setAttribute('tabindex', '0');
        if (lit[i]) li.classList.add('is-lit');
        li.setAttribute('aria-pressed', lit[i] ? 'true' : 'false');

        var flip = function () {
          var on = li.classList.toggle('is-lit');
          li.setAttribute('aria-pressed', on ? 'true' : 'false');
          lit[i] = on ? 1 : 0;
          try { localStorage.setItem(lampKey, JSON.stringify(lit)); } catch (e) {}
          var go = li.getAttribute('data-go');
          if (on && go) {
            var target = document.getElementById(go);
            if (target) target.scrollIntoView({ block: 'start' });
          }
        };

        li.addEventListener('click', flip);
        li.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); flip(); }
        });
      });
    }

    /* ---------- 5. Screen replica → explanation popup ---------- */
    var pop = document.getElementById('pop');
    if (pop) {
      var popBody = pop.querySelector('.pop-body');
      var opener = null;

      var openPopup = function (id, trigger) {
        var src = document.getElementById(id);
        if (!src || !popBody) return;
        popBody.innerHTML = src.innerHTML;   // already in the current language
        opener = trigger || null;
        if (trigger) trigger.classList.add('is-seen');
        if (typeof pop.showModal === 'function') { pop.showModal(); }
        else { pop.setAttribute('open', ''); }
        var c = pop.querySelector('.pop-close');
        if (c) c.focus();
      };

      document.querySelectorAll('[data-pop]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openPopup(btn.getAttribute('data-pop'), btn);
        });
      });

      pop.querySelectorAll('[data-pop-close]').forEach(function (b) {
        b.addEventListener('click', function () { pop.close(); });
      });
      /* Clicking the dimmed area behind the card closes it */
      pop.addEventListener('click', function (e) { if (e.target === pop) pop.close(); });
      pop.addEventListener('close', function () {
        if (opener) { opener.focus(); opener = null; }
      });
    }

    document.querySelectorAll('img[data-optional]').forEach(function (img) {
      var hide = function () {
        var f = img.closest('figure');
        if (f) f.hidden = true;
      };
      img.addEventListener('error', hide);
      if (img.complete && img.naturalWidth === 0) hide();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
