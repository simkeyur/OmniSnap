# 03: Domains and Question Packs

Source of truth: `shared/question-packs.json`. Structure: **domain → areas → questions**.
Rules:
- Keep **≤ 8 questions per area** (quota).
- Phase 1 decides which questions survive, per domain.
- A domain launches only if it passes its own feasibility gate (docs/08).

> **Working product name:** "Snap Check", with Store Sentinel as the first domain. The repo folder keeps its name. Rename only if the user approves.

## Domains
| id | Label (UI) | Icon (Tabler) | One-liner | Who it's for | Launch tier |
|---|---|---|---|---|---|
| `store` | Store | `ti-building-store` | Spills, trip hazards, blocked exits | Retail staff | 1 (original) |
| `home` | Home | `ti-home` | Trip, fall and fire risks | Families, carers of older adults | 1 |
| `kitchen` | Kitchen | `ti-tools-kitchen-2` | Food safety and cleanliness | Restaurant and café staff | 1 |
| `garden` | Garden | `ti-plant-2` | Plant health at a glance | Home gardeners | 2 |
| `rental` | Rental | `ti-key` | Move-in and move-out condition | Tenants, hosts, landlords | 2 |
| `vehicle` | Vehicle | `ti-car` | Quick walk-around check | Drivers, small fleets | 2 |

Tier 1 = most likely to pass feasibility and easiest to stage photos for. Tier 2 = needs close-ups or has finer visual detail, so validate carefully.

## State template (per domain; sent with every question)
| domain | template |
|---|---|
| store | "Photo taken by store staff with a phone. Area: {area}. Time: {local_time}." |
| home | "Photo of a room in a private home, taken for a safety check. Area: {area}. Household focus: {focus}." |
| kitchen | "Photo taken in a commercial kitchen for a food-safety check. Area: {area}. Time: {local_time}." |
| garden | "Photo of a garden plant or bed, taken to check plant health. Area: {area}. Plant (if known): {plant}." |
| rental | "Photo of a rental property taken for a {mode} condition report. Area: {area}." |
| vehicle | "Photo of a car taken during a pre-drive walk-around check. Area: {area}." |

`{focus}` (home) = `general | toddlers | older adults`. `{mode}` (rental) = `move-in | move-out`. `{plant}` (garden) is optional free text, ≤ 40 characters, validated like the custom question.

## Primitives → Jev-Omni
| Primitive | Options sent | Stored value |
|---|---|---|
| `noul` | `["Yes", "No"]` | `p = P(Yes)` |
| `choice` | the option list (≤ 20) | distribution + argmax |
| `score` | ordered levels, low → high | distribution + `ev = Σ i·p_i/(n−1)` ∈ [0,1] |

Severity: `critical` / `high` / `medium` / `low` (alertable) or `—` (display only). Defaults are in "Severity → default costs" below.

---

## `store`: Store (unchanged from v2)
### `floor`: Aisle / sales floor
| id | type | question | severity |
|---|---|---|---|
| `spill` | noul | "Is there liquid, a puddle, or a wet patch on the floor?" | high |
| `trip` | noul | "Is there an object on the floor that someone could trip over?" | medium |
| `person_down` | noul | "Is a person lying or fallen on the floor?" | critical |
| `blocked` | noul | "Is the walkway or aisle blocked?" | medium |
| `empty_shelf` | noul | "Is there a visibly empty section on a shelf?" | low |
| `broken` | noul | "Is there broken glass or a broken product visible?" | high |
| `crowding` | score | "How crowded is this area?" (Empty / Light / Busy / Packed) | — |
| `tidy` | score | "How tidy is this area?" (Messy / So-so / Tidy / Spotless) | — |

### `checkout`
`queue` score ("How long is the line?" No line / 1–2 / 3–5 / 6+, medium: alert when ev ≥ τ), `unattended` noul ("Is a checkout counter open with no staff member present?", low), `spill`, `trip`, `person_down`, `blocked`, `crowding`, `tidy`.

### `stockroom`
`blocked_exit` noul ("Is an exit, fire door, or emergency equipment blocked?", critical), `unsafe_stack` noul ("Are boxes or goods stacked in an unstable or unsafe way?", high), `spill`, `trip`, `person_down`, `broken`, `tidy`, `crowding`.

