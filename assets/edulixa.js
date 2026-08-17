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

    // Anything that writes its own text (the game score and its messages) listens here
    try {
      document.dispatchEvent(new CustomEvent('edulixa:lang', { detail: { lang: lang } }));
    } catch (e) {}
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

    /* ---------- 6. The RCTF matching game ---------- */
    /* Drag a fragment of a real prompt onto the letter it belongs to, or select the
       fragment and then select the letter. Every word the teacher reads comes from
       data- attributes in the HTML, so the game can be reworded without touching this. */
    var game = document.getElementById('rctf-game');
    if (game) {
      var pool = game.querySelector('.game-pool');
      var msgEl = game.querySelector('.game-msg');
      var scoreEl = game.querySelector('.game-score');
      var zones = [].slice.call(game.querySelectorAll('.zone'));
      var frags = [].slice.call(game.querySelectorAll('.frag'));
      var held = null;

      var isAr = function () {
        return document.documentElement.getAttribute('dir') === 'rtl';
      };
      /* Arabic pages show Arabic-Indic numerals */
      var num = function (n) {
        if (!isAr()) return String(n);
        return String(n).replace(/[0-9]/g, function (d) {
          return String.fromCharCode(0x0660 + Number(d));
        });
      };
      var txt = function (name, el) {
        var host = el || game;
        return host.getAttribute('data-' + name + (isAr() ? '-ar' : '-en')) || '';
      };

      var setMsg = function (text, tone) {
        if (!msgEl) return;
        msgEl.textContent = text;
        msgEl.className = 'game-msg' + (tone ? ' ' + tone : '');
      };

      var isSet = function (f) { return f.classList.contains('is-set'); };
      var placedCount = function () {
        return frags.filter(isSet).length;
      };

      var paintScore = function () {
        if (!scoreEl) return;
        scoreEl.textContent = txt('score')
          .replace('{n}', num(placedCount()))
          .replace('{t}', num(frags.length));
      };

      var paintZones = function () {
        zones.forEach(function (z) {
          var box = z.querySelector('.zone-in');
          z.classList.toggle('is-full', !!(box && box.children.length));
        });
        if (pool) pool.classList.toggle('is-clear', placedCount() === frags.length);
      };

      var place = function (frag, zone) {
        if (!frag || !zone || isSet(frag)) return;
        frags.forEach(function (o) { o.classList.remove('is-held'); });
        if (frag.getAttribute('data-slot') === zone.getAttribute('data-drop')) {
          var box = zone.querySelector('.zone-in');
          if (box) box.appendChild(frag);
          frag.classList.add('is-set');
          frag.classList.remove('is-held');
          frag.setAttribute('aria-disabled', 'true');
          frag.setAttribute('tabindex', '-1');
          held = null;
          paintScore();
          paintZones();
          if (placedCount() === frags.length) {
            setMsg(txt('done'), 'is-done');
          } else {
            setMsg(txt('ok') + ' ' + txt('why', frag), 'is-good');
          }
        } else {
          frag.classList.add('is-wrong');
          setTimeout(function () { frag.classList.remove('is-wrong'); }, 470);
          setMsg(txt('no'), 'is-bad');
        }
      };

      var hold = function (frag) {
        if (isSet(frag)) return;
        var already = frag.classList.contains('is-held');
        frags.forEach(function (f) { f.classList.remove('is-held'); });
        held = already ? null : frag;
        if (held) {
          held.classList.add('is-held');
          setMsg(txt('held'), '');
        } else {
          setMsg('', '');
        }
      };

      /* --- Pointer dragging ---------------------------------------------
         Built on pointer events rather than the browser's own drag-and-drop, so
         the same code serves a mouse, a finger and a stylus. A line follows the
         pointer as a floating copy; the box under the pointer lights up. Below
         the movement threshold nothing drags and the press counts as a select. */
      var drag = null;

      var zoneUnder = function (x, y) {
        var el = document.elementFromPoint(x, y);
        return el ? el.closest('.zone') : null;
      };

      var lift = function (e) {
        if (!drag || drag.ghost) return;
        var f = drag.frag;
        var r = f.getBoundingClientRect();
        var g = f.cloneNode(true);
        g.classList.add('frag-ghost');
        g.style.width = r.width + 'px';
        g.style.left = r.left + 'px';
        g.style.top = r.top + 'px';
        document.body.appendChild(g);
        drag.ghost = g;
        drag.dx = drag.x0 - r.left;
        drag.dy = drag.y0 - r.top;
        f.classList.add('is-dragging');
        frags.forEach(function (o) { o.classList.remove('is-held'); });
        held = f;
        f.classList.add('is-held');
        setMsg(txt('held'), '');
      };

      var moveGhost = function (e) {
        if (!drag || !drag.ghost) return;
        drag.ghost.style.left = (e.clientX - drag.dx) + 'px';
        drag.ghost.style.top = (e.clientY - drag.dy) + 'px';
        var z = zoneUnder(e.clientX, e.clientY);
        /* Only when no box is under the pointer, creep the page so one can come into view */
        if (!z) {
          var pad = 46;
          if (e.clientY > window.innerHeight - pad) window.scrollBy(0, 14);
          else if (e.clientY < pad) window.scrollBy(0, -14);
        }
        zones.forEach(function (o) { o.classList.toggle('is-over', o === z); });
      };

      var onMove = function (e) {
        if (!drag) return;
        if (!drag.ghost) {
          if (Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 7) return;
          lift(e);
        }
        moveGhost(e);
      };

      var onUp = function (e) {
        if (!drag) return;
        var d = drag; drag = null;
        if (!d.ghost) return;                       // a press, not a drag
        d.ghost.remove();
        d.frag.classList.remove('is-dragging');
        zones.forEach(function (o) { o.classList.remove('is-over'); });
        d.frag.dataset.dragged = '1';               // stop the click that follows
        place(d.frag, zoneUnder(e.clientX, e.clientY));
      };

      var onCancel = function () {
        if (drag && drag.ghost) {
          drag.ghost.remove();
          drag.frag.classList.remove('is-dragging');
          zones.forEach(function (o) { o.classList.remove('is-over'); });
        }
        drag = null;
      };

      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onCancel);

      frags.forEach(function (frag) {
        frag.addEventListener('pointermove', onMove, { passive: false });
        frag.addEventListener('pointerup', onUp);
        frag.addEventListener('pointercancel', onCancel);
        frag.addEventListener('lostpointercapture', onCancel);
        frag.addEventListener('pointerdown', function (e) {
          if (isSet(frag) || e.button > 0) return;
          drag = { frag: frag, id: e.pointerId, x0: e.clientX, y0: e.clientY, ghost: null };
          /* Capture, so every later move and the release are delivered here even if
             the pointer leaves the line or the page scrolls underneath it. */
          try { frag.setPointerCapture(e.pointerId); } catch (err) {}
        });
        frag.addEventListener('click', function () {
          if (frag.dataset.dragged) { delete frag.dataset.dragged; return; }
          hold(frag);
        });
        frag.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); hold(frag); }
        });
      });

      zones.forEach(function (zone) {
        zone.addEventListener('click', function () {
          if (held) place(held, zone);
        });
        zone.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            if (held) place(held, zone);
          }
        });
      });

      /* Shuffle so the pool never gives the order away, and reset puts them back mixed */
      var shufflePool = function () {
        if (!pool) return;
        var kids = [].slice.call(pool.children);
        for (var i = kids.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var tmp = kids[i]; kids[i] = kids[j]; kids[j] = tmp;
        }
        kids.forEach(function (k) { pool.appendChild(k); });
      };

      var reset = function () {
        frags.forEach(function (f) {
          f.classList.remove('is-set', 'is-held', 'is-wrong', 'is-dragging');
          f.removeAttribute('aria-disabled');
          f.setAttribute('tabindex', '0');
          if (pool) pool.appendChild(f);
        });
        held = null;
        shufflePool();
        paintScore();
        paintZones();
        setMsg('', '');
      };

      game.querySelectorAll('[data-game-reset]').forEach(function (b) {
        b.addEventListener('click', reset);
      });

      document.addEventListener('edulixa:lang', function () {
        paintScore();
        setMsg('', '');
      });

      shufflePool();
      paintScore();
      paintZones();
    }

    /* ---------- Criteria cards ---------- */
    /* Each pastel card in a .crits grid opens on select to show its explanation.
       The card is a <button>, so Enter and Space work with no extra code. */
    document.querySelectorAll('.crit').forEach(function (card) {
      card.addEventListener('click', function () {
        var open = card.classList.toggle('is-open');
        card.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

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
