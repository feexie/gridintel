# Demo recordings

Made by `npm run geh:record` (`e2e/record-demo.ts`). Not committed: only this README is.

The script starts a dev server on port 3300, or uses one already running there, and films each
scene at 1920x1080 in story order. Each scene is saved as `<letter>-<name>.webm`, with a PNG of each
key moment saved as `<letter>-<name>--<moment>.png`. The scenes and their lengths from the last run
are listed in `last-run.txt`.

| Scene | Screen | What it shows |
| --- | --- | --- |
| a | About this build | The baseline, the sprint's commits with times, the comparison link |
| b | Planning overview | The two groups; Metering built, the others planned |
| c | DisCo allocation | Headline, the first million, the 11 DisCos (pause on Enugu), the first-million table, the pilot |
| d | DT sequencing | The revolving chart and the ranking (synthetic network) |
| e | Metering Fund | Fund alone, then the GridIntel structure, band charges, estimated bills removed, receipt |
| f | Metering Fund | Initial investment against break-even |
| g | Metering Fund | Shocks and the inflation line; Duty-shock reserve ticked, Recalculate |
| h | Metering Fund | Investor protection and investor outcome |
| i | Monitoring | Plan against synthetic actuals; a later quarter not reported |

The Metering Fund is filmed in presentation mode (`?present=1`, Nigeria reference case). The other
screens have no presentation mode and keep their navigation.

Nothing on a screen is changed for the camera. Next.js's development badge is hidden, and a small
indigo circle is drawn where the mouse is, because a headless browser films no pointer. Every route
is loaded once before filming, so no scene shows a page compiling.

Re-film one or more scenes only: `npm run geh:record -- c e`.