### `entrance`
`wet_entry` noul ("Is the entrance floor wet or slippery-looking?", high), `blocked`, `trip`, `person_down`, `cart_clutter` noul ("Are shopping carts left scattered or blocking the way?", low), `crowding`, `tidy`, `lighting` score ("How well lit is the area?" Dark / Dim / OK / Bright).

---

## `home`: Home safety
**Focus chips:** General · Toddlers · Older adults. The focus changes **severities**, not questions (see the notes column).

### `living`: Living room / bedroom
| id | type | question | severity (general → toddlers / older adults) |
|---|---|---|---|
| `loose_rug` | noul | "Is there a loose rug or mat that could slip or cause a trip?" | medium → medium / **high** |
| `cord_walkway` | noul | "Is an electrical cord or cable running across a walkway?" | medium → high / high |
| `floor_clutter` | noul | "Are there objects on the floor in a walking path?" | low → medium / **high** |
| `fire_risk` | noul | "Is a heater, candle, or lamp close to fabric, paper, or curtains?" | high → high / high |
| `unstable_furniture` | noul | "Is there a tall piece of furniture or a TV that looks unsecured and could tip over?" | medium → **critical** / medium |
| `small_objects` | noul | "Are small objects that a toddler could swallow within reach on the floor or a low table?" | low → **high** / low |
| `lighting` | score | "How well lit is this area?" (Dark / Dim / OK / Bright) | — (alert on low ev for older adults: medium) |
| `tidy` | score | "How tidy is this area?" (Messy / So-so / Tidy / Spotless) | — |

### `stairs`: Stairs and hallways
`handrail_missing` noul ("Is there a staircase without a handrail?", high), `stairs_clutter` noul ("Are there objects left on the stairs?", high), `stair_gate_missing` noul ("Is the top or bottom of the stairs open with no safety gate?", toddlers: critical, otherwise —), `loose_rug`, `cord_walkway`, `lighting`, `step_damage` noul ("Does any step look broken, loose, or with a worn edge?", medium).

### `bathroom`: Bathroom
`wet_floor` noul ("Is there water on the floor?", high), `no_grab_bar` noul ("Is there no grab bar near the toilet or shower?", older adults: high, otherwise —), `no_bath_mat` noul ("Is there no non-slip mat in or next to the bath or shower?", medium), `meds_reachable` noul ("Are medicines or cleaning products within easy reach?", toddlers: critical, otherwise low), `floor_clutter`, `lighting`, `tidy`.

### `outside`: Entry and outside
`slippery_path` noul ("Does the path or steps look wet, icy, or slippery?", high), `path_blocked` noul ("Is the path to the door blocked?", medium), `handrail_missing`, `step_damage`, `lighting`, `pool_unfenced` noul ("Is there a pool or pond without a fence or cover?", toddlers: critical, otherwise medium).

**Notes:** the tone is helpful, not alarming. The SLM note suggests a simple fix ("Tape down or remove the rug"). Disclaimer: "Not a professional home inspection."

---

## `kitchen`: Commercial kitchen food safety
### `prep`: Prep line
| id | type | question | severity |
|---|---|---|---|
| `raw_above_rte` | noul | "Is raw meat, poultry, or fish stored above or next to ready-to-eat food?" | critical |
| `uncovered` | noul | "Is prepared food left uncovered?" | high |
| `cross_board` | noul | "Is raw meat on the same cutting board or surface as vegetables or cooked food?" | critical |
| `no_sanitizer` | noul | "Is there no sanitizer bucket or spray visible at the station?" | medium |
| `floor_spill` | noul | "Is there a spill or food debris on the floor?" | high |
| `chem_near_food` | noul | "Are cleaning chemicals stored next to or above food?" | critical |
| `surface_clean` | score | "How clean are the work surfaces?" (Dirty / So-so / Clean / Spotless) | — (alert on low ev: medium) |
| `clutter` | score | "How cluttered is the station?" (Clear / Some / Cluttered / Chaotic) | — |

### `walkin`: Walk-in cooler / fridge
`raw_above_rte`, `food_on_floor` noul ("Is food or a food container stored directly on the floor?", high), `uncovered`, `overcrowded` noul ("Are shelves so packed that air can't circulate?", low), `ice_buildup` noul ("Is there heavy ice build-up or a damaged door seal?", medium), `unlabeled` noul ("Are there food containers without a visible label?", medium; small-detail risk, validate), `clutter`.

