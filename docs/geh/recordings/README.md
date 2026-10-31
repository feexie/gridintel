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
| e | Metering Fund | Fund alone, then the GridIntel structure (what it fails, public money per meter), band charges, estimated bills removed |
| f | Metering Fund | Initial investment against break-even |
| g | Metering Fund | Shocks and the inflation line; Duty-shock reserve ticked, Recalculate |
| h | Metering Fund | Customer receipt, investor protection and investor outcome |
| i | Monitoring | Plan against synthetic actuals; a later quarter not reported |
| j | Marketplace · Match | Headline and how it is calculated, the match, the five pledges (a queued one), the daily charge by band, who funds which meters (synthetic) |
| k | One meter's journey | One synthetic household in Ibadan, Band A: applied, approved, priced, funded, installed, repaying; the balance falling to nothing |

Every Metering screen is filmed in presentation mode (`?present=1`; the Metering Fund in the
Nigeria reference case). The Planning overview keeps its navigation.

Platform clips, in `platform/` (`npm run geh:record -- p1 p2 p3 p4 p5 p6 p7`): screens that
existed before the hackathon, each about 10 to 15 s, with the caption "Existing platform, before the
hackathon" in the bottom-left corner.

| Clip | Screen |
| --- | --- |
| p1 | Platform home (`/dashboard`) |
| p2 | Utility executive |
| p3 | Reliability |
| p4 | Revenue and losses |
| p5 | GIS map |
| p6 | Mini-grid site performance (site MG-TAM) |
| p7 | A report (Reliability, September 2026) opened, and its figures downloaded as CSV |

Every scene is filmed in the dark theme. Nothing on a screen is changed for the camera. Next.js's
development badge is hidden, and a small circle (white rim, indigo ring) is drawn where the mouse
is, because a headless browser films no pointer. Every route
is loaded once before filming, so no scene shows a page compiling.

Re-film one or more scenes only: `npm run geh:record -- c e`.
