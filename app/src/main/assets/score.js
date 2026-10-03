(function (root) {
  // ponytail: undo keeps the last 100 events, then drops the oldest
  var CAP = 100;

  function clamp(n, lo, hi) {
    n = Math.round(Number(n));
    if (!Number.isFinite(n)) return lo;
    return Math.min(hi, Math.max(lo, n));
  }

  function player(name, box) {
    return { name: name, box: box === "left" ? "left" : "right" };
  }

  function tag(side, index, n) {
    return n === 4 ? "P" + (side * 2 + index + 1) : (side === 0 ? "P1" : "P2");
  }

  function placeholder(name) {
    return !name || name === "Partner" || name === "Left" || name === "Right" || name === "Near" || name === "Far" || /^P[1-4]$/.test(name);
  }

  function stamp(g) {
    g.sides.forEach(function (s, si) {
      s.players.forEach(function (p, i) {
        if (placeholder(p.name)) p.name = tag(si, i, g.players);
      });
    });
  }

  function create() {
    return {
      players: 2,
      target: 11,
      winBy: 2,
      last: null,
      server: { side: 0, index: 0 },
      serverNum: 2,
      firstServe: true,
      sides: [
        { label: "Left", score: 0, players: [player("P1", "right")] },
        { label: "Right", score: 0, players: [player("P2", "right")] }
      ],
      history: []
    };
  }

  function snapshot(g) {
    return {
      players: g.players,
      target: g.target,
      winBy: g.winBy,
      last: g.last,
      server: { side: g.server.side, index: g.server.index },
      serverNum: g.serverNum,
      firstServe: g.firstServe,
      sides: g.sides.map(function (s) {
        return {
          label: s.label,
          score: s.score,
          players: s.players.map(function (p) { return player(p.name, p.box); })
        };
      })
    };
  }

  function push(g) {
    g.history.push(snapshot(g));
    if (g.history.length > CAP) g.history.shift();
  }

  function swap(side) {
    if (side.players.length < 2) return;
    var box = side.players[0].box;
    side.players[0].box = side.players[1].box;
    side.players[1].box = box;
  }

  function seat(side, index, box) {
    if (!side.players[index]) return;
    if (side.players.length < 2) {
      side.players[0].box = "right";
      return;
    }
    side.players[index].box = box;
    side.players[1 - index].box = box === "right" ? "left" : "right";
  }

  function parityBox(score) {
    return score % 2 === 0 ? "right" : "left";
  }

  function playerInBox(side, box) {
    var idx = 0;
    side.players.forEach(function (p, i) { if (p.box === box) idx = i; });
    return idx;
  }

  function rally(g, side) {
    if (side !== 0 && side !== 1) return;
    push(g);
    if (side === g.server.side) {
      if (g.sides[side].score < 99) g.sides[side].score += 1;
      g.last = side;
      if (g.players === 4) swap(g.sides[side]);
      return;
    }
    if (g.players !== 4 || g.serverNum === 2 || g.firstServe) {
      g.firstServe = false;
      g.serverNum = 1;
      var box = parityBox(g.sides[side].score);
      g.server = { side: side, index: g.players === 4 ? playerInBox(g.sides[side], box) : 0 };
      return;
    }
    g.serverNum = 2;
    g.server = { side: g.server.side, index: 1 - g.server.index };
  }

  function undo(g) {
    var prev = g.history.pop();
    if (!prev) return false;
    g.players = prev.players;
    g.target = prev.target;
    g.winBy = prev.winBy;
    g.last = prev.last;
    g.server = prev.server || { side: 0, index: 0 };
    g.serverNum = prev.serverNum || (g.players === 4 ? 2 : 1);
    g.firstServe = prev.firstServe !== false;
    g.sides = prev.sides;
    return true;
  }

  function begin(g, side, index, target) {
    push(g);
    g.sides[0].score = 0;
    g.sides[1].score = 0;
    g.last = null;
    if (target != null) g.target = clamp(target, 1, 99);
    side = side === 1 ? 1 : 0;
    index = g.sides[side].players[index] ? index : 0;
    g.server = { side: side, index: index };
    g.serverNum = g.players === 4 ? 2 : 1;
    g.firstServe = true;
    seat(g.sides[side], index, "right");
    var other = g.sides[1 - side];
    if (other.players.length > 1) seat(other, 0, "right");
  }

  function setPlayers(g, n, record) {
    n = n === 4 ? 4 : 2;
    if (n === g.players) return;
    if (record !== false) push(g);
    g.players = n;
    var per = n / 2;
    g.sides.forEach(function (s) {
      while (s.players.length < per) s.players.push(player("", "left"));
      s.players.length = per;
      if (per === 2 && s.players[0].box === s.players[1].box) s.players[1].box = "left";
      if (per === 1) s.players[0].box = "right";
    });
    stamp(g);
    if (!g.sides[g.server.side].players[g.server.index]) g.server = { side: 0, index: 0 };
    if (n !== 4) {
      g.serverNum = 1;
      g.firstServe = false;
    } else if (g.sides[0].score === 0 && g.sides[1].score === 0) {
      g.serverNum = 2;
      g.firstServe = true;
    }
    seat(g.sides[g.server.side], g.server.index, parityBox(g.sides[g.server.side].score));
  }

  function setScore(g, side, n) {
    g.sides[side].score = clamp(n, 0, 99);
    if (g.server.side === side) seat(g.sides[side], g.server.index, parityBox(g.sides[side].score));
  }

  function bump(g, side, delta, record) {
    if (side !== 0 && side !== 1) return;
    if (record !== false) push(g);
    g.sides[side].score = clamp(g.sides[side].score + delta, 0, 99);
    if (g.server.side === side) seat(g.sides[side], g.server.index, parityBox(g.sides[side].score));
  }

  function missed(g, record) {
    if (record !== false) push(g);
    var other = 1 - g.server.side;
    if (g.players !== 4 || g.serverNum === 2 || g.firstServe) {
      g.firstServe = false;
      g.serverNum = 1;
      var box = parityBox(g.sides[other].score);
      g.server = { side: other, index: g.players === 4 ? playerInBox(g.sides[other], box) : 0 };
      return;
    }
    g.serverNum = 2;
    g.server = { side: g.server.side, index: 1 - g.server.index };
  }

  function setLabel(g, side, text) {
    g.sides[side].label = String(text).slice(0, 24);
  }

  function setName(g, side, index, text) {
    var p = g.sides[side].players[index];
    if (!p) return;
    p.name = String(text).slice(0, 24);
  }

  function setTarget(g, n) {
    g.target = clamp(n, 1, 99);
  }

  function setWinBy(g, n) {
    g.winBy = clamp(n, 1, 9);
  }

  function winner(g) {
    var a = g.sides[0].score;
    var b = g.sides[1].score;
    if (Math.max(a, b) >= g.target && Math.abs(a - b) >= g.winBy) return a > b ? 0 : 1;
    return null;
  }

  function call(g) {
    var srv = g.server.side === 1 ? 1 : 0;
    var recv = 1 - srv;
    return {
      serve: g.sides[srv].score,
      receive: g.sides[recv].score,
      num: g.players === 4 ? g.serverNum : null,
      serveLabel: g.sides[srv].label,
      receiveLabel: g.sides[recv].label
    };
  }

  function asPlayer(p, i) {
    if (p && typeof p === "object") return player(p.name || "", p.box || (i === 0 ? "right" : "left"));
    return player(p || "", i === 0 ? "right" : "left");
  }

  function normalize(raw) {
    if (!raw || !raw.sides || raw.sides.length !== 2) return create();
    var migrated = raw.sides.some(function (s) {
      return s.players && s.players[0] && typeof s.players[0] !== "object";
    }) || raw.serverNum == null;
    raw.players = raw.players === 4 ? 4 : 2;
    raw.target = clamp(raw.target || 11, 1, 99);
    raw.winBy = clamp(raw.winBy || 2, 1, 9);
    raw.history = migrated ? [] : (raw.history || []);
    raw.sides.forEach(function (s, si) {
      if (s.label === "Near") s.label = "Left";
      if (s.label === "Far") s.label = "Right";
      s.label = s.label || (si === 0 ? "Left" : "Right");
      s.score = clamp(s.score || 0, 0, 99);
      s.players = (s.players || []).map(asPlayer);
      var per = raw.players / 2;
      while (s.players.length < per) s.players.push(player("", "left"));
      s.players.length = per;
      if (per === 2 && s.players[0].box === s.players[1].box) s.players[1].box = "left";
    });
    stamp(raw);
    if (!raw.server || (raw.server.side !== 0 && raw.server.side !== 1)) raw.server = { side: 0, index: 0 };
    if (!raw.sides[raw.server.side].players[raw.server.index]) raw.server.index = 0;
    raw.serverNum = raw.players === 4 ? (raw.serverNum === 1 ? 1 : 2) : 1;
    raw.firstServe = raw.firstServe !== false && raw.players === 4;
    raw.flipped = !!raw.flipped;
    return raw;
  }

  var api = {
    create: create,
    snapshot: snapshot,
    normalize: normalize,
    rally: rally,
    undo: undo,
    begin: begin,
    setPlayers: setPlayers,
    setScore: setScore,
    bump: bump,
    missed: missed,
    setLabel: setLabel,
    setName: setName,
    setTarget: setTarget,
    setWinBy: setWinBy,
    winner: winner,
    call: call
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Pickle = api;

  if (typeof module !== "undefined" && require.main === module) {
    var g = create();
    if (g.sides[0].players[0].name !== "P1" || g.sides[1].players[0].name !== "P2") throw new Error("two names");
    setPlayers(g, 4);
    if (g.sides[0].players[0].name !== "P1" || g.sides[0].players[1].name !== "P2") throw new Error("left names");
    if (g.sides[1].players[0].name !== "P3" || g.sides[1].players[1].name !== "P4") throw new Error("right names");
    begin(g, 0, 0);
    var box = g.sides[0].players[0].box;
    rally(g, 0);
    if (g.sides[0].players[0].name !== "P1" || g.sides[0].players[0].box === box) throw new Error("P1 moves");
    if (g.sides[0].players[1].name !== "P2") throw new Error("P2 stays");
    setPlayers(g, 2);
    if (g.sides[1].players[0].name !== "P2") throw new Error("back to two");
    g = create();
    if (g.target !== 11 || call(g).num !== null) throw new Error("singles call");
    setPlayers(g, 4);
    begin(g, 0, 0);
    var c = call(g);
    if (c.serve !== 0 || c.receive !== 0 || c.num !== 2) throw new Error("0 0 2");
    rally(g, 0);
    if (g.sides[0].score !== 1 || g.serverNum !== 2) throw new Error("point keeps server");
    rally(g, 1);
    if (g.sides[1].score !== 0 || g.server.side !== 1 || g.serverNum !== 1) throw new Error("opening fault is side-out");
    rally(g, 0);
    if (g.server.side !== 1 || g.serverNum !== 2 || g.sides[0].score !== 1) throw new Error("second server");
    rally(g, 0);
    if (g.server.side !== 0 || g.serverNum !== 1) throw new Error("side-out after server 2");
    undo(g);
    if (g.serverNum !== 2) throw new Error("undo server");
    g = create();
    setPlayers(g, 4);
    g.sides[0].score = 11;
    g.sides[1].score = 9;
    if (winner(g) !== 0) throw new Error("11-9");
    setTarget(g, 15);
    if (g.target !== 15) throw new Error("until");
    g = create();
    setPlayers(g, 4);
    begin(g, 0, 0);
    missed(g);
    if (g.sides[0].score !== 0 || g.server.side !== 1 || g.serverNum !== 1) throw new Error("missed fault");
    console.log("score.js ok");
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
