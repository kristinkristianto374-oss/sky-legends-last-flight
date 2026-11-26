# sky-legends-last-flight

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/kristinkristianto374-oss/sky-legends-last-flight/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/kristinkristianto374-oss/sky-legends-last-flight/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

SKY LEGENDS: LAST FLIGHT — a 3D sunset flight game. Fly the Kestrel-9 through sky rings, race the clock, and land on Runway 09 over a procedural archipelago. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## The game

A Canvas 2D pseudo-3D flight game (no libraries, no network at runtime — everything is original code):

- **Chase + cockpit cameras** over a procedural archipelago: five islands, ocean, clouds, fog, and a low sun over the western sea.
- **Three missions + free flight:** Ring Runner (thread 5 sky rings), Island Express (timed sprint, low-altitude bonus), Sunset Landing (bring the Kestrel-9 home to Runway 09).
- **Real flight model:** throttle, pitch, roll, yaw, banked turns, stalls, fuel burn, damage, hard landings, ditching, and field landings.
- **Lit instruments:** artificial horizon, airspeed and altitude dials, heading tape, throttle/fuel bars, and a top HUD with altitude, speed, heading, and score.
- **Scoring + achievements:** ring bonuses, landing bonuses, low-altitude bonus, and a par time per mission.

## Controls

| Key | Action |
| --- | --- |
| W / S | Pitch down / up |
| A / D | Roll left / right (banked turns) |
| Q / E | Rudder yaw |
| Shift / Ctrl | Throttle up / down |
| Space | Air brake |
| Mouse drag / wheel | Orbit camera / zoom |
| C | Chase / cockpit camera |
| P / Esc | Pause |
| R | Restart |
| 1 / 2 / 3 / F | Mission 1 / 2 / 3 / free flight |

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step — `game/index.html` opens in desktop Chrome and plays. Screenshots are genuine renders from the running game (`?shot=cover|cockpit|rings|landing`); `?selftest=1` runs the built-in 10-check self-test.

---

<sub>Entered on [make.fun](https://make.fun/?ref=x0y2c17b&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
