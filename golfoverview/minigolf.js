// Putting-green mini golf for the page header.
// Drag back from the ball to aim, release to putt. Holes light up one at a
// time; sink them all in as few strokes as possible.
(function () {
  "use strict";

  var header = document.getElementById("title-block-header");
  var canvas = document.getElementById("minigolf");
  if (!header || !canvas || !canvas.getContext) return;
  var ctx = canvas.getContext("2d");

  var hudHole = document.getElementById("mg-hole");
  var hudStrokes = document.getElementById("mg-strokes");
  var hudBest = document.getElementById("mg-best");
  var hudMsg = document.getElementById("mg-msg");
  var resetBtn = document.getElementById("mg-reset");

  // Hole positions as fractions of the header, in play order.
  var HOLES = [
    [0.80, 0.80],
    [0.90, 0.20],
    [0.50, 0.13],
    [0.10, 0.24],
    [0.18, 0.80]
  ];
  var START = [0.5, 0.92];

  var BALL_R = 5.5;
  var HOLE_R = 10;
  var DECEL = 260;          // px/s^2 rolling resistance
  var MAX_SPEED = 1100;     // px/s
  var POWER = 5;            // speed per px of drag
  var CAPTURE_SPEED = 520;  // faster than this lips out
  var WALL_BOUNCE = 0.7;
  var GRAB_R = 44;
  var BEST_KEY = "golfOverview.minigolf.best";

  var W = 0, H = 0, dpr = 1;
  var turf = document.createElement("canvas");
  var ball = { x: 0, y: 0, vx: 0, vy: 0, scale: 1 };
  var holes = [];
  var current = 0, strokes = 0, best = loadBest();
  var state = "ready";      // ready | rolling | sinking | done
  var sinkT = 0, bursts = [];
  var aim = null;           // { x, y } pointer while dragging
  var pointerId = null;
  var hinted = false;
  var visible = true;
  var lastT = 0;
  var lipped = false;
  var started = false;

  function loadBest() {
    try { var v = parseInt(localStorage.getItem(BEST_KEY), 10); return isNaN(v) ? null : v; }
    catch (e) { return null; }
  }
  function saveBest(v) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* ignore */ }
  }

  // ---- layout -------------------------------------------------------------

  function resize() {
    var rect = header.getBoundingClientRect();
    var nw = Math.max(1, Math.round(rect.width));
    var nh = Math.max(1, Math.round(rect.height));
    if (nw < 50 || nh < 50) return;   // not laid out yet
    if (started) { ball.x *= nw / W; ball.y *= nh / H; }
    W = nw; H = nh;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    holes = HOLES.map(function (p) {
      return { x: clamp(p[0] * W, 24, W - 24), y: clamp(p[1] * H, 24, H - 24) };
    });
    ball.x = clamp(ball.x, BALL_R, W - BALL_R);
    ball.y = clamp(ball.y, BALL_R, H - BALL_R);
    paintTurf();
    if (!started) {
      started = true;
      newGame();
      requestAnimationFrame(frame);
    }
  }

  function paintTurf() {
    turf.width = W * dpr; turf.height = H * dpr;
    var t = turf.getContext("2d");
    t.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = t.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#2f7d3a");
    g.addColorStop(1, "#276a31");
    t.fillStyle = g;
    t.fillRect(0, 0, W, H);

    // Diagonal mowing stripes.
    var band = 46;
    t.save();
    t.translate(W / 2, H / 2);
    t.rotate(-0.35);
    var span = Math.hypot(W, H);
    for (var i = -Math.ceil(span / band); i < span / band; i++) {
      if (i % 2) continue;
      t.fillStyle = "rgba(255,255,255,0.045)";
      t.fillRect(i * band, -span, band, span * 2);
    }
    t.restore();

    // Grain speckle.
    var n = Math.round(W * H / 90);
    for (var k = 0; k < n; k++) {
      t.fillStyle = Math.random() < 0.5 ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.05)";
      t.fillRect(Math.random() * W, Math.random() * H, 1, 1.6);
    }

    // Soft vignette toward the fringe.
    var v = t.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.28)");
    t.fillStyle = v;
    t.fillRect(0, 0, W, H);
  }

  // ---- game flow ----------------------------------------------------------

  function newGame() {
    current = 0; strokes = 0; state = "ready";
    ball.x = START[0] * W; ball.y = START[1] * H;
    ball.vx = ball.vy = 0; ball.scale = 1;
    bursts = []; aim = null;
    hudMsg.textContent = "";
    hudMsg.hidden = true;
    updateHud();
  }

  function updateHud() {
    hudHole.textContent = Math.min(current + 1, holes.length) + "/" + holes.length;
    hudStrokes.textContent = strokes;
    hudBest.textContent = best == null ? "–" : best;
  }

  function sunk() {
    var h = holes[current];
    bursts.push({ x: h.x, y: h.y, t: 0 });
    current++;
    if (current >= holes.length) {
      state = "done";
      var record = best == null || strokes < best;
      if (record) { best = strokes; saveBest(best); }
      hudMsg.textContent = "All " + holes.length + " holed in " + strokes +
        (strokes === 1 ? " stroke" : " strokes") + (record ? " · new best!" : "");
      hudMsg.hidden = false;
      updateHud();
      return;
    }
    // Pop the ball out beside the cup, nudged toward the middle of the green.
    var dx = W / 2 - h.x, dy = H / 2 - h.y, d = Math.hypot(dx, dy) || 1;
    ball.x = h.x + dx / d * (HOLE_R + BALL_R + 6);
    ball.y = h.y + dy / d * (HOLE_R + BALL_R + 6);
    ball.vx = ball.vy = 0; ball.scale = 1;
    state = "ready";
    updateHud();
  }

  // ---- physics ------------------------------------------------------------

  function step(dt) {
    if (state === "rolling") {
      var speed = Math.hypot(ball.vx, ball.vy);
      var steps = Math.max(1, Math.ceil(speed * dt / 3));
      var h = dt / steps;
      for (var i = 0; i < steps && state === "rolling"; i++) substep(h);
    } else if (state === "sinking") {
      sinkT += dt;
      var target = holes[current];
      ball.x += (target.x - ball.x) * Math.min(1, dt * 18);
      ball.y += (target.y - ball.y) * Math.min(1, dt * 18);
      ball.scale = Math.max(0, 1 - sinkT / 0.28);
      if (sinkT >= 0.32) sunk();
    }
    for (var b = bursts.length - 1; b >= 0; b--) {
      bursts[b].t += dt;
      if (bursts[b].t > 0.8) bursts.splice(b, 1);
    }
  }

  function substep(dt) {
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * WALL_BOUNCE; }
    if (ball.x > W - BALL_R) { ball.x = W - BALL_R; ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE; }
    if (ball.y < BALL_R) { ball.y = BALL_R; ball.vy = Math.abs(ball.vy) * WALL_BOUNCE; }
    if (ball.y > H - BALL_R) { ball.y = H - BALL_R; ball.vy = -Math.abs(ball.vy) * WALL_BOUNCE; }

    var speed = Math.hypot(ball.vx, ball.vy);
    var hole = holes[current];
    var dx = hole.x - ball.x, dy = hole.y - ball.y;
    var d = Math.hypot(dx, dy);

    if (d < HOLE_R) {
      if (speed < CAPTURE_SPEED) {
        state = "sinking"; sinkT = 0;
        ball.vx = ball.vy = 0;
        return;
      }
      if (!lipped) {
        // Too hot: the ball catches the lip, loses pace and is deflected.
        lipped = true;
        var off = (dx * ball.vy - dy * ball.vx) / (speed * HOLE_R); // -1..1
        var ang = -off * 0.6;
        var c = Math.cos(ang), s = Math.sin(ang);
        var vx = ball.vx * c - ball.vy * s, vy = ball.vx * s + ball.vy * c;
        ball.vx = vx * 0.8; ball.vy = vy * 0.8;
        speed *= 0.8;
      }
    } else if (d > HOLE_R + 2) {
      lipped = false;
    }

    // Slow balls near the cup get gently drawn toward it.
    if (d < HOLE_R * 1.8 && speed < 140 && d > 0) {
      ball.vx += dx / d * 120 * dt;
      ball.vy += dy / d * 120 * dt;
    }

    var ns = speed - DECEL * dt;
    if (ns <= 4) {
      ball.vx = ball.vy = 0;
      state = "ready";
    } else {
      ball.vx *= ns / speed;
      ball.vy *= ns / speed;
    }
  }

  // ---- drawing ------------------------------------------------------------

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(turf, 0, 0, W, H);

    holes.forEach(function (h, i) {
      var active = i === current && state !== "done";
      var done = i < current;
      if (active) {
        var pulse = 0.5 + 0.5 * Math.sin(now / 320);
        var glow = ctx.createRadialGradient(h.x, h.y, HOLE_R, h.x, h.y, HOLE_R + 22 + pulse * 8);
        glow.addColorStop(0, "rgba(255,230,120,0.55)");
        glow.addColorStop(1, "rgba(255,230,120,0)");
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(h.x, h.y, HOLE_R + 30 + pulse * 8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,236,150," + (0.55 + pulse * 0.45) + ")";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(h.x, h.y, HOLE_R + 5 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
      }
      // Cup
      ctx.fillStyle = "rgba(255,255,255," + (active ? 0.9 : 0.25) + ")";
      ctx.beginPath(); ctx.arc(h.x, h.y, HOLE_R + 1.5, 0, Math.PI * 2); ctx.fill();
      var cup = ctx.createRadialGradient(h.x - 2, h.y - 3, 1, h.x, h.y, HOLE_R);
      cup.addColorStop(0, "#050805");
      cup.addColorStop(1, "#1d2a1e");
      ctx.fillStyle = cup;
      ctx.globalAlpha = active ? 1 : 0.55;
      ctx.beginPath(); ctx.arc(h.x, h.y, HOLE_R, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      if (done) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.beginPath(); ctx.arc(h.x, h.y, 3, 0, Math.PI * 2); ctx.fill();
      }
      if (active) drawFlag(h, i + 1, now);
    });

    bursts.forEach(function (b) {
      var p = b.t / 0.8;
      ctx.strokeStyle = "rgba(255,240,160," + (1 - p) + ")";
      ctx.lineWidth = 3 * (1 - p) + 0.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, HOLE_R + p * 50, 0, Math.PI * 2); ctx.stroke();
      for (var k = 0; k < 10; k++) {
        var a = k / 10 * Math.PI * 2;
        var r = HOLE_R + p * 38;
        ctx.fillStyle = "rgba(255,255,255," + (1 - p) + ")";
        ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, 2, 0, Math.PI * 2); ctx.fill();
      }
    });

    if (aim && state === "ready") drawAim();
    if (state !== "done" || ball.scale > 0) drawBall();

    if (!hinted && state === "ready" && !aim) {
      ctx.font = "600 13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255," + (0.6 + 0.3 * Math.sin(now / 400)) + ")";
      ctx.fillText("Drag back from the ball to putt", clamp(ball.x, 110, W - 110), ball.y - 18);
    }
  }

  function drawFlag(h, n, now) {
    var top = h.y - 46;
    ctx.strokeStyle = "#f4f1e8";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x, top); ctx.stroke();
    var wave = Math.sin(now / 250) * 2;
    ctx.fillStyle = "#e8483b";
    ctx.beginPath();
    ctx.moveTo(h.x + 1, top);
    ctx.quadraticCurveTo(h.x + 12, top + 3 + wave, h.x + 24, top + 8);
    ctx.quadraticCurveTo(h.x + 12, top + 13 - wave, h.x + 1, top + 16);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), h.x + 10, top + 8.5);
    ctx.textBaseline = "alphabetic";
  }

  function drawBall() {
    var r = BALL_R * ball.scale;
    if (r <= 0.2) return;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(ball.x + 1.5, ball.y + 2.5, r, r * 0.8, 0, 0, Math.PI * 2); ctx.fill();
    var g = ctx.createRadialGradient(ball.x - r * 0.4, ball.y - r * 0.4, r * 0.1, ball.x, ball.y, r);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#d7dbd6");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, r, 0, Math.PI * 2); ctx.fill();
  }

  function shotVector() {
    var dx = ball.x - aim.x, dy = ball.y - aim.y;
    var len = Math.hypot(dx, dy);
    var speed = Math.min(len * POWER, MAX_SPEED);
    return { dx: dx, dy: dy, len: len, speed: speed, frac: speed / MAX_SPEED };
  }

  function drawAim() {
    var s = shotVector();
    if (s.len < 4) return;
    var ux = s.dx / s.len, uy = s.dy / s.len;

    // Pull-back band
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(aim.x, aim.y); ctx.stroke();

    // Direction arrow, coloured by power
    var hue = 120 - s.frac * 120;
    var colour = "hsl(" + hue + ",90%,60%)";
    var reach = 24 + s.frac * 140;
    var ex = ball.x + ux * reach, ey = ball.y + uy * reach;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = colour;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(ball.x + ux * 9, ball.y + uy * 9); ctx.lineTo(ex, ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(ex + ux * 9, ey + uy * 9);
    ctx.lineTo(ex - uy * 6, ey + ux * 6);
    ctx.lineTo(ex + uy * 6, ey - ux * 6);
    ctx.closePath(); ctx.fill();

    // Power readout
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillText(Math.round(s.frac * 100) + "%", aim.x, aim.y - 12);
  }

  // ---- input --------------------------------------------------------------

  function localPoint(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function nearBall(p) {
    return state === "ready" && Math.hypot(p.x - ball.x, p.y - ball.y) <= GRAB_R;
  }

  canvas.addEventListener("pointerdown", function (e) {
    var p = localPoint(e);
    if (!nearBall(p)) return;
    e.preventDefault();
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    aim = p;
  });
  canvas.addEventListener("pointermove", function (e) {
    var p = localPoint(e);
    if (aim && e.pointerId === pointerId) { aim = p; return; }
    canvas.style.cursor = nearBall(p) ? "grab" : "default";
  });
  function release(e, cancelled) {
    if (!aim || e.pointerId !== pointerId) return;
    aim = localPoint(e);
    var s = shotVector();
    aim = null; pointerId = null;
    if (cancelled || s.len < 6 || state !== "ready") return;
    ball.vx = s.dx / s.len * s.speed;
    ball.vy = s.dy / s.len * s.speed;
    strokes++;
    hinted = true;
    lipped = false;
    state = "rolling";
    updateHud();
  }
  canvas.addEventListener("pointerup", function (e) { release(e, false); });
  canvas.addEventListener("pointercancel", function (e) { release(e, true); });

  // Only block page scrolling when a touch starts on the ball.
  canvas.addEventListener("touchstart", function (e) {
    var t = e.touches[0];
    if (t && nearBall(localPoint(t))) e.preventDefault();
  }, { passive: false });

  resetBtn.addEventListener("click", newGame);

  // ---- loop ---------------------------------------------------------------

  function frame(now) {
    var dt = Math.min(0.033, (now - (lastT || now)) / 1000);
    lastT = now;
    if (visible) {
      step(dt);
      draw(now);
    }
    requestAnimationFrame(frame);
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
    }).observe(header);
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(header);
  } else {
    window.addEventListener("resize", resize);
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  resize();
})();
