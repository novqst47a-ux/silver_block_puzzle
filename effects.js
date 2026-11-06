"use strict";

// Line-clear celebration: canvas fireworks, line sweep, big dancing portrait, screen shake.
const Effects = (() => {
  const Fireworks = (() => {
    const canvas = document.getElementById("fxCanvas");
    const ctx = canvas.getContext("2d");
    const palette = ["#ffd43b", "#ff4d5a", "#1ad678", "#478cff", "#ff9f1c", "#c066ff", "#ffffff"];
    let sparks = [];
    let rings = [];
    let ribbons = [];
    let stars = [];
    let timers = [];
    let rafId = 0;
    let dpr = 1;
    let width = 0;
    let height = 0;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBurstMotif(kind, x, y, r, rot, color, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.strokeStyle = "#fffef8";
      ctx.lineWidth = 1.6;
      ctx.lineJoin = "round";

      if (kind === "heart") {
        const s = r / 12;
        ctx.scale(s, s);
        ctx.beginPath();
        ctx.moveTo(0, 10);
        ctx.bezierCurveTo(-2, 8.2, -12, 1.5, -12, -4.8);
        ctx.bezierCurveTo(-12, -9.2, -8.5, -12, -4.6, -12);
        ctx.bezierCurveTo(-2, -12, -0.5, -10.4, 0, -8.8);
        ctx.bezierCurveTo(0.5, -10.4, 2, -12, 4.6, -12);
        ctx.bezierCurveTo(8.5, -12, 12, -9.2, 12, -4.8);
        ctx.bezierCurveTo(12, 1.5, 2, 8.2, 0, 10);
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      } else if (kind === "sun") {
        // Radiant mini sun: 8 rays + plump center disc
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.arc(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.24, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fill();
      } else if (kind === "star5") {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? r : r * 0.46;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.fill();
      } else {
        // Twinkle 4-point star
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const rad = i % 2 === 0 ? r : r * 0.34;
          const a = (i * Math.PI) / 4;
          if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
          else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    /* Radial Chrysanthemum Firework Burst + Mixed Sun/Heart/Star Motifs */
    function burst(xPct, yPct, count = 34, speedScale = 1) {
      resize();
      const cx = (xPct / 100) * width;
      const cy = (yPct / 100) * height;
      const mainColor = palette[Math.floor(Math.random() * 5)];
      const subColor = palette[(Math.floor(Math.random() * 5) + 2) % 6];

      rings.push({
        x: cx,
        y: cy,
        r: 8,
        maxR: 95 * speedScale,
        color: mainColor,
        life: 0,
        maxLife: 22
      });

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.14;
        const speed = (4.2 + Math.random() * 5.6) * speedScale;
        const col = i % 3 === 0 ? "#fff9db" : i % 2 === 0 ? mainColor : subColor;
        sparks.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: col,
          size: 2.4 + Math.random() * 1.8,
          trail: [{ x: cx, y: cy }],
          life: 0,
          maxLife: 34 + Math.floor(Math.random() * 16)
        });
      }

      const motifKinds = ["heart", "sun", "star5", "star4"];
      const motifColors = {
        heart: ["#ff4d6d", "#ff758f", "#ff8787"],
        sun: ["#ffb703", "#ffd43b", "#ffa94d"],
        star5: ["#ffd43b", "#4dabf7", "#38d9a9"],
        star4: ["#ffe066", "#ffffff"]
      };
      for (let i = 0; i < 10; i++) {
        const kind = motifKinds[Math.floor(Math.random() * motifKinds.length)];
        const cols = motifColors[kind];
        const angle = (i / 10) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
        const speed = (3.0 + Math.random() * 4.2) * speedScale;
        stars.push({
          kind,
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.7,
          r: 7.5 + Math.random() * 5.5,
          rot: (Math.random() - 0.5) * 0.5,
          vRot: (Math.random() - 0.5) * 0.1,
          color: cols[Math.floor(Math.random() * cols.length)],
          life: 0,
          maxLife: 38 + Math.floor(Math.random() * 14)
        });
      }

      ensureLoop();
    }

    /* Upward Party Cannons from Left & Right Flanks */
    function cannons(ribbonCount = 26) {
      resize();
      for (let side = 0; side < 2; side++) {
        const sx = side === 0 ? width * 0.1 : width * 0.9;
        const sy = height * 0.84;
        for (let i = 0; i < ribbonCount / 2; i++) {
          const dir = side === 0 ? -Math.PI * (0.28 + Math.random() * 0.22) : -Math.PI * (0.72 - Math.random() * 0.22);
          const speed = 7.5 + Math.random() * 6.5;
          ribbons.push({
            x: sx,
            y: sy,
            vx: Math.cos(dir) * speed,
            vy: Math.sin(dir) * speed,
            w: 9 + Math.random() * 5,
            h: 5 + Math.random() * 3,
            rot: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 0.28,
            flip: Math.random() * Math.PI * 2,
            vFlip: 0.18 + Math.random() * 0.16,
            color: palette[i % (palette.length - 1)],
            life: 0,
            maxLife: 54 + Math.floor(Math.random() * 20)
          });
        }
      }
      ensureLoop();
    }

    function step() {
      ctx.clearRect(0, 0, width, height);

      // 1. Shockwave rings
      rings = rings.filter(rg => {
        rg.life++;
        const t = rg.life / rg.maxLife;
        const curR = rg.r + (rg.maxR - rg.r) * (1 - Math.pow(1 - t, 3));
        ctx.save();
        ctx.globalAlpha = Math.max(0, (1 - t) * 0.75);
        ctx.strokeStyle = rg.color;
        ctx.lineWidth = Math.max(1, 5 * (1 - t));
        ctx.beginPath();
        ctx.arc(rg.x, rg.y, curR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        return rg.life < rg.maxLife;
      });

      // 2. Firework comet streaks
      sparks = sparks.filter(p => {
        p.life++;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 5) p.trail.shift();
        p.vx *= 0.945;
        p.vy = p.vy * 0.945 + 0.16;
        p.x += p.vx;
        p.y += p.vy;

        const t = p.life / p.maxLife;
        const alpha = Math.max(0, 1 - t * t);
        const twinkle = t > 0.6 && p.life % 3 === 0 ? 0.35 : 1;

        ctx.save();
        ctx.globalAlpha = alpha * twinkle;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * (1 - t * 0.45);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.trail[0].x, p.trail[0].y);
        for (let k = 1; k < p.trail.length; k++) ctx.lineTo(p.trail[k].x, p.trail[k].y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        // Hot white-gold tip
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.size * 0.65 * (1 - t * 0.5)), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        return p.life < p.maxLife;
      });

      // 3. Mixed Sun / Heart / Star Motifs
      stars = stars.filter(st => {
        st.life++;
        st.vx *= 0.95;
        st.vy = st.vy * 0.95 + 0.08;
        st.x += st.vx;
        st.y += st.vy;
        st.rot += st.vRot;
        const t = st.life / st.maxLife;
        drawBurstMotif(st.kind || "star4", st.x, st.y, st.r * (1 - t * 0.35), st.rot, st.color, Math.max(0, 1 - t));
        return st.life < st.maxLife;
      });

      // 4. 3D Tumbling Party-Cannon Ribbons
      ribbons = ribbons.filter(rb => {
        rb.life++;
        rb.vx *= 0.965;
        rb.vy = rb.vy * 0.965 + 0.24;
        rb.x += rb.vx + Math.sin(rb.life * 0.22) * 0.6;
        rb.y += rb.vy;
        rb.rot += rb.vRot;
        rb.flip += rb.vFlip;
        const t = rb.life / rb.maxLife;
        ctx.save();
        ctx.translate(rb.x, rb.y);
        ctx.rotate(rb.rot);
        ctx.scale(1, Math.max(0.2, Math.abs(Math.cos(rb.flip))));
        ctx.globalAlpha = Math.max(0, 1 - Math.pow(t, 2.2));
        ctx.fillStyle = rb.color;
        ctx.fillRect(-rb.w / 2, -rb.h / 2, rb.w, rb.h);
        ctx.restore();
        return rb.life < rb.maxLife;
      });

      if (sparks.length || rings.length || stars.length || ribbons.length) {
        rafId = requestAnimationFrame(step);
      } else {
        rafId = 0;
        ctx.clearRect(0, 0, width, height);
      }
    }

    function ensureLoop() {
      if (!rafId) rafId = requestAnimationFrame(step);
    }

    function clear() {
      timers.forEach(clearTimeout);
      timers = [];
      sparks = []; rings = []; ribbons = []; stars = [];
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      ctx.clearRect(0, 0, width, height);
    }

    function schedule(fn, ms) {
      timers.push(setTimeout(fn, ms));
    }

    function celebrate(count, isRecord) {
      clear();
      const tier = isRecord || count >= 3 ? 3 : count === 2 ? 2 : 1;

      if (tier === 1) {
        burst(50, 42, 34, 1.0);
        cannons(16);
        schedule(() => burst(Math.random() < 0.5 ? 25 : 75, 32, 24, 0.85), 150);
      } else if (tier === 2) {
        burst(50, 40, 42, 1.15);
        cannons(30);
        schedule(() => burst(22, 30, 30, 0.95), 110);
        schedule(() => burst(78, 30, 30, 0.95), 210);
        schedule(() => burst(50, 22, 28, 0.9), 330);
      } else {
        burst(50, 42, 48, 1.28);
        cannons(44);
        schedule(() => burst(20, 32, 34, 1.05), 95);
        schedule(() => burst(80, 32, 34, 1.05), 190);
        schedule(() => { burst(34, 20, 32, 1.0); cannons(24); }, 300);
        schedule(() => burst(66, 20, 36, 1.1), 420);
      }
    }

    return { celebrate, clear };
  })();

  /* Custom Vector Backdrop Halo & Sticker Charms (태양 · 하트 · 별 · 꽃 · 발바닥) */
  function createBackdropHaloSVG() {
    const svgNS = "http://www.w3.org/2000/svg";
    const halo = document.createElementNS(svgNS, "svg");
    halo.setAttribute("viewBox", "0 0 200 200");

    const modes = ["sun", "flower", "star", "heart"];
    const mode = modes[Math.floor(Math.random() * modes.length)];
    halo.setAttribute("class", mode === "heart" ? "hero-sunburst no-spin" : "hero-sunburst");

    if (mode === "sun") {
      halo.style.setProperty("--halo-color", "#ffc436");
      halo.style.setProperty("--halo-glow", "rgba(255, 196, 54, 0.65)");
      let pts = "";
      for (let i = 0; i < 32; i++) {
        const rad = i % 2 === 0 ? 96 : 68;
        const a = (i * Math.PI) / 16;
        pts += (100 + Math.cos(a) * rad).toFixed(1) + "," + (100 + Math.sin(a) * rad).toFixed(1) + " ";
      }
      const poly = document.createElementNS(svgNS, "polygon");
      poly.setAttribute("points", pts.trim());
      poly.setAttribute("fill", "currentColor");
      halo.append(poly);
    } else if (mode === "flower") {
      // Soft 12-petal scalloped sun-blossom
      halo.style.setProperty("--halo-color", "#ffb703");
      halo.style.setProperty("--halo-glow", "rgba(255, 169, 77, 0.65)");
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("cx", (100 + Math.cos(a) * 68).toFixed(1));
        c.setAttribute("cy", (100 + Math.sin(a) * 68).toFixed(1));
        c.setAttribute("r", "26");
        c.setAttribute("fill", "currentColor");
        halo.append(c);
      }
      const center = document.createElementNS(svgNS, "circle");
      center.setAttribute("cx", "100"); center.setAttribute("cy", "100"); center.setAttribute("r", "72");
      center.setAttribute("fill", "currentColor");
      halo.append(center);
    } else if (mode === "star") {
      // Friendly rounded 10-point star badge
      halo.style.setProperty("--halo-color", "#ffd43b");
      halo.style.setProperty("--halo-glow", "rgba(255, 224, 102, 0.7)");
      let pts = "";
      for (let i = 0; i < 20; i++) {
        const rad = i % 2 === 0 ? 96 : 70;
        const a = (i * Math.PI) / 10;
        pts += (100 + Math.cos(a) * rad).toFixed(1) + "," + (100 + Math.sin(a) * rad).toFixed(1) + " ";
      }
      const poly = document.createElementNS(svgNS, "polygon");
      poly.setAttribute("points", pts.trim());
      poly.setAttribute("fill", "currentColor");
      poly.setAttribute("stroke", "currentColor");
      poly.setAttribute("stroke-width", "8");
      poly.setAttribute("stroke-linejoin", "round");
      halo.append(poly);
    } else {
      // Warm coral-pink pulsing big heart aura
      halo.style.setProperty("--halo-color", "#ff758f");
      halo.style.setProperty("--halo-glow", "rgba(255, 107, 139, 0.65)");
      const path = document.createElementNS(svgNS, "path");
      path.setAttribute("d", "M100 188 C88 178 10 124 10 66 C10 30 38 8 68 8 C84 8 95 16 100 26 C105 16 116 8 132 8 C162 8 190 30 190 66 C190 124 112 178 100 188 Z");
      path.setAttribute("fill", "currentColor");
      halo.append(path);
    }

    return halo;
  }

  function createCharmSVG(kind) {
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 36 36");
    svg.setAttribute("class", "hero-charm");

    if (kind === "heart") {
      const colors = ["#ff4d6d", "#ff758f", "#fa5252"];
      const col = colors[Math.floor(Math.random() * colors.length)];
      svg.innerHTML = `
        <path d="M18 31 C16 29.2 4 20.8 4 12.2 C4 7.2 8 3.8 12.6 3.8 C15.4 3.8 17.1 5.2 18 6.9 C18.9 5.2 20.6 3.8 23.4 3.8 C28 3.8 32 7.2 32 12.2 C32 20.8 20 29.2 18 31 Z"
          fill="${col}" stroke="#fffef8" stroke-width="3.2" stroke-linejoin="round" style="paint-order:stroke fill"/>
        <ellipse cx="11.8" cy="11" rx="3" ry="1.8" transform="rotate(-28 11.8 11)" fill="rgba(255,255,255,0.65)"/>`;
    } else if (kind === "sun") {
      let rays = "";
      for (let i = 0; i < 8; i++) {
        const a = (i * 45);
        rays += `<rect x="15.8" y="2" width="4.4" height="7" rx="2.2" transform="rotate(${a} 18 18)" fill="#ffb703" stroke="#fffef8" stroke-width="2.6" style="paint-order:stroke fill"/>`;
      }
      svg.innerHTML = rays + `
        <circle cx="18" cy="18" r="8.6" fill="#ffd43b" stroke="#fffef8" stroke-width="3" style="paint-order:stroke fill"/>
        <circle cx="18" cy="18" r="6.2" fill="#ffaa00"/>
        <circle cx="15.5" cy="15.5" r="1.8" fill="rgba(255,255,255,0.7)"/>`;
    } else if (kind === "star") {
      const colors = ["#ffd43b", "#4dabf7", "#38d9a9", "#ffa94d"];
      const col = colors[Math.floor(Math.random() * colors.length)];
      let pts = "";
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 14 : 6.8;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        pts += (18 + Math.cos(a) * r).toFixed(1) + "," + (18 + Math.sin(a) * r).toFixed(1) + " ";
      }
      svg.innerHTML = `
        <polygon points="${pts.trim()}" fill="${col}" stroke="#fffef8" stroke-width="3.4" stroke-linejoin="round" style="paint-order:stroke fill"/>
        <circle cx="15.5" cy="15" r="2" fill="rgba(255,255,255,0.65)"/>`;
    } else if (kind === "paw") {
      // Cute puppy/kitty paw print for pet photos!
      const col = Math.random() < 0.5 ? "#ff8787" : "#ffa94d";
      svg.innerHTML = `
        <g stroke="#fffef8" stroke-width="3" style="paint-order:stroke fill" fill="${col}">
          <ellipse cx="18" cy="22.5" rx="7.8" ry="6.2"/>
          <ellipse cx="9.5" cy="14.5" rx="3.2" ry="4.1" transform="rotate(-20 9.5 14.5)"/>
          <ellipse cx="15" cy="11" rx="3.1" ry="4.2" transform="rotate(-6 15 11)"/>
          <ellipse cx="21" cy="11" rx="3.1" ry="4.2" transform="rotate(6 21 11)"/>
          <ellipse cx="26.5" cy="14.5" rx="3.2" ry="4.1" transform="rotate(20 26.5 14.5)"/>
        </g>`;
    } else {
      // 5-petal sunny spring blossom
      const col = Math.random() < 0.5 ? "#ff85a1" : "#ffc078";
      let petals = "";
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        const px = (18 + Math.cos(a) * 7.2).toFixed(1);
        const py = (18 + Math.sin(a) * 7.2).toFixed(1);
        petals += `<circle cx="${px}" cy="${py}" r="5.6" fill="${col}" stroke="#fffef8" stroke-width="2.8" style="paint-order:stroke fill"/>`;
      }
      svg.innerHTML = petals + `<circle cx="18" cy="18" r="4.6" fill="#ffd43b"/>`;
    }

    return svg;
  }

  function createPortraitCharmsRing(tier) {
    const ring = document.createElement("div");
    ring.className = "hero-charms-ring";

    // Guarantee Sun + Heart + Star mix every time, plus cute Blossom / Pet Paw accents!
    const pool = ["sun", "heart", "star", "sun", "heart", "star", "blossom", "paw", "heart", "star", "sun", "paw"];
    const total = tier === 3 ? 11 : tier === 2 ? 9 : 8;
    const bag = pool.slice(0, total);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }

    const baseRadius = tier === 3 ? 112 : tier === 2 ? 102 : 90;
    const dur = tier === 3 ? "1.76s" : tier === 2 ? "1.6s" : "1.46s";
    const startAngle = Math.random() * Math.PI * 2;

    bag.forEach((kind, i) => {
      const el = createCharmSVG(kind);
      const angle = startAngle + (i / total) * Math.PI * 2 + (Math.random() - 0.5) * 0.22;
      const rad = baseRadius + (i % 2 === 0 ? 10 : -4) + (Math.random() * 8 - 4);
      const cx = Math.round(Math.cos(angle) * rad);
      const cy = Math.round(Math.sin(angle) * rad);
      const size = Math.round(31 + (i % 3) * 4 + Math.random() * 4);
      const rot = Math.round((Math.random() - 0.5) * 32);

      el.style.setProperty("--cx", cx + "px");
      el.style.setProperty("--cy", cy + "px");
      el.style.setProperty("--csize", size + "px");
      el.style.setProperty("--crot", rot + "deg");
      el.style.setProperty("--cdelay", (i * 26) + "ms");
      el.style.setProperty("--cdur", dur);
      ring.append(el);
    });

    return ring;
  }

  // Shown in place of a face while the album is empty.
  function createEmblem() {
    const box = document.createElement("div");
    box.className = "hero-face-img hero-emblem";
    const sun = createCharmSVG("sun");
    sun.setAttribute("class", "hero-emblem-art");
    box.append(sun);
    return box;
  }

  function retriggerClass(el, cls) {
    el.classList.remove("shake-2", "shake-3", "bop-1", "bop-multi", "sb-bop", "tray-bop", "flash-on");
    void el.offsetWidth;
    el.classList.add(cls);
  }

  const fxLayer = document.getElementById("fxLayer");
  const heroMount = document.getElementById("heroMount");
  let cleanupTimer = 0;

  function clearStage() {
    fxLayer.replaceChildren();
    heroMount.replaceChildren();
  }

  function clear() {
    clearTimeout(cleanupTimer);
    clearStage();
    Fireworks.clear();
  }

  function sweep(result, n) {
    const grid = document.createElement("div");
    grid.className = "fx-grid";
    for (const r of result.rows) {
      const beam = document.createElement("div");
      beam.className = "fx-beam row";
      beam.style.gridArea = (r + 1) + " / 1 / " + (r + 2) + " / " + (n + 1);
      grid.append(beam);
    }
    for (const c of result.cols) {
      const beam = document.createElement("div");
      beam.className = "fx-beam col";
      beam.style.gridArea = "1 / " + (c + 1) + " / " + (n + 1) + " / " + (c + 2);
      grid.append(beam);
    }
    const rowSet = new Set(result.rows);
    for (const { index, color } of result.clearedCells) {
      const r = Math.floor(index / n), c = index % n;
      const tile = document.createElement("div");
      tile.className = "fx-tile tile-" + color;
      tile.style.gridArea = (r + 1) + " / " + (c + 1);
      tile.style.setProperty("--delay", ((rowSet.has(r) ? c : r) * 18) + "ms");
      grid.append(tile);
    }
    fxLayer.append(grid);
  }

  function praise(result) {
    const pick = list => list[Math.floor(Math.random() * list.length)];
    if (result.count === 1) {
      return result.streak >= 2 ? result.streak + "연속 줄 완성!" : pick(["얼씨구 한 줄!", "시원하게 한 줄!", "신난다 한 줄!"]);
    }
    if (result.count === 2) return pick(["덩실덩실 2줄 대박!", "2줄 동시 완성!"]);
    return result.count + "줄 싹쓸이 대쾌거!!";
  }

  function hero(result, tier, face, reduced) {
    const stage = document.createElement("div");
    stage.className = "hero-stage tier-" + tier;

    const figure = document.createElement("div");
    figure.className = "hero-figure";
    const box = document.createElement("div");
    box.className = "hero-portrait-box";
    if (face) face.classList.add("hero-face-img");
    box.append(createBackdropHaloSVG(), face || createEmblem());
    figure.append(box);
    if (!reduced) figure.append(createPortraitCharmsRing(tier));
    stage.append(figure);

    const ribbon = document.createElement("div");
    ribbon.className = "hero-ribbon";
    const text = document.createElement("span");
    text.textContent = praise(result);
    const points = document.createElement("span");
    points.className = "hero-ribbon-pts";
    points.textContent = "+" + result.gained + "점";
    ribbon.append(text, points);
    stage.append(ribbon);
    return stage;
  }

  function playClear(result, n, { record, face }) {
    clear();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tier = result.count >= 3 || record ? 3 : result.count === 2 ? 2 : 1;

    if (!reduced) {
      retriggerClass(document.getElementById("boardFrame"), tier >= 2 ? "bop-multi" : "bop-1");
      retriggerClass(document.getElementById("scoreboard"), "sb-bop");
      retriggerClass(document.getElementById("tray"), "tray-bop");
      if (tier >= 2) {
        retriggerClass(document.getElementById("appShell"), tier === 2 ? "shake-2" : "shake-3");
        retriggerClass(document.getElementById("screenFlash"), "flash-on");
      }
      sweep(result, n);
      Fireworks.celebrate(result.count, record);
    }

    heroMount.append(hero(result, tier, face, reduced));
    // Fireworks stop on their own, so a slow phone still sees the last sparks fade.
    cleanupTimer = setTimeout(clearStage, tier === 3 ? 1820 : tier === 2 ? 1660 : 1520);
  }

  return { playClear, clear };
})();