### `dish`: Dish area
`dish_pileup` noul ("Are dirty dishes piled up beyond the sink or rack?", low), `standing_water` noul ("Is there standing water on the floor?", high), `handsink_blocked` noul ("Is a hand-washing sink blocked or being used for storage?", high), `chem_near_food`, `surface_clean`.

### `dry`: Dry storage
`open_bags` noul ("Are bags or containers of dry food left open?", medium), `food_on_floor`, `chem_near_food`, `pest_signs` noul ("Are there signs of pests, such as droppings, gnaw marks, or insects?", critical; small-detail risk, validate), `clutter`.

**Notes:** questions are **about the space, never about staff** (no hygiene or glove checks per person). Disclaimer: "Not a health inspection. Temperatures and dates need a thermometer and labels."

---

## `garden`: Plant health
**Optional input:** "Plant (if known)", e.g. "tomato", which goes into the state.

### `leaf`: Leaf close-up (default)
| id | type | question | severity (alert = "needs care") |
|---|---|---|---|
| `leaf_spots` | noul | "Are there brown, black, or yellow spots on the leaves?" | high |
| `yellowing` | noul | "Are leaves turning yellow?" | medium |
| `wilting` | noul | "Is the plant wilting or drooping?" | high |
| `pests` | noul | "Are insects or pests visible on the plant?" | high |
| `chewed` | noul | "Do leaves have holes or chewed edges?" | medium |
| `powdery` | noul | "Is there a white powdery coating on the leaves?" | high |
| `soil_moisture` | score | "How moist does the soil look?" (Very dry / Dry / Moist / Waterlogged) | — (alert on extremes: medium) |
| `health` | score | "How healthy does the plant look overall?" (Dying / Struggling / OK / Thriving) | — |

### `whole`: Whole plant
`wilting`, `yellowing`, `leggy` noul ("Is the plant tall and thin with sparse leaves, as if it needs more light?", low), `pests`, `health`, `soil_moisture`.

### `bed`: Bed or lawn
`weeds` noul ("Are weeds growing among the plants?", low), `bare_patches` noul ("Are there bare or dead patches in the lawn or bed?", medium), `standing_water` noul ("Is there standing water in the bed?", medium), `health`.

### `pot`: Pot or container
`root_bound` noul ("Are roots growing out of the bottom or top of the pot?", medium), `no_drainage` noul ("Does the pot appear to have no drainage, with water pooling?", medium), `soil_moisture`, `health`.

**Notes:** alerts read as "Needs care", not "danger". The SLM gives **generic care tips only**, and never diagnoses a specific disease or recommends chemicals. Disclaimer: "General guidance, not a plant-disease diagnosis."

---

## `rental`: Move-in / move-out condition
**Mode chips:** Move-in · Move-out (goes into the state and the report title).

### `walls`: Walls and ceilings
| id | type | question | severity (alert = "record in report") |
|---|---|---|---|
| `scuffs` | noul | "Are there marks or scuffs on the walls?" | low |
| `holes` | noul | "Are there holes in the walls, such as from nails or screws?" | medium |
| `water_damage` | noul | "Is there water damage, staining, or mold on the wall or ceiling?" | high |
| `paint_damage` | noul | "Is the paint peeling, chipped, or patchy?" | low |

### `floors`: Floors and carpet
`floor_stain` noul ("Are there stains on the carpet or floor?", medium), `floor_damage` noul ("Are there scratches, dents, or damaged sections in the floor?", medium), `trash_left` noul ("Is trash or debris left on the floor?", low), `clean` score ("How clean is the floor?" Dirty / So-so / Clean / Spotless).

### `kitchen`: Kitchen (rental)
`appliance_dirty` noul ("Are appliances such as the stove or fridge visibly dirty?", medium), `sink_dishes` noul ("Are dishes left in the sink?", low), `cabinet_damage` noul ("Are cabinet doors or counters damaged?", medium), `water_damage`, `clean`.

