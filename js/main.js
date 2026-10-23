/* ============================================================
   FERNO.fun — UI layer
   ============================================================ */

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ?static=1 freezes entrance animations at their final state (used for
  // screenshots and for anyone who wants the page without motion)
  if (new URLSearchParams(location.search).has("static")) {
    document.documentElement.classList.add("is-static");
  }

  const landing = $("#landing");
  const hub = $("#hub");
  const enter = $("#enter");
  const back = $("#back");
  const toast = $("#toast");
  const clock = $("#clock");

  /* ── screen routing ───────────────────────────────────────────── */

  let current = "landing";

  function showHub() {
    if (current === "hub") return;
    current = "hub";
    landing.classList.add("is-leaving");
    setTimeout(() => {
      landing.classList.remove("is-active", "is-leaving");
      landing.setAttribute("aria-hidden", "true");
      hub.classList.add("is-active");
      hub.setAttribute("aria-hidden", "false");
      window.scrollTo(0, 0);
    }, 420);
  }

  function showLanding() {
    if (current === "landing") return;
    current = "landing";
    hub.classList.add("is-leaving");
    setTimeout(() => {
      hub.classList.remove("is-active", "is-leaving");
      hub.setAttribute("aria-hidden", "true");
      landing.classList.add("is-active");
      landing.setAttribute("aria-hidden", "false");
    }, 420);
  }

  enter.addEventListener("click", showHub);
  back.addEventListener("click", showLanding);

  // ?hub=1 opens straight into the destination list (deep link / capture)
  if (new URLSearchParams(location.search).has("hub")) {
    landing.classList.remove("is-active");
    landing.setAttribute("aria-hidden", "true");
    hub.classList.add("is-active");
    hub.setAttribute("aria-hidden", "false");
    current = "hub";
  }

  // keyboard: Enter to enter, Escape to go back
  window.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && current === "landing" && document.activeElement !== enter) {
      showHub();
    }
    if (e.key === "Escape" && current === "hub") {
      showLanding();
    }
  });

  /* ── toast ────────────────────────────────────────────────────── */

  let toastTimer = null;

  function say(html, ms = 3200) {
    toast.innerHTML = html;
    toast.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("is-on"), ms);
  }

  /* ── discord copy ─────────────────────────────────────────────── */

  document.querySelectorAll("[data-copy]").forEach((el) => {
    el.addEventListener("click", async (e) => {
      e.preventDefault();
      const value = el.dataset.copy;
      try {
        await navigator.clipboard.writeText(value);
        say(`Copied <b>${value}</b> to clipboard. Add me on Discord.`);
      } catch (err) {
        say(`Discord handle: <b>${value}</b> (copy it manually — clipboard was blocked).`);
      }
    });
  });

  /* ── planned-section feedback ─────────────────────────────────── */

  document.querySelectorAll("[data-planned]").forEach((el) => {
    el.addEventListener("click", () => {
      say(`<b>${el.dataset.planned}</b> is still on the bench. Check back after it catches fire.`);
    });
  });

  /* ── clock ────────────────────────────────────────────────────── */

  function tickClock() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    clock.textContent = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  tickClock();
  setInterval(tickClock, 1000);

  /* ── ticker ───────────────────────────────────────────────────── */

  const tickerLines = [
    "FERNO.FUN // PERSONAL PLAYGROUND // GAME MODDING // MUSIC GENERATION // SHENANIGANS // ",
    "NO TRACKING // NO SERVERS // ALL CLIENT SIDE // PIXEL FIRE ENGINE ONLINE // ",
    "IF IT IS ON FIRE, IT IS PROBABLY MY FAULT // ",
    "MODS LOADING... MUSIC SYNTHESIZING... CHAOS NOMINAL // "
  ];
  const tickerEl = $("#ticker");
  tickerEl.textContent = tickerLines.join("  ///  ");

  /* ── ember particles (2D overlay) ─────────────────────────────── */

  const emberCanvas = document.getElementById("embers");
  const ectx = emberCanvas.getContext("2d");
  let embers = [];
  let dpr = Math.min(2, window.devicePixelRatio || 1);

  function sizeEmbers() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    emberCanvas.width = Math.floor(window.innerWidth * dpr);
    emberCanvas.height = Math.floor(window.innerHeight * dpr);
    ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawnEmber() {
    const fromPointer = Math.random() < 0.35 && pointerState.inside;
    let x, y;
    if (fromPointer) {
      x = pointerState.x + (Math.random() - 0.5) * 40;
      y = pointerState.y + (Math.random() - 0.5) * 40;
    } else {
      x = Math.random() * window.innerWidth;
      y = window.innerHeight + 10;
    }
    embers.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 0.35,
      vy: -(0.5 + Math.random() * 1.5),
      life: 1,
      decay: 0.004 + Math.random() * 0.008,
      size: 1 + Math.floor(Math.random() * 3),
      warm: Math.random() < 0.7
    });
  }

  const pointerState = { x: 0, y: 0, inside: false };

  window.addEventListener("pointermove", (e) => {
    pointerState.x = e.clientX;
    pointerState.y = e.clientY;
    pointerState.inside = true;
  }, { passive: true });

  window.addEventListener("pointerleave", () => { pointerState.inside = false; });

  function drawEmbers() {
    ectx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i];
      e.x += e.vx;
      e.y += e.vy;
      e.vy -= 0.004;
      e.vx += (Math.random() - 0.5) * 0.06;
      e.life -= e.decay;
      if (e.life <= 0 || e.y < -20) {
        embers.splice(i, 1);
        continue;
      }
      const a = Math.max(0, Math.min(1, e.life));
      ectx.globalAlpha = a * 0.9;
      ectx.fillStyle = e.warm
        ? `rgb(255, ${Math.floor(140 + 90 * a)}, ${Math.floor(40 + 60 * a)})`
        : `rgb(${Math.floor(90 + 80 * a)}, ${Math.floor(160 + 60 * a)}, 255)`;
      ectx.fillRect(Math.round(e.x), Math.round(e.y), e.size, e.size);
    }
    ectx.globalAlpha = 1;

    if (embers.length < 90 && Math.random() < 0.5) spawnEmber();
    requestAnimationFrame(drawEmbers);
  }

  sizeEmbers();
  window.addEventListener("resize", sizeEmbers);
  drawEmbers();

  /* ── card hover parallax ──────────────────────────────────────── */
  const cards = document.querySelectorAll(".card");
  cards.forEach((card) => {
    card.addEventListener("pointermove", (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty("--px", `${px * 6}px`);
      card.style.setProperty("--py", `${py * 6}px`);
      card.style.transform = `translateY(-6px) translate(${px * 6}px, ${py * 6}px)`;
    });
    card.addEventListener("pointerleave", () => {
      card.style.transform = "";
    });
  });
})();
