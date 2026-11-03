/**
 * Coder animations for the portfolio:
 *  1. Geo network canvas in the hero (graticule + nodes + data packets, reacts to the mouse)
 *  2. Terminal that types out a profile summary
 *  3. Decode / scramble effect on section titles
 * Everything is skipped or shown instantly when the visitor prefers reduced motion.
 */
(function () {
  "use strict";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent-color").trim() || "#0563bb";

  function hexToRgb(hex) {
    const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [5, 99, 187];
  }
  const [AR, AG, AB] = hexToRgb(accent);
  const rgba = (a) => `rgba(${AR},${AG},${AB},${a})`;

  /* ------------------------------------------------------------------
   * 1. Geo network canvas
   * ------------------------------------------------------------------ */
  function initGeoCanvas() {
    const canvas = document.getElementById("geo-canvas");
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext("2d");
    const hero = canvas.parentElement;

    let w = 0, h = 0, dpr = 1;
    let nodes = [], packets = [];
    let mouse = { x: -9999, y: -9999 };
    let running = false, rafId = 0, t = 0;
    const LINK = 150;

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = hero.clientWidth;
      h = hero.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(70, Math.max(24, (w * h) / 22000)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 1.2,
      }));
      packets = [];
    }

    function drawGraticule() {
      ctx.lineWidth = 1;
      ctx.strokeStyle = rgba(0.07);
      const step = 70;
      const shift = (t * 0.15) % step;
      // meridians, bent slightly like a projection
      for (let x = -step + shift; x < w + step; x += step) {
        ctx.beginPath();
        for (let y = 0; y <= h; y += 20) {
          const bend = Math.sin((y / h) * Math.PI) * ((x - w / 2) / w) * 40;
          y === 0 ? ctx.moveTo(x + bend, y) : ctx.lineTo(x + bend, y);
        }
        ctx.stroke();
      }
      // parallels
      for (let y = step / 2; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    function step() {
      t++;
      ctx.clearRect(0, 0, w, h);
      drawGraticule();

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        // gentle pull towards the mouse
        const dx = mouse.x - n.x, dy = mouse.y - n.y;
        const d = Math.hypot(dx, dy);
        if (d < 180 && d > 1) {
          n.x += (dx / d) * 0.25;
          n.y += (dy / d) * 0.25;
        }
      }

      // links
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = rgba(0.22 * (1 - d / LINK));
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            if (packets.length < 18 && Math.random() < 0.0015) packets.push({ a, b, p: 0 });
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < 180) {
          ctx.strokeStyle = rgba(0.35 * (1 - md / 180));
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      // nodes (map pins)
      for (const n of nodes) {
        ctx.fillStyle = rgba(0.55);
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // packets travelling along links
      packets = packets.filter((k) => k.p <= 1 && Math.hypot(k.a.x - k.b.x, k.a.y - k.b.y) < LINK * 1.2);
      for (const k of packets) {
        k.p += 0.015;
        const x = k.a.x + (k.b.x - k.a.x) * k.p;
        const y = k.a.y + (k.b.y - k.a.y) * k.p;
        ctx.fillStyle = rgba(0.9);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgba(0.15);
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      if (running) rafId = requestAnimationFrame(step);
    }

    function start() {
      if (running || reduceMotion) return;
      running = true;
      rafId = requestAnimationFrame(step);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(rafId);
    }

    resize();
    if (reduceMotion) {
      step(); // one static frame
      return;
    }

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 150);
    });
    hero.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    hero.addEventListener("mouseleave", () => {
      mouse.x = mouse.y = -9999;
    });

    // only animate while the hero is on screen and the tab is visible
    let visible = true;
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        visible && !document.hidden ? start() : stop();
      }).observe(hero);
    }
    document.addEventListener("visibilitychange", () => {
      document.hidden || !visible ? stop() : start();
    });
    start();
  }

  /* ------------------------------------------------------------------
   * 2. Terminal typing
   * ------------------------------------------------------------------ */
  const SCRIPT = [
    { cmd: "whoami" },
    { out: [["v", "souvik-das"], ["c", "  # full-stack engineer & team lead"]] },
    { cmd: "cat profile.json" },
    { out: [["p", "{"]] },
    { out: [["k", '  "domain"'], ["p", ": "], ["s", '"GIS & Geospatial"'], ["p", ","]] },
    { out: [["k", '  "experience"'], ["p", ": "], ["s", '"4+ years"'], ["p", ","]] },
    { out: [["k", '  "systemDesign"'], ["p", ": "], ["b", "true"], ["p", ","]] },
    { out: [["k", '  "security"'], ["p", ": "], ["s", '"VAPT-aware"'], ["p", ","]] },
    { out: [["k", '  "stack"'], ["p", ": "], ["s", '"whatever fits the problem"'], ["p", ","]] },
    { out: [["k", '  "learning"'], ["p", ": "], ["s", '"every single day"']] },
    { out: [["p", "}"]] },
    { cmd: "./experiment --run" },
    { out: [["ok", "✔ "], ["p", "idea → prototype → production"]] },
  ];

  function el(cls, text) {
    const span = document.createElement("span");
    if (cls) span.className = "t-" + cls;
    span.textContent = text;
    return span;
  }

  function initTerminal() {
    const body = document.getElementById("term-body");
    if (!body) return;

    const prompt = () => {
      const f = document.createDocumentFragment();
      f.append(el("u", "souvik@dev"), el("p", ":"), el("d", "~"), el("p", "$ "));
      return f;
    };

    if (reduceMotion) {
      for (const line of SCRIPT) {
        if (line.cmd) body.append(prompt(), el("cmd", line.cmd), "\n");
        else { line.out.forEach(([c, t]) => body.append(el(c, t))); body.append("\n"); }
      }
      body.append(prompt());
      return;
    }

    const cursor = el("cursor", "▋");
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    async function play() {
      body.textContent = "";
      body.append(cursor);
      for (const line of SCRIPT) {
        if (line.cmd) {
          body.insertBefore(prompt(), cursor);
          await sleep(350);
          const span = el("cmd", "");
          body.insertBefore(span, cursor);
          for (const ch of line.cmd) {
            span.textContent += ch;
            await sleep(45 + Math.random() * 55);
          }
          await sleep(300);
        } else {
          for (const [c, t] of line.out) body.insertBefore(el(c, t), cursor);
          await sleep(110);
        }
        body.insertBefore(document.createTextNode("\n"), cursor);
      }
      body.insertBefore(prompt(), cursor);
      await sleep(9000);
      play();
    }

    // start when the terminal is first seen
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          io.disconnect();
          setTimeout(play, 600);
        }
      });
      io.observe(body);
    } else {
      play();
    }
  }

  /* ------------------------------------------------------------------
   * 3. Decode effect on section titles
   * ------------------------------------------------------------------ */
  function initDecode() {
    if (reduceMotion || !("IntersectionObserver" in window)) return;
    const GLYPHS = "01<>/{}[]#$&*+=;:_";
    const titles = document.querySelectorAll(".section-title h2");

    function decode(node) {
      const final = node.dataset.text;
      const frames = 22;
      let frame = 0;
      const tick = () => {
        const reveal = Math.floor((frame / frames) * final.length);
        let out = "";
        for (let i = 0; i < final.length; i++) {
          if (i < reveal || final[i] === " ") out += final[i];
          else out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        }
        node.textContent = out;
        if (frame++ < frames) requestAnimationFrame(() => setTimeout(tick, 28));
        else node.textContent = final;
      };
      tick();
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          io.unobserve(e.target);
          decode(e.target);
        }
      });
    }, { threshold: 0.6 });

    titles.forEach((t) => {
      t.dataset.text = t.textContent;
      t.setAttribute("aria-label", t.textContent);
      io.observe(t);
    });
  }

  function init() {
    initGeoCanvas();
    initTerminal();
    initDecode();
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
