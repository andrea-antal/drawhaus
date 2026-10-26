# drawhaus

A toy: people build their own cutaway dollhouse, and a blue ballpoint pen draws it. Named by Andrea (2026-10-26): draw + haus, a pun on dollhouse.

## First version (her choice, 2026-10-26)
- A room picker: choose a room for each slot, 4 downstairs and 3 upstairs, from her 7 rooms (lab, kitchen, dining room, living room, bedroom, bathroom, office).
- A shuffle button: start from a random house.
- The player's name on the welcome sign.
- The pen draws the house.
- Share a link (the house lives in the URL) or download the picture.
- Not in the first version: free furniture placement, a "describe your home" prompt.
- Added (2026-10-26): toggles for things outside (heat pump, rain barrel, EV charger, delivery box), pets (cat, dog, fish) and the attic (boxes, trunk, rocking horse, dress form, Christmas tree, fairy lights); a roof style (gable, steep, barn) and a window style (classic, shutters, arched, round); the look: ink (blue, black, dark gray, red), paper (white, grid, blueprint, blueprint grid) and a flip that puts the door end on the left. The bird, the cow box and the bulb stay in the attic always.
- Changed (2026-10-26): the options are on a receipt that drops from under the top row of buttons (Options, Shuffle, replay, Share, Download). Sans text at 12px. The receipt keeps its paper color in dark mode.
- Changed (2026-10-26): the usual house is mirrored, its door end on the left. The flip (`flip=1` in the link) puts the door end on the right. A house with no `mirror` is drawn plain, door end on the right; the tests and `render.js` use that.
- Added (2026-10-26): a spec table, like her homepage's: a toggle and up to 4 rows, each a label and a value the player writes. Turned on with every row blank, it starts as NAME (from the sign), LOCATION, MODEL, SCALE 1:12.
- Added (2026-10-26): Describe. A player types a home; Claude Haiku 5.5 picks the rooms, roof, windows and extras from these parts (`api/drawhaus.mjs`). It keeps the name, look, flip and specs, like Shuffle. Free to players, on her API key with a spend cap. Not "draw anything": Claude only picks parts, so only her drawings come out.
- Changed (2026-10-26): Describe is off in the UI (`const DESCRIBE = false` in `index.html`). The function and its tests stay. The README says how to turn it on.

## Where it comes from
- The engine is in `~/Desktop/stuff/andrea-antal-com/design/cutaway-house/index.html` (hidden-line removal, pen timing, Plotline text), with its tests in `house.test.js` there. Plotline pen paths: `~/Desktop/stuff/andrea-antal-com/design/blueprint/glyphs.js`.
- Copy the engine into this repo. Do not share files with her homepage: changes here must not break it.

## What the cutaway house taught (2026-10-26)
- The camera has no perspective, so a room looks the same in any slot along the house. Each room can be a kit in its own coordinates.
- The floor above hides each room's back wall above about 2.7 ft. A solid wall between rooms hides the back of the room on its left. The right end wall hides the back-right of the last room.
- Walls between rooms are glass (posts and rails), like the lab's.
- Pieces side by side overlap on screen. Check every room kit with a render before it ships.
- More rooms means more ink: keep the pen's total time near 7 s.

## What the room kits taught (2026-10-26)
- Each floor is split evenly: 9.5 ft rooms on the ground floor, 12.7 ft upstairs. Every kit fits 9.5 ft, so it fits any slot.
- The back-right of a room (y < x + 3.5 in kit feet) draws over the room on its right. The end wall hides that same part of the last room. Put each kit's key pieces at the front-left; only low, minor pieces go at the back.
- Tests: `pnpm install`, then `node --test` (runs `house.test.js` and `api.test.mjs`). The API tests use a stand-in for Claude and spend nothing.
- `node render.js` draws every room in every slot (7 houses) into `renders/`. Look at all 7 after any kit change.
- Pen time is fixed at 7 s: `timeline` sets the pen speed from the ink.
- Things outside go on the end wall: no room kit can collide with them, and the ground-floor pen draws them last. The cat sits on the door canopy.
- The attic is a wedge: the roof meets its floor at the back, so attic things stand toward the front. Each attic thing has a `tag`; a test keeps them from overlapping on the screen.
- Roof styles (gable, steep, barn) are profiles in `PROFILES`. A new roof must start on the back wall at 15.6 ft, never come lower than the gable, bend only downward, and stay steeper than a line of sight (27°); tests check all four. A roof shallower than 27° would show its top and grow the sheet.
- The barn roof's upper slope is near the line of sight, so its attic ceiling looks flat from this camera.
- `house.mirror` turns the finished sheet in `drawing()`, so hidden lines stay right. Only lettering must not mirror: the sign writes its letters back to front when mirrored. Any new lettering must do the same.
- The spec table is printed in the bottom-right corner, and the sheet grows under the lawn to hold it. It is placed after the mirror, so it never mirrors. Its text size follows the screen (`specFor`), as on her homepage: 12px or more on any screen.
- `drawing()` keeps the last house (`sheetOf`), so a new spec table, or a new size for it, does not run the hidden-line pass again.
- The prompt's part lists in `api/drawhaus.mjs` must match the engine's; `api.test.mjs` checks them. The rooms are 7 named fields because the API's schemas cannot fix an array's length.
- With `DESCRIBE` on, the Describe field shows only where `GET /api/drawhaus` answers 204 (a key is set). The Python server has no function, so it never shows the field.
- A thing on the lawn is printed, not drawn. It must stay low enough not to hide the house (height < 0.5 × its distance from the front, in feet), and inside the sheet's edges, so the drawing does not jump when it is turned on.

## Open
- Hosting: drawhaus.com is registered (since 2007). Option: drawhaus.drealabs.com. She will merge drawhaus into her existing Vercel project (Root Directory `site/`):
  - Copy `api/drawhaus.mjs` to `site/api/drawhaus.mjs`. The page calls `/api/drawhaus`, so the page can sit in any folder.
  - Add `@anthropic-ai/sdk` to `site/package.json`. Keep the function `.mjs`, or set `"type": "module"` there.
  - Set `ANTHROPIC_API_KEY` in the Vercel project's environment variables: a key from a `drawhaus` workspace with a monthly spend limit (the Default Workspace cannot have one).
- GitHub: https://github.com/andrea-antal/drawhaus, public (2026-10-26). Code MIT (`LICENSE`); Plotline in `glyphs.js` under the SIL Open Font License 1.1 (`OFL.txt`).
