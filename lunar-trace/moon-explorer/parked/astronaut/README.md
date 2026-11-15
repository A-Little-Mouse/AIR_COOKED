# Parked: the walking astronaut

Taken out of the build on request ("for now we are just the camera"). Nothing here is compiled or served.

- `stylized-astronaut.glb`: the model. `rigWeights.ts`, `astronautRig.ts`: the 5-bone procedural walk (gait amplitude and swing follow speed; the body sinks as the legs spread so the planted foot stays down).
- `footDust.ts`: ballistic foot dust at 1.62 m/s^2 (push-off and landing puffs).
- `ActorLayer.with-astronaut.ts`: the actor layer as it was, with the astronaut, the lunar lope (hop arc), dust, and the rover.
- `GroundCamera.third-person.ts`: the third-person walking camera (eased acceleration, camera orbiting the astronaut, `placePlayer`).
- `astronaut-walk.test.mts`: its test.

To bring it back: copy the files back into `src/ground/actors/` and `src/ground/`, put the model in `public/actors/`, and re-wire `GroundMode.render` (`updatePlayer`) and `goTo`.
