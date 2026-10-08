/* DefaultMeteorShower from @jask-aran/solid-components/meteor-shower, without Solid. */
(function () {
  var SETTINGS = {
    angle: 225, angleVariance: 0, burstChance: 0, burstCountMax: 3, burstCountMin: 1,
    burstDurationMax: 8, burstGapMax: 0.3, burstGapMin: 0.08, concentration: 0.05,
    entryOffset: 12, firstLaunchDelay: 0.75, idleGapMax: 5, idleGapMin: 1.4, maxActive: 30,
    maxDuration: 34, minDuration: 2, mode: 20.5, refillGapMax: 0.8, refillGapMin: 0.18,
    retargetIntervalMax: 28, retargetIntervalMin: 12, shortenFastMeteors: true,
    speedLifeCoefficient: 0.4, spikePosition: 4, spikeShare: 0.45, spikeVariance: 0.1,
    targetMax: 30, targetMin: 20, travelMultiplier: 1.25
  };
  var SEED = 0xC0FFEE;
  var DURATION = 600;
  var INITIAL = 12;

  function mulberry32(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function sampleNormal(rng) {
    var u1 = Math.max(rng(), 1e-12);
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * rng());
  }
  function sampleFromMode(min, max, mode, concentration, rng) {
    var range = max - min;
    if (range <= 0) return min;
    if (concentration <= 0.001) return min + rng() * range;
    var mean = clamp((mode - min) / range, 0.05, 0.95);
    var k = 1 + clamp(concentration, 0, 1) * 19;
    var alpha = mean * k;
    var beta = (1 - mean) * k;
    var sigma = Math.sqrt((alpha * beta) / ((alpha + beta) * (alpha + beta) * (alpha + beta + 1)));
    return min + clamp(mean + sigma * sampleNormal(rng), 0, 1) * range;
  }
  function sampleDuration(s, rng, burst) {
    var lo = Math.min(s.minDuration, s.maxDuration);
    var hi = Math.max(s.minDuration, s.maxDuration);
    if (burst) return lo + rng() * (Math.max(lo, Math.min(s.burstDurationMax, hi)) - lo);
    if (s.spikeShare > 0 && rng() < s.spikeShare) return clamp(s.spikePosition + sampleNormal(rng) * s.spikeVariance, lo, hi);
    return sampleFromMode(lo, hi, s.mode, s.concentration, rng);
  }
  function launch(s, view, rng, burst) {
    var lo = Math.min(s.minDuration, s.maxDuration);
    var hi = Math.max(s.minDuration, s.maxDuration);
    var duration = sampleDuration(s, rng, burst);
    var angle = s.angle + (rng() * 2 - 1) * s.angleVariance;
    var rad = angle * Math.PI / 180;
    var full = (view.height * s.travelMultiplier) / Math.max(Math.abs(Math.sin(rad)), 0.2);
    var speed = (hi - duration) / Math.max(hi - lo, 1e-12);
    var travel = s.shortenFastMeteors ? full * (1 - speed * (1 - s.speedLifeCoefficient)) : full;
    var horizontal = Math.abs(Math.cos(rad)) * travel;
    return { angle: angle, duration: duration, left: -horizontal + rng() * (view.width + horizontal), travel: travel };
  }
  function simulate(view, seed) {
    var s = SETTINGS;
    var rng = mulberry32(seed);
    var events = [];
    var t = 0;
    var burst = 0;
    var target = Math.floor(rng() * (s.targetMax - s.targetMin + 1) + s.targetMin);
    var launched = 0;
    var removed = 0;
    var nextLaunch = rng() * s.firstLaunchDelay;
    var nextRetarget = 0;
    var id = 0;
    while (t < DURATION) {
      var nextRemove = removed < launched ? events[removed].startTime + events[removed].duration : Infinity;
      var next = Math.min(nextLaunch, nextRetarget, nextRemove);
      if (next > DURATION) break;
      t = next;
      while (removed < launched && events[removed].startTime + events[removed].duration <= t + 1e-6) removed++;
      if (Math.abs(t - nextRetarget) < 1e-6) {
        target = Math.floor(rng() * (s.targetMax - s.targetMin + 1) + s.targetMin);
        if (rng() < s.burstChance) burst = Math.floor(rng() * (s.burstCountMax - s.burstCountMin + 1) + s.burstCountMin);
        nextRetarget = t + s.retargetIntervalMin + rng() * (s.retargetIntervalMax - s.retargetIntervalMin);
      }
      if (Math.abs(t - nextLaunch) < 1e-6) {
        if (launched - removed < s.maxActive) {
          var isBurst = burst > 0;
          if (isBurst) burst--;
          var m = launch(s, view, rng, isBurst);
          events.push({ id: id++, startTime: t, duration: m.duration, angle: m.angle, left: m.left, travel: m.travel });
          launched++;
        }
        var active = launched - removed;
        var gap = burst > 0
          ? s.burstGapMin + rng() * (s.burstGapMax - s.burstGapMin)
          : active < target
            ? s.refillGapMin + rng() * (s.refillGapMax - s.refillGapMin)
            : s.idleGapMin + rng() * (s.idleGapMax - s.idleGapMin);
        nextLaunch = t + gap;
      }
    }
    return events;
  }
  function paint(root, events, elapsed) {
    var active = events.filter(function (e) { return e.startTime <= elapsed && e.startTime + e.duration > elapsed; }).slice(0, SETTINGS.maxActive);
    var next = events.filter(function (e) { return e.startTime > elapsed; })[0];
    if (next) active.push(next);
    var seen = {};
    active.forEach(function (e) {
      seen[e.id] = true;
      var el = root.querySelector('[data-id="' + e.id + '"]');
      if (el) return;
      el = document.createElement("span");
      el.className = "solid-meteor";
      el.dataset.id = e.id;
      el.style.setProperty("--angle", e.angle + "deg");
      el.style.setProperty("--meteor-travel", "-" + e.travel + "px");
      el.style.animationDelay = (e.startTime - elapsed) + "s";
      el.style.animationDuration = e.duration + "s";
      el.style.left = e.left + "px";
      el.style.top = "-" + SETTINGS.entryOffset + "px";
      var tail = document.createElement("span");
      tail.className = "solid-meteor__tail";
      el.appendChild(tail);
      root.appendChild(el);
    });
    root.querySelectorAll(".solid-meteor").forEach(function (el) {
      if (!seen[el.dataset.id]) el.remove();
    });
  }
  function mount() {
    var root = document.getElementById("meteors");
    if (!root) return;
    var events = [];
    var started = performance.now() - INITIAL * 1000;
    function elapsed() { return Math.max(0, (performance.now() - started) / 1000); }
    function rebuild() {
      var box = root.getBoundingClientRect();
      events = simulate({ width: Math.max(1, box.width), height: Math.max(1, box.height) }, SEED);
      paint(root, events, elapsed());
    }
    function tick() {
      var now = elapsed();
      if (now >= DURATION) { started = performance.now(); rebuild(); }
      else paint(root, events, now);
      var boundary = DURATION;
      events.forEach(function (e) {
        if (e.startTime > now + 0.001) boundary = Math.min(boundary, e.startTime);
        var end = e.startTime + e.duration;
        if (end > now + 0.001) boundary = Math.min(boundary, end);
      });
      setTimeout(tick, Math.max(16, (boundary - elapsed()) * 1000));
    }
    rebuild();
    new ResizeObserver(rebuild).observe(root);
    tick();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
