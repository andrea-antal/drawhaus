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
- `node render.js` draws every room in every slot (7 houses) into `renders/`. Look at all 7 after any kit change.
- Pen time is fixed at 7 s: `timeline` sets the pen speed from the ink.
- Things outside go on the end wall: no room kit can collide with them, and the ground-floor pen draws them last. The cat sits on the door canopy.
- The attic is a wedge: the roof meets its floor at the back, so attic things stand toward the front. Each attic thing has a `tag`; a test keeps them from overlapping on the screen.
- Roof styles (gable, steep, barn) are profiles in `PROFILES`. A new roof must start on the back wall at 15.6 ft, never come lower than the gable, bend only downward, and stay steeper than a line of sight (27°); tests check all four. A roof shallower than 27° would show its top and grow the sheet.
- The barn roof's upper slope is near the line of sight, so its attic ceiling looks flat from this camera.
- The flip mirrors the finished sheet in `drawing()`, so hidden lines stay right. Only lettering must not mirror: the sign writes its letters back to front when flipped. Any new lettering must do the same.
- A thing on the lawn is printed, not drawn. It must stay low enough not to hide the house (height < 0.5 × its distance from the front, in feet), and inside the sheet's edges, so the drawing does not jump when it is turned on.

## Open
- Hosting: drawhaus.com is registered (since 2007). Option: drawhaus.drealabs.com.
- GitHub repo: create it only when she asks.
