# Epoch War — design notes

## What the originals did

Research sources: the Age of War fan wiki (aowg.fandom.com: age, unit, turret and strategy pages) and reviews and guides of Age of War 2 on JayIsGames and Armor Games.

**Age of War (Louissi / Max Games, 2007)**

- Five ages: Stone, Medieval, Renaissance, Modern, Future. Each has three units (the Future adds the 150,000-gold Super Soldier) and three turrets.
- Unit costs rise steeply: 15 / 25 / 100 gold in the Stone Age, up to 5,000 / 6,000 / 20,000 in the Future.
- XP to evolve: 4,000 → 14,000 → 45,000 → 200,000. XP is kept, not spent.
- Gold comes only from kills, at the victim's cost + 30%.
- The wall starts at 500 HP. One turret slot at the start, with up to three more bought for 1,000 / 3,000 / 7,500. Turrets sell for half price.
- A training queue of five.
- One special per age on a cooldown: Meteor Shower (5 s of meteors, 30 s cooldown), Arrow Rain, a Renaissance heal, a bombing run, and a Future laser strike.
- Difficulty scales enemy HP and damage: Harder ×1.3, Impossible ×2.

**Age of War 2 (Louissi, released 2015)**

- Seven ages: Stone, Spartan, Egyptian, Medieval (fantasy), Renaissance (Spanish colonial), Modern, Future. Four units per age (five in the Future, including the 10,000-gold God's Wrath).
- The fourth unit is locked behind a building: Dino Hut, Armory, Temple, Arena, Black Powder, Factory.
- A population cap that grows with the ages.
- Unit classes (infantry, support, anti-armour, armour) with counters.
- Gold-bought upgrades (infantry armour and damage, support range and damage, income).
- Specials ("God's Spells") cost XP: Meteorite Shower, Zeus' Anger, Rage of the Desert, Arrow Storm, Bomb Rain, Bomber, Death Ray.
- Generals mode.

## What Epoch War keeps

- The lane, the two walls, and units that march, block and fight. Ranged units fire over their own front line.
- Gold from kills at cost + 30%, and experience that unlocks evolution.
- A turret tower with four ledges bought one by one. Old-age turrets keep working until you sell them at half price.
- A queue of five, and one special per age on a cooldown.
- AoW2's four-unit ages, the building that unlocks the heavy unit, the population cap, class counters and gold-bought upgrades.
- Difficulty as enemy power multipliers (Recruit ×0.8, Veteran ×1, General ×1.25, Impossible ×1.6), plus income and AI sharpness.

## The seven ages

| Age | Units | Turrets | Special | XP to next | Wall | Pop |
| --- | --- | --- | --- | --- | --- | --- |
| 1. Stone Age | Clubber (infantry, 15g) · Slinger (ranged, 25g) · Spear Hunter (anti-armour, 40g) · Trike Rider (heavy, 100g, unlock 300g) | Rock Sling 100g · Egg Launcher 220g · Boulder Catapult 520g | Meteor Shower | 2000 | 900 | 10 |
| 2. Ancient Age | Hoplite (infantry, 25g) · Archer (ranged, 40g) · Sun Priest (support, 70g) · War Elephant (heavy, 160g, unlock 500g) | Bow Nest 160g · Scorpion 510g · Greek Fire 830g | Wrath of Zeus | 4000 | 1550 | 12 |
| 3. Medieval Age | Man-at-Arms (infantry, 40g) · Crossbowman (ranged, 65g) · Pikeman (anti-armour, 100g) · Knight (heavy, 255g, unlock 800g) | Arbalest 260g · Boiling Oil 820g · Trebuchet 1330g | Arrow Storm | 9200 | 2650 | 14 |
| 4. Gunpowder Age | Duelist (infantry, 60g) · Musketeer (ranged, 100g) · Field Cannon (anti-armour, 195g) · Cuirassier (heavy, 410g, unlock 1300g) | Swivel Gun 900g · Long Cannon 1310g · Mortar 2130g | Rally the Colours | 18000 | 4500 | 16 |
| 5. Industrial Age | Trench Raider (infantry, 100g) · Machine Gunner (ranged, 165g) · Flametrooper (anti-armour, 260g) · Landship (heavy, 655g, unlock 2000g) · Biplane (aircraft, 785g) | Maxim Nest 1440g · Flak Cannon 2360g · Howitzer 3410g | Bomber Run | 31000 | 7600 | 18 |
| 6. Modern Age | Assault Trooper (infantry, 155g) · Marksman (ranged, 260g) · Rocket Trooper (anti-armour, 420g) · Battle Tank (heavy, 1050g, unlock 3300g) · Gunship (aircraft, 1260g) | CIWS Gatling 2310g · Missile Battery 3360g · Rocket Artillery 5450g | Drone Swarm | 62000 | 12800 | 20 |
| 7. Age of Intelligence | Robo-Hound (infantry, 250g) · Android (ranged, 420g) · Railgunner (anti-armour, 670g) · Warden Mech (heavy, 1680g, unlock 5500g) · Nano Swarm (aircraft, 2015g) · OMEGA Model (apex, 9060g, unlock 14000g) | Laser Turret 5030g · Railgun 10400g · Tesla Node 9400g | Override | — | 21500 | 24 |

Stats come from per-class archetypes that scale ×1.6 per age in HP, damage and price. A unit one age ahead is therefore about 2.5× as strong for 1.6× the gold. Evolving matters, but a well-defended wall can survive being one age behind for a while.

## The twists

1. **Counters and an air layer.** A class table (`src/sim/combat.ts`) makes the choice of unit matter. Infantry beats ranged, heavies trample infantry, anti-armour melts heavies. From the Industrial Age on, aircraft fly above the melee: only ranged units, anti-air and turrets can hit them.
2. **Front-liners walk through their own ranged units.** This fixes the classic Age of War frustration of a knight stuck behind an archer. Pikemen reach from the second rank.
3. **Doctrine drafts.** Each evolution offers three random doctrines out of twenty, such as Plunder, Fortify, Conscription, Salvage Crews, Blitz, Veteran Corps, Sky Shield and War Chest. The enemy drafts too, and its picks are shown under its wall.
4. **Veterancy.** Units earn valor from kills and rank up three times (+12% damage and HP per rank), shown as gold pips.
5. **Stance.** "Hold the line" pulls your army back under your turrets while you save for a push.
6. **The adaptive enemy.** On Veteran and above, the AI weighs your army's class mix and picks counters. It tells you when it does ("Enemy AI is adapting: Pikemen to counter your heavy"). It is fitting for a war that ends in the Age of Intelligence.
7. **The Age of Intelligence.** Robo-hounds, androids, railguns that pierce the whole line, Warden mechs and nano swarms that chain lightning. The **Override** special hacks up to four enemy units to your side and EMP-stuns the rest. The apex is the **OMEGA Model**, a floating superintelligence.
8. **The Singularity Project.** In the final age you can pour 60,000 gold into a 150-second countdown that wins the war. Damage to your wall sets it back, so the answer to an enemy project is to storm its wall. This also resolves the late-game stalemates that pure lane-pushing produces once both armies hit their population cap. The headless AI-vs-AI runs originally ended in 60-minute draws.
9. **The world evolves.** Each side's half of the valley is repainted and re-propped in a wave from its wall when it evolves: pine forests, olive groves and pyramids, villages and windmills, a cratered no-man's-land, a city skyline, and finally a neon data-scape. The sky and light follow the player's age from dawn to a neon night.

## Balance, as measured

`npm run bench` plays AI-vs-AI wars headless (about 11 µs per simulated tick, so an hour of war simulates in about a second). At Veteran vs Veteran, median age timings are roughly:

| Age reached | Median time |
| --- | --- |
| Ancient | 3:00 |
| Medieval | 6:20 |
| Gunpowder | 9:30 |
| Industrial | 12:20 |
| Modern | 14:30 |
| Intelligence | 16:40 |

Wars last 15–25 minutes, with no draws. Higher difficulties win consistently against lower ones: General beat Veteran 12–0, and Veteran beat Recruit 12–0.

## Architecture

- `src/sim` is a deterministic, seeded fixed-step simulation (30 Hz) with no rendering dependencies. The player and the AI use the same command API (`train`, `buyTurret`, `evolve`, `castSpecial`…). The simulation emits events that the renderer, the audio and the HUD consume.
- `src/render` uses three.js with ACES tone mapping, bloom, a vignette/grade pass, PCF shadows and a PMREM environment. Every model is built from primitives by a small modelling kit. Colour, emissive strength, roughness and metalness are vertex attributes, and every joint's parts are baked into one rigidly skinned mesh, so a whole unit or turret is a single draw call with one shared material however many moving parts it has. Shading is baked into the vertex colours too: each piece darkens toward its underside and grounded models darken toward the ground. Units get per-instance uniforms for hit flashes, tints and a noise dissolve on death. Animation is procedural, driven by the simulation state (gait from distance walked, attacks from the attack timer): knees and elbows bend, off hands reach for foregrips and bowstrings, capes, plumes and pennants sway on their own, tank treads run round their hulls, and turrets wind cranks, sweep radars and reload. Unit portraits in the HUD are rendered from the same 3D models.
- `src/audio` is WebAudio synthesis: effects are short recipes of oscillators, filtered noise and envelopes, panned by lane position. The music is a small generative sequencer whose tempo, scale and instruments change per age.
- `src/ui` is a DOM HUD and menus over the canvas. It only updates the text that changed.
