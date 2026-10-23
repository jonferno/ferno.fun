/* ============================================================
   FERNO.fun — music page
   Renders the Suno catalogue and drives one shared <audio> element.
   ============================================================ */

(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const tracks = window.FERNO_TRACKS || [];

  const list = $("#tracks");
  const audio = $("#audio");
  const npCover = $("#np-cover");
  const npTitle = $("#np-title");
  const npSub = $("#np-sub");
  const npTime = $("#np-time");
  const npProgress = $("#np-progress");
  const countEl = $("#track-count");

  if (countEl) countEl.textContent = `${tracks.length} TRACKS`;

  /* ── ticker ───────────────────────────────────────────────────── */
  const tickerEl = $("#ticker");
  if (tickerEl) {
    tickerEl.textContent =
      "FERNO.FUN // MUSIC GENERATION // GLITCH-HOP // LO-FI // DRUM AND BASS // " +
      "ALL TRACKS MADE WITH SUNO // " +
      "CLICK A TRACK TO PLAY // ";
  }

  /* ── render the list ──────────────────────────────────────────── */

  const fmt = (s) => {
    if (!isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  tracks.forEach((t, i) => {
    const row = document.createElement("article");
    row.className = "track";
    row.dataset.index = String(i);
    row.innerHTML = `
      <button class="track__play" type="button" aria-label="Play ${t.title}" aria-pressed="false">
        <span class="track__playicon" aria-hidden="true">▶</span>
      </button>
      <div class="track__art" style="background-image:url('${t.cover}')" role="img" aria-label="Cover art for ${t.title}"></div>
      <div class="track__body">
        <div class="track__title">${t.title}</div>
        <div class="track__tags">
          <span class="track__genre">${t.genre}</span>
          ${t.instrumental ? '<span class="track__tag">INSTRUMENTAL</span>' : ""}
          <span class="track__plays">${t.plays} PLAYS</span>
        </div>
      </div>
      <div class="track__time">${t.time}</div>
      <a class="track__suno" href="https://suno.com/song/${t.id}" target="_blank" rel="noopener noreferrer" aria-label="Open ${t.title} on Suno">SUNO ↗</a>
    `;
    list.appendChild(row);
  });

  const rows = [...list.querySelectorAll(".track")];

  /* ── player ───────────────────────────────────────────────────── */

  let currentIndex = -1;

  function setNowPlaying(t) {
    npCover.style.backgroundImage = `url('${t.cover}')`;
    npCover.classList.add("is-on");
    npTitle.textContent = t.title;
    npSub.textContent = `${t.genre} · ${t.instrumental ? "INSTRUMENTAL" : "WITH VOCALS"}`;
  }

  function clearNowPlaying() {
    npCover.classList.remove("is-on");
    npTitle.textContent = "NOTHING PLAYING";
    npSub.textContent = "pick a track";
    npTime.textContent = "0:00";
    npProgress.style.width = "0%";
  }

  function markActive(index) {
    rows.forEach((r, i) => {
      const on = i === index;
      r.classList.toggle("is-playing", on);
      const btn = r.querySelector(".track__play");
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.querySelector(".track__playicon").textContent = on ? "❚❚" : "▶";
      btn.setAttribute("aria-label", on ? `Pause ${tracks[i].title}` : `Play ${tracks[i].title}`);
    });
  }

  function play(index) {
    const t = tracks[index];
    if (!t) return;
    if (currentIndex === index && !audio.paused) {
      audio.pause();
      return;
    }
    currentIndex = index;
    audio.src = t.audio;
    audio.play().catch(() => {
      // autoplay policy or a network hiccup: surface it instead of failing silently
      npSub.textContent = "could not start playback — tap play again";
    });
    setNowPlaying(t);
    markActive(index);
  }

  rows.forEach((row, i) => {
    row.querySelector(".track__play").addEventListener("click", (e) => {
      e.stopPropagation();
      play(i);
    });
    row.addEventListener("click", (e) => {
      if (e.target.closest(".track__suno")) return;
      play(i);
    });
  });

  audio.addEventListener("timeupdate", () => {
    const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    npProgress.style.width = `${pct}%`;
    npTime.textContent = fmt(audio.currentTime);
  });

  audio.addEventListener("ended", () => {
    const next = currentIndex + 1;
    if (next < tracks.length) {
      play(next);
    } else {
      currentIndex = -1;
      markActive(-1);
      clearNowPlaying();
    }
  });

  audio.addEventListener("pause", () => {
    if (currentIndex >= 0) markActive(currentIndex);
  });

  audio.addEventListener("play", () => {
    if (currentIndex >= 0) markActive(currentIndex);
  });

  audio.addEventListener("error", () => {
    if (!audio.src) return;
    npSub.textContent = "stream unavailable — try again";
  });

  /* ── keyboard: space toggles the current track ────────────────── */
  window.addEventListener("keydown", (e) => {
    if (e.code !== "Space") return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (currentIndex < 0) return;
    e.preventDefault();
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  clearNowPlaying();

  /* ── ember particles (shared with the landing page) ────────────── */

  const emberCanvas = document.getElementById("embers");
  if (emberCanvas) {
    const ectx = emberCanvas.getContext("2d");
    let embers = [];
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    function size() {
      emberCanvas.width = Math.floor(window.innerWidth * dpr);
      emberCanvas.height = Math.floor(window.innerHeight * dpr);
      ectx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawn() {
      embers.push({
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + 10,
        vx: (Math.random() - 0.5) * 0.35,
        vy: -(0.5 + Math.random() * 1.5),
        life: 1,
        decay: 0.004 + Math.random() * 0.008,
        size: 1 + Math.floor(Math.random() * 3),
        warm: Math.random() < 0.7
      });
    }

    function draw() {
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
      if (embers.length < 70 && Math.random() < 0.4) spawn();
      requestAnimationFrame(draw);
    }

    size();
    window.addEventListener("resize", size);
    draw();
  }
})();
