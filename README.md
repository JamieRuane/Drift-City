# Drift City

An endless neon-city arcade racer for desktop and mobile browsers. Weave through traffic, chain near misses and drifts into combos, collect coins, and spend them on six distinct cars, upgrades and cosmetics.

Built with TypeScript, React 19, Three.js, Zustand and Vite. Every model, texture, sound effect and music track is generated procedurally at runtime, so the project has no external asset files.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173 (also reachable from phones on your LAN)
npm test           # unit + headless gameplay simulation tests
npm run build      # type-check + production bundle in dist/
```

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Steer | A / D or ← / → | Hold left / right half of the screen, or swipe lanes (Settings) |
| Boost | W / ↑ | BOOST button |
| Brake | S / ↓ | BRAKE button |
| Drift | Space (or Shift) while steering | DRIFT button while steering |
| Pause | Esc / P | ❚❚ button |
| Retry on game over | Enter / Space / R | Retry button |

## Gameplay

- **Endless**: traffic gets denser and faster the further you go. You have 3 armour pips, and each crash costs one.
- **Time Trial**: 90 seconds to score as much as you can. Difficulty starts higher.
- **Daily Challenge**: a date-seeded traffic layout plus a daily objective that pays bonus coins and XP.
- **Scoring**: distance (×1.5 / ×2.5 / ×4 at speed), near misses (ultra close under 0.45 m), drifts banked on release, overtakes and coins. Each near miss or banked drift extends the combo chain, and the multiplier grows +0.25 per link up to ×10. A crash breaks the chain.
- **Drifting**: hold drift while steering. Flick the other way to switch direction without breaking the drift. Releasing a drift banks its points and gives a short speed boost.
- **Progression**: XP and levels unlock cars and cosmetics. There are 20 sequential missions (3 active at a time, claim to reveal the next) and 23 achievements.

## Architecture

```
src/
  game/                 framework-free game code (no React)
    engine/             GameEngine (loop, renderer, post-fx, camera), Showroom (garage scene), types
    player/             PlayerController (arcade physics + drift), Autopilot (menu attract mode)
    traffic/            TrafficSystem: pooled instanced vehicles, fair row spawning, lane changes
    environment/        Road, City (instanced shader buildings), Props, Tunnel, Sky, canvas textures
    collision/          AABB hit / near-miss / overtake detection
    scoring/            ScoreSystem (combos, drift banking) + RunStats
    economy/            CoinSystem (pooled coin and gem patterns)
    effects/            particles (smoke/sparks), skid marks, speed lines
    audio/              AudioManager (engine/tyres/SFX) + Music (synthwave sequencer)
    input/              keyboard + virtual touch input
  systems/              pure logic: storage (validated schema), progression, missions, achievements
  data/                 vehicles, upgrades, cosmetics, missions, achievements, daily challenges
  stores/               zustand stores + gameActions (the only bridge between React and the engine)
  components/           React screens: menu, garage, upgrades, missions, stats, settings, HUD, pause, game over
  tests/                vitest: persistence/economy/scoring + headless 10-minute traffic simulation
```

Key engineering choices:

- **Floating world**: the player stays at the origin, and world-anchored objects live in a group offset by the distance travelled. Positions are tracked in float64, so very long runs don't jitter.
- **Instancing and pooling**: traffic, buildings, streetlights, coins, skid marks and particles are all pooled instanced meshes. A typical frame is about 65 draw calls and about 19k triangles.
- **Fixed-size sub-steps** (1/120 s) for physics and collisions, so gameplay doesn't depend on frame rate. Tests check this.
- **Fair traffic**: every spawned row keeps a guaranteed escape lane that moves at most one lane per row. Traffic shares one flow speed so rows don't merge into walls. Lane changes are signalled with indicators about 1.1 s ahead.
- **Persistence**: `systems/storage` validates and repairs any saved JSON. `RunRecord` and the storage adapter are shaped so an online backend or leaderboard can replace LocalStorage later.
- **Quality settings**: Low turns off bloom and speed lines and uses pixel ratio 1. Touch devices default to Medium.
