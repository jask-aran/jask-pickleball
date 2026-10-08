# Pickleball — Architecture

Offline-first pickleball scorekeeper. One HTML/JS core, two shells: Android WebView (APK) and Cloudflare Workers Static Assets (`https://pickleball.jask-aran.com`).

## Layout

```
app/src/main/assets/     Web core (single source of truth)
  index.html             UI + inline controller
  score.js               Rules engine, global `Pickle`, no DOM deps
  book.js                Roster + match log, global `Book`
  geist-latin.woff2 / geist-latin-ext.woff2  Self-hosted font
app/src/main/java/com/jask/pickleball/MainActivity.java  Android shell (~84 lines)
app/src/main/AndroidManifest.xml  Portrait, single activity
app/src/main/res/        Theme (#121214), label, launcher icon
wrangler.jsonc           Web deploy: assets dir + custom domain
```

## Core: `score.js`

Pure rules, no I/O. Tested via `node score.js` self-check.

- `create() / normalize(raw)` — defaults: 2 players, target 11, winBy 2, scores 0-0, server side 0. `normalize` migrates old saves, clamps (score 0-99, target 1-99, winBy 1-9), stamps placeholder names (`P1-P4`).
- `rally(g, side)` — scoring side +1 (doubles swaps partners); receiving side = side-out, or second-server handoff in doubles (`serverNum` 2→1→2, `firstServe` flag for opening rally).
- `missed(g)` — same as conceding without a point (Edit > Server button).
- `bump(g, side, ±1)` / `setScore / setTarget / setWinBy / setPlayers / setName` — edit path, all clamp.
- `begin(g, side, index)` — New game: reset scores, seat chosen server right-box.
- `winner(g)` — `max >= target && diff >= winBy`.
- `call(g)` — `{ serve, receive, num, serveLabel, receiveLabel }`; `num` null in singles.
- `snapshot / undo` — 100-entry history stack, oldest dropped.
- Positioning: `parityBox(score)` (even=right), `seat()` keeps partners opposite.

## UI: `index.html`

Static page, no build. Reads/writes `localStorage["jask-pickleball"]` via `Pickle.normalize`.

- Header: score call (`#call`), status line (`#status`: serving player / until N / winner).
- Court: inline SVG (`viewBox -6 -6 452 212`), full width via `fit()` (`w = min(stageW, stageH*44/20)`), player `.mark` buttons positioned by `spot()` (18%/82% x, 27%/73% y by box).
- Controls: `#left/#right` halves + `#reach` buttons call `rally()`; footer New/Undo/Flip/Edit. Edit opens `#bubble` (players 2/4 seg, until/winBy, scores, names) plus tap-score/minus/Server affordances. `picking` mode taps a player mark to set first server.
- Hardening: `viewport maximum-scale=1, user-scalable=no`, `touch-action: none`, multi-touch + `gesturestart` blocked, `overflow: hidden`. Safe-area via CSS `env(safe-area-inset-*, fallback)`; Android overwrites `--safe-*` per frame.
- Zero `Android.*` references — identical file runs on device and web.

## Android shell: `MainActivity.java`

Thin `Activity` + `WebView`, no Compose.

- Loads `file:///android_asset/index.html`, JS + DOM storage on, zoom off, multi-touch consumed.
- Edge-to-edge transparent status/nav (`#121214` background to match theme), `FLAG_KEEP_SCREEN_ON`.
- `pushInsets()` forwards systemBars/cutout to CSS vars on page finish + inset change.
- Back: predictive callback → `window.onBack()` (closes picking/edit first, else `finish()`). `Bridge.close()` exposed but currently unused by web core.

## Web deploy: `wrangler.jsonc`

Workers Static Assets, no Worker script. `assets.directory` points directly at `app/src/main/assets` (no copy step). Static requests free/unlimited. Custom domain `pickleball.jask-aran.com` (`custom_domain: true`) auto-provisions DNS + cert.

```sh
npx wrangler deploy --dry-run  # validate
npx wrangler deploy            # 4 files
```

## Players: `book.js`

Device-local (`localStorage["jask-pickleball-book"]`). No accounts.

- Roster: name + id. Add/remove from Players.
- New game, if the roster is non-empty: assign a registered player to each slot, then tap who serves. Unassigned slots stay `P1–P4`.
- A finished game is logged once only if every slot has a roster id. Undo off the win drops that match. `player.id` and `game.logId` survive snapshot/undo.
- Stats are derived: player W–L, doubles pairs, side-vs-side. Cap 400 matches.

## State

Single `game` object in memory + `localStorage`. `render()` recomputes call/winner/positions, repaints, `save()`. `flipped` only swaps screen mapping, never data. History push on rally/begin/edit-commit (skipped for live typing in bubble until close).
