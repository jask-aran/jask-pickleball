(function (root) {
  // ponytail: 400 matches, oldest dropped. Move to D1 when records must leave the device.
  var CAP = 400;

  function nid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function load() {
    try {
      var raw = JSON.parse(root.localStorage.getItem("jask-pickleball-book"));
      if (raw && Array.isArray(raw.players) && Array.isArray(raw.matches)) return raw;
    } catch (e) {}
    return { players: [], matches: [] };
  }

  function save(book) {
    if (!root.localStorage) return;
    root.localStorage.setItem("jask-pickleball-book", JSON.stringify(book));
  }

  function addPlayer(book, name) {
    name = String(name || "").trim().slice(0, 24);
    if (!name) return null;
    var p = { id: nid(), name: name };
    book.players.push(p);
    save(book);
    return p;
  }

  function removePlayer(book, id) {
    book.players = book.players.filter(function (p) { return p.id !== id; });
    save(book);
  }

  function nameOf(book, id) {
    var n = "";
    book.players.forEach(function (p) { if (p.id === id) n = p.name; });
    return n;
  }

  function named(g) {
    var ok = true;
    g.sides.forEach(function (s) {
      s.players.forEach(function (p) { if (!p.id) ok = false; });
    });
    return ok && g.sides.length === 2;
  }

  function capture(g, winner) {
    return {
      at: Date.now(),
      n: g.players,
      sides: g.sides.map(function (s) {
        return {
          score: s.score,
          ids: s.players.map(function (p) { return p.id; }),
          names: s.players.map(function (p) { return p.name; })
        };
      }),
      winner: winner
    };
  }

  function addMatch(book, m) {
    m.id = nid();
    book.matches.push(m);
    if (book.matches.length > CAP) book.matches.shift();
    save(book);
    return m.id;
  }

  function replaceMatch(book, id, m) {
    var i = -1;
    book.matches.forEach(function (x, n) { if (x.id === id) i = n; });
    if (i < 0) return addMatch(book, m);
    m.id = id;
    book.matches[i] = m;
    save(book);
    return id;
  }

  function dropMatch(book, id) {
    book.matches = book.matches.filter(function (m) { return m.id !== id; });
    save(book);
  }

  function label(book, ids, names) {
    return ids.map(function (id, i) {
      return nameOf(book, id) || (names && names[i]) || "?";
    }).join(" & ");
  }

  function bump(row, win) {
    if (win) row.w++;
    else row.l++;
  }

  function stats(book) {
    var players = {};
    var teams = {};
    var vs = {};
    book.players.forEach(function (p) {
      players[p.id] = { id: p.id, name: p.name, w: 0, l: 0 };
    });
    book.matches.forEach(function (m) {
      if (!m.sides || (m.winner !== 0 && m.winner !== 1)) return;
      var keys = [0, 1].map(function (si) { return m.sides[si].ids.slice().sort().join(","); });
      [0, 1].forEach(function (si) {
        var win = m.winner === si;
        m.sides[si].ids.forEach(function (id, i) {
          if (!players[id]) players[id] = { id: id, name: (m.sides[si].names || [])[i] || "?", w: 0, l: 0 };
          bump(players[id], win);
        });
        if (m.sides[si].ids.length > 1) {
          if (!teams[keys[si]]) teams[keys[si]] = { label: label(book, m.sides[si].ids, m.sides[si].names), w: 0, l: 0 };
          bump(teams[keys[si]], win);
        }
      });
      var flip = keys[0] > keys[1];
      var vk = flip ? keys[1] + "|" + keys[0] : keys[0] + "|" + keys[1];
      if (!vs[vk]) {
        vs[vk] = {
          a: label(book, m.sides[flip ? 1 : 0].ids, m.sides[flip ? 1 : 0].names),
          b: label(book, m.sides[flip ? 0 : 1].ids, m.sides[flip ? 0 : 1].names),
          aw: 0,
          bw: 0
        };
      }
      if ((m.winner === 0 && !flip) || (m.winner === 1 && flip)) vs[vk].aw++;
      else vs[vk].bw++;
    });
    function byGames(a, b) { return (b.w + b.l) - (a.w + a.l); }
    return {
      players: Object.keys(players).map(function (k) { return players[k]; }).sort(byGames),
      teams: Object.keys(teams).map(function (k) { return teams[k]; }).sort(byGames),
      vs: Object.keys(vs).map(function (k) { return vs[k]; }).sort(function (a, b) { return (b.aw + b.bw) - (a.aw + a.bw); })
    };
  }

  var api = {
    load: load,
    addPlayer: addPlayer,
    removePlayer: removePlayer,
    nameOf: nameOf,
    named: named,
    capture: capture,
    addMatch: addMatch,
    replaceMatch: replaceMatch,
    dropMatch: dropMatch,
    stats: stats
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Book = api;

  if (typeof module !== "undefined" && require.main === module) {
    var book = {
      players: [
        { id: "a", name: "Ana" },
        { id: "b", name: "Bo" },
        { id: "c", name: "Cal" },
        { id: "d", name: "Dee" }
      ],
      matches: [{
        id: "m",
        winner: 0,
        sides: [
          { score: 11, ids: ["a", "b"], names: ["Ana", "Bo"] },
          { score: 7, ids: ["c", "d"], names: ["Cal", "Dee"] }
        ]
      }]
    };
    var s = stats(book);
    var ana = s.players.filter(function (p) { return p.id === "a"; })[0];
    var cal = s.players.filter(function (p) { return p.id === "c"; })[0];
    if (ana.w !== 1 || ana.l !== 0 || cal.w !== 0 || cal.l !== 1) throw new Error("player record");
    if (s.teams.length !== 2 || s.teams[0].w + s.teams[0].l !== 1) throw new Error("teams");
    if (s.vs.length !== 1 || s.vs[0].aw + s.vs[0].bw !== 1) throw new Error("vs");
    var g = {
      players: 2,
      sides: [
        { players: [{ id: "a", name: "Ana" }] },
        { players: [{ id: "b", name: "Bo" }] }
      ]
    };
    if (!named(g)) throw new Error("named");
    g.sides[1].players[0].id = "";
    if (named(g)) throw new Error("placeholder");
    console.log("book.js ok");
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
