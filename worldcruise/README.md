# WORLDCRUISE

An open-world, low-poly driving game for the browser. Cruise compact, hand-tuned versions of
**Paris, New York, London, Tokyo and Dublin**, drift through traffic, and discover 26 famous landmarks.

Built with Three.js, React 19, TypeScript, Vite, Rapier physics and Zustand. Every model, texture, sound effect
and music track is generated in code at runtime, so the game has no external asset files and needs no API keys.

## Run it

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # type-check + production bundle in dist/
```

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Accelerate | W / ↑ | Right trigger |
| Brake / reverse | S / ↓ | Left trigger |
| Steer | A / D or ← / → | Left stick |
| Handbrake (drift) | Space | A |
| Boost | Shift | B / X |
| Change camera (chase, far, cockpit) | C | RB |
| Reset car to nearest road | R | Y |
| City map | M | |
| Horn | H | |
| Pause | Esc / P | Start |
| Look around / zoom | Drag mouse / scroll | |

## Game modes

- **Free Roam**: no timer, no rules.
- **Landmark Exploration**: a guide arrow points to the nearest undiscovered landmark.
- **Checkpoint Challenge**: 10 random gates. Each gate adds time to a countdown.
- **Time Trial**: a fixed route per city with gold, silver and bronze target times. Your best time is saved.
- **Collectibles**: the guide arrow hunts down the 25 golden tokens hidden in each city.

Driving near a landmark discovers it: you get a notification card with a short description, plus XP, and it
goes into your Discoveries collection. XP raises your explorer level and unlocks cars in the Garage: Pico Hatch
and Vento GT from the start, Rivière 66 at level 2, Atlas 4x4 at level 3, Fulmine X at level 5. Each car can be
painted. Progress and settings are saved in the browser's localStorage.

## Cities and landmarks

| City | Landmarks |
| --- | --- |
| Paris | Eiffel Tower (sparkles at night), Arc de Triomphe (drive through it), Louvre and pyramid, Notre-Dame on the Île de la Cité, Pont Alexandre III and the Seine, Moulin Rouge |
| New York | Times Square (animated screens), Empire State Building, Central Park, Flatiron Building, Brooklyn Bridge, Statue of Liberty |
| London | Big Ben and Parliament (clock shows real time), London Eye (rotating), Buckingham Palace, Tower Bridge, Trafalgar Square. Traffic drives on the left |
| Tokyo | Shibuya scramble crossing, Tokyo Tower, Sensō-ji, Kabukichō neon gate. Drives on the left, starts at dusk |
| Dublin | O'Connell Street and the Spire, GPO, Custom House, Ha'penny Bridge, Temple Bar. Drives on the left |

## Architecture

```
src/
  game/                    framework-free engine (no React)
    core/                  Game (loop, renderer, sessions), Input (keyboard + gamepad), rng
    physics/               Rapier world wrapper, static colliders, collision groups
    vehicle/               PlayerVehicle (ray-cast vehicle + arcade assists), procedural car models
    camera/                CameraRig: chase / far / cockpit, mouse orbit, collision, reverse view, menu cinematic
    world/                 CityLayout (grid → road graph), CityBuilder, Buildings, Props, Traffic, Pedestrians,
                           Environment (day/night, sky, clouds, fog), Materials, procedural textures, Effects
    cities/                data-driven CityDefinitions + hand-modelled landmark builders
    missions/              discoveries, golden tokens, checkpoint & time-trial gates, guide arrow
    audio/                 procedural Web Audio engine, tyres, impacts, ambience, UI sounds, lo-fi music
  components/              React UI: MainMenu, CitySelect, Garage, Discovery, Settings, HUD, PauseMenu
  store/                   zustand: gameStore (screens, HUD), profileStore (persisted progress + settings), actions
  data/                    vehicles, XP levels, paints
```

### Driving model

The car is a Rapier `DynamicRayCastVehicleController`, which gives real suspension, tyre friction, weight and
collisions. Arcade assists sit on top of it: speed-sensitive steering, a simulated gearbox, a top-speed governor,
downforce, boost, and a drift model. In the drift model, the handbrake drops rear grip, steering sets the yaw rate
directly while sliding, the front wheels counter-steer automatically, and "drift thrust" keeps momentum through
long slides.

### City generation and adding a city

A city is a `CityDefinition` (see `src/game/cities/paris.ts`). It defines:

- a block grid with optional wide boulevards (`wideX` / `wideZ`)
- `areas`: rivers, parks, plazas and landmark plots, which can span several cells
- bridge columns over rivers
- a building style: facade textures, colours, floor counts, roof type (mansard, flat, pitched, parapet), towers,
  shop fronts, neon density and door colours
- a palette, tree species, lamp style, street furniture, traffic colours, taxis, buses and driving side
- landmark builders: small functions that model a landmark with the geometry builder and register colliders

To add a city, create a definition and list it in `src/game/cities/index.ts`.

`CityLayout` turns the grid into a generic road graph (nodes plus straight edges). Rendering, traffic,
route-finding, the minimap and the missions only read that graph. A future OpenStreetMap importer would only need
to produce the same `RoadNode` / `RoadEdge` structure from OSM ways.

### Performance

- Static geometry (buildings, props, landmarks) is merged into one mesh per material per 160 m chunk, which keeps
  frustum culling and gives about 120 to 190 draw calls per city.
- Trees, parked cars, traffic, pedestrians, tokens and street-light pools are instanced meshes.
- Physics runs on a fixed 60 Hz step and the player's car is interpolated for smooth rendering.
- The shadow map only covers the area around the player and is texel-snapped to stop shimmering.
- Quality presets:
  - **Low**: no shadows, short view distance, fewer cars and pedestrians.
  - **Medium** (default): 1024 shadows.
  - **High**: 2048 shadows, night-time bloom, denser streets and more detail.

## Known limitations

- Cities are compact grid-based interpretations of each city's famous area, not real street layouts. Landmarks are
  stylised, recognisable models, not survey-accurate ones.
- Traffic cars are kinematic. They stop for you and honk, but they can't be pushed. Pedestrians step aside
  instead of colliding.
- Roads are flat. Bridges and quays are at street level, with the river set below.
- Garage customisation is paint only. Weather is not implemented yet. The day/night cycle is.
- Audio is synthesised (engine, tyres, ambience and music), not recorded samples.