### `bathroom`: Bathroom (rental)
`mold` noul ("Is there mold or mildew in the shower, bath, or grout?", high), `fixture_damage` noul ("Is a sink, toilet, tap, or mirror cracked or broken?", high), `clean`, `trash_left`.

### `room`: Whole room
`items_left` noul ("Are personal belongings or furniture left behind?", medium), `trash_left`, `window_damage` noul ("Are windows, blinds, or curtains damaged?", medium), `clean`, `condition` score ("What is the overall condition of the room?" Poor / Fair / Good / Excellent).

**Notes:**
- The SLM writes **neutral condition-report lines** ("Living room wall: scuff marks, likely (84%)"). It never assigns blame or cost.
- Export produces a **condition report** (area, time, findings, confidence, thumbnails if kept).
- Stretch: move-in vs. move-out side by side for the same area (compare stored answers; no image comparison needed).
- Disclaimer: "Not a legal record on its own. Keep your original photos."

---

## `vehicle`: Walk-around check
### `tires`: Tires (default)
| id | type | question | severity |
|---|---|---|---|
| `tire_low` | noul | "Does a tire look flat or low on air?" | critical |
| `tire_damage` | noul | "Is there a bulge, cut, or visible damage on the tire sidewall?" | critical |
| `tread_worn` | score | "How worn does the tread look?" (Like new / Some wear / Worn / Bald) | — (alert on high ev: high; close-up needed, validate) |

### `body`: Body
`dent_scratch` noul ("Is there a dent or scratch on the body?", low), `panel_loose` noul ("Is a bumper, mirror, or panel loose or hanging?", high), `dirty` score ("How dirty is the car?" Clean / Dusty / Dirty / Very dirty).

### `lights_glass`: Lights and glass
`glass_crack` noul ("Is the windshield or a window cracked or chipped?", high), `light_broken` noul ("Is a headlight, taillight, or indicator cracked or broken?", high), `wipers_damaged` noul ("Do the wiper blades look damaged or missing?", medium).

### `under`: Under the car
`fluid_leak` noul ("Is there a puddle or stain of fluid under the car?", high), `hanging_parts` noul ("Is anything hanging down under the car?", high).

### `dash`: Dashboard
`warning_light` noul ("Is a warning light lit on the dashboard?", high), `fuel_low` noul ("Does the fuel gauge show nearly empty?", low), `loose_cargo` noul ("Are loose heavy objects in the cabin that could fly around when braking?", medium).

**Notes:**
- **Blur license plates.** The browser blur step covers faces **and plates** for this domain; validate the detector in Phase 3, otherwise use a manual "blur area" brush.
- Disclaimer: "Not a mechanical inspection. If in doubt, don't drive and ask a mechanic."

---

## Custom question (all domains; advanced toggle)
- One user-written **yes/no** question per snapshot, ≤ 120 characters. Shown as "Your question".
- Server-side validation: length, plain text; reject URLs and code.
- It **never triggers alerts** (display only).
- Example chips per domain:
  - store: "Is the freezer door left open?"
  - home: "Is the smoke alarm visible?"
  - kitchen: "Is the fridge door closed?"
  - garden: "Are there flowers or fruit?"
  - rental: "Are the blinds intact?"
  - vehicle: "Is the fuel cap closed?"

## Severity → default costs (docs/04)
| severity | C_miss | C_false | default τ (after floor) |
|---|---|---|---|
| critical | 50 | 1 | **0.30** |
| high | 10 | 1 | **0.40** |
| medium | 4 | 1 | **0.50** |
| low | 1 | 1 | **0.65** |

The floors keep single noisy photos from alerting too eagerly. They're tuned per domain in Phase 4 on that domain's eval data.

## Alert wording per domain (UI + SLM note style)
| domain | Act banner | Check banner | Clear banner | Note style |
|---|---|---|---|---|
| store | "Needs attention" | "Take another look" | "All clear" | incident note + action |
| home | "Worth fixing" | "Take a closer look" | "Looks safe" | friendly fix tip |
| kitchen | "Fix before service" | "Double-check" | "Looks good" | corrective action |
| garden | "Needs care" | "Keep an eye on it" | "Looks healthy" | gentle care tip |
| rental | "Record in report" | "Retake closer" | "No issues found" | neutral report line |
| vehicle | "Check before driving" | "Take a closer look" | "Looks OK" | safety-first action |
