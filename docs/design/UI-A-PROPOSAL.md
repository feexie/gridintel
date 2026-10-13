# Phase UI-A: proposal for the UI revamp

Date: 2026-10-13. Branch `phase-ui-a`. Nothing here is merged to `main`.
This is a proposal with a prototype. **The Founder chooses one of the three
visual directions before anything else is rebuilt.**

Screenshots: `docs/screenshots/phase-ui-a`. The prototype is the branch
itself; the two directions that were not built are shown by laying a
stylesheet over the same screens (`docs/design/directions`).

## 1. Audit of the current screens

Every screen on `main` was opened at 1500 px and at 390 px and measured in a
browser: where the page starts, how long it is, how small its type is,
whether anything is wider than the screen, and how large the things to tap
are. The figures below are those measurements.

### What is hard on a phone (390 x 844)

| Finding | Measured |
| --- | --- |
| **The frame takes 30% of the screen.** The menu (nine links, wrapped over four rows) and the data bar (four lines) sit above every page | The page starts 251 px down on every screen |
| **Screens are very long** | Executive is 28 screens of scrolling; Reliability 21; a substation 20; a feeder 20; a region 19; a mini-grid site 18; a transformer 15; Events / Alarms 14; the Platform Overview 12 |
| **Most text is small** | On Executive 72% of the words are under 12 px and 28% under 11 px. On a mini-grid site 92% are under 12 px. The smallest text is 9 px |
| **Nine screens scroll sideways as a whole page** | Executive, Region, Substation, Feeder, Transformer, Reliability, Revenue, Assets, Events / Alarms. Tables are wider than the screen and are not inside a scrolling frame of their own, so the whole page slides, the heading with it |
| **Things to tap are small** | On Executive 74 of 103 links and controls are under 32 px tall; on a transformer 87 of 89; on Events / Alarms 56 of 80 |
| **The first view is the key, not the answer** | The status and origin legend (nine badges, three rows) comes before any figure on every data screen |
| **The map starts below the fold** | On the Map, the map itself begins about 480 px down |
| **Source and method opens beside the figure** | It is a floating box 416 px wide, wider than the screen |

### What is hard at any width

- **The Platform Overview does not say what GridIntel does.** It is
  marketing copy over stock pictures. It promises "AI-driven analytics",
  which is not built. Its two buttons ("Explore Sector Suites", "Learn
  More") do nothing. Three of its six cards lead to bare "Coming Soon"
  pages. It shows no figure and no finding, so a visitor learns nothing
  about the product from it. It also ships a 10.4 MB picture and a 2.1 MB
  logo as sources.
- **The Utility hub is a list of links.** It does not say what needs
  attention.
- **The Map is a third thing beside the sectors.** It opens on the
  utility's network with the mini-grid sites switched off.
- **A finding is shown three different ways**: ranked rows on Executive,
  amber boxes on Sites, a line above a table on Reliability.
- **Every panel has the same weight.** Executive has 24 tables and nothing
  says which to read first after "Where to look first".
- **Rules and methods are printed in full, in the smallest type, in the
  middle of the screen** (the 180-word "How this list is made" on
  Executive). They are true and they should stay; they should not be what a
  reader has to pass.
- **There is only a dark theme.** It is hard to read in daylight.
- **The status colours are not colour-blind safe.** The green of "ok" and
  the red of "alert" were measured as one colour for a red-green
  colour-blind reader (difference 3.6, where 8 is the target). The marks
  and the words carried the meaning; the colours did not.
- **Placeholder pages are unstyled**: a bare "Coming Soon", and
  `/dashboard/utility/ai` says "AI Insights" over nothing.

### What is good and is kept

- Every figure already carries status, origin, source and method.
- The SYNTHETIC DATA bar is in the layout, so no screen can be without it.
- Status is already a mark and a word, never colour alone.
- The screens are files built with the application: fast on a slow link.
- One shared map, one set of tokens, one metric component.

## 2. Navigation (built in the prototype)

```text
Platform
  Overview
Utility Intelligence
  Overview
  GIS Map
  AI Assistant            planned
  Executive, Operations, Reliability, Revenue, Assets, Events / Alarms
Mini-grid Intelligence
  Overview
  GIS Map
  AI Assistant            planned
  Sites
DER, Planning             to join with the same structure
```

| Address | Screen |
| --- | --- |
| `/dashboard` | Platform Overview |
| `/dashboard/utility` | Utility Overview (was the hub) |
| `/dashboard/utility/map` | Utility GIS Map |
| `/dashboard/utility/ai` | Utility AI Assistant (planned) |
| `/dashboard/minigrid` | Mini-grid Overview (was Sites) |
| `/dashboard/minigrid/map` | Mini-grid GIS Map |
| `/dashboard/minigrid/ai` | Mini-grid AI Assistant (planned) |
| `/dashboard/minigrid/sites` | Sites (moved from `/dashboard/minigrid`) |
| `/dashboard/map`, `/dashboard/intelligence/gis` | Redirect to the Platform Overview |

- On a desktop the menu is a sidebar. On a phone it is one row with a Menu
  button; the menu opens over the page and closes when a screen is chosen.
- "AI Assistant" carries the word "Planned" in a dashed outline in the
  menu.
- The data bar on a phone is two lines: the SYNTHETIC DATA label, the
  period and the as-of time are always in view; the sentence that says what
  the dataset is opens with one tap ("What is this?").
- On a phone the page now starts 126 px down instead of 251 px.

## 3. Screen layouts

### One pattern for every screen

1. **The answer first**: what needs attention, in a few lines.
2. **One small visual** where a picture is faster than a sentence.
3. **The detail**: tables and breakdowns.
4. **One tap away, never removed**: the rule that listed a finding, the
   other figures behind it, source and method, the status and origin key,
   the methodology notes.

### One way of showing a finding

A coloured edge with **a mark and a word** (▲ Act, ◆ Check, ● Note), the
kind of finding, one sentence, the figure with its status and origin, a link
to the screen that owns the figure, and "Rule, figures, source & method"
folded under it. It is one component (`system/Attention.tsx`) fed by one
view model (`AttentionItemView`), used on the Platform Overview and on both
sector Overviews.

### Built in the prototype

| Screen | Layout |
| --- | --- |
| **Platform Overview** | A brand hero that says what GridIntel does in one sentence, with no figure in it. Three claims in words. "What the records show": three findings from each sector, side by side. Every sector on one small map. The sectors to join, marked planned |
| **Utility Overview** | Three headline figures (ATC&C, collection efficiency, revenue not realised). "What needs attention": the open fault, the transformers over their rating, the feeder losing the most revenue, the standing source alarms, the assets listed. The loss split as one bar. Ways in: the map, the six workspaces, the assistant |
| **Mini-grid Overview** | "What needs attention": the portfolio's own findings. Generation mix by site as bars. Ways in |
| **GIS Map (each sector)** | The shared map with that sector's layers. The Mini-grid map opens with its sites on |
| **AI Assistant (planned)** | Says first that it is not built. Four example questions, each naming the screen that answers it today. How it will work. No box to type in, no button, no conversation |

### Proposed for the screens not yet rebuilt

Nothing below is built. It is what UI-B would do, in the chosen direction.

| Screen | Proposed |
| --- | --- |
| **Executive** | "Where to look first" in the one finding component. The rule text folded. Revenue gap, losses and reliability as three sections with one visual each (gap by feeder as bars; loss split; SAIDI by attribution), each table folded behind "Show the table" on a phone. The valuation table moved to Revenue, where it already is |
| **Operations levels** | The level's own findings first. Tabs or anchors for Energy, Revenue, Reliability, Loading, Alarms, Children instead of one column of panels. Children as cards on a phone, a table on a desktop |
| **Reliability** | The feeder ranking as bars with the rule finding above; band compliance as a strip of days; the three breakdowns folded |
| **Revenue** | The gap as two stacked parts per feeder; collection by class as bars with government first; the valuation table as it is, in a scrolling frame |
| **Assets** | The attention list in the finding component; each class table in a scrolling frame with its first column fixed |
| **Events / Alarms** | "In progress now" first and largest; the two lists (source alarms, derived conditions) as cards on a phone; cleared alarms folded |
| **Sites, and a site** | Site cards kept; a site's sections reached by anchors; state of charge and the generation mix kept as they are |
| **Every table** | Inside its own scrolling frame, so the page never slides; the first column fixed; type no smaller than 12 px |
| **Source and method** | Opens under the figure at full width on a phone, not as a floating box |

## 4. Three visual directions

Each is shown on the Platform Overview and on Executive (a data screen that
has not been rebuilt, so it shows what a direction does to the densest
screen as it stands), at desktop and phone width. Files:
`docs/screenshots/phase-ui-a/directions/<direction>-<screen>-<width>.png`.

All three keep IBM Plex, the same layout, the same status colours, and data
areas with no blur, glow or movement.

### A. Control room

Dark first. Near-black blue, one cyan accent, square corners, dense. The
look of a network-management console, refined.

| Role | Dark | Light |
| --- | --- | --- |
| Page / panel | `#05080f` / `#0a101b` | `#eef1f4` / `#fbfcfd` |
| Text | `#f2f7fb` | `#06101c` |
| Brand and links | `#2cc4e8` | `#057fa3` |
| Shape | 2 px corners | |

- *For it*: closest to today, so the least change; reads as an operations
  tool; dense screens look at home.
- *Against it*: it is what every SCADA product looks like, so it does not
  read as new; weakest in daylight; cyan sits close to the teal of "ok".

### B. Clean light

Light first. White and cool grey, one cobalt accent, soft corners, no
gradient anywhere.

| Role | Light | Dark |
| --- | --- | --- |
| Page / panel | `#ffffff` / `#ffffff` | `#111315` / `#17191c` |
| Text | `#101418` | `#f3f4f5` |
| Brand and links | `#1a5fd6` | `#6ea0ff` |
| Shape | 10 px corners | |

- *For it*: the most readable in daylight on a phone; the calmest; nothing
  to tire of.
- *Against it*: it has no face. With the logo covered it could be any
  analytics product, and the brief asks for a clear brand; cobalt is also
  the first chart colour, so a link and a bar can look alike.

### C. Energy brand (recommended, and what the prototype is built in)

One brand colour, a violet-indigo, used in two ways. In **brand areas** (the
hero, a sector's header band, a planned page) it is striking: a deep indigo
to violet gradient with a cyan light, a fine grid, and a drawn energy system
whose lines carry a slow current. In **data areas** it is only an accent on
calm surfaces: the active menu item, a link, a focus ring.

| Role | Light | Dark |
| --- | --- | --- |
| Page / panel | `#f4f5f8` / `#ffffff` | `#0a0c13` / `#11141d` |
| Text | `#0d111c` | `#f5f6f9` |
| Brand | `#5340e0` | `#8f7dff` |
| Links | `#4331c9` | `#a9b4ff` |
| Hero | `#140f3d` to `#2a1c8a` to `#3b2bd0`, with cyan `#22c3e6` and violet `#8f7dff` light | the same in both themes |
| Shape | 12 px panels, 8 px tiles | |

- *For it*: a clear brand colour that is **none of the three status hues**
  (teal, amber, red) and none of the three chart colours (blue, orange,
  green), so the brand can never be read as a status or a series. Light and
  dark are equals. The hero looks like a current AI and data product; the
  figures under it stay plain.
- *Against it*: violet is common among AI products this year, so it is less
  distinctive than it feels; a gradient hero must be kept to brand areas by
  discipline, which a rule and a browser test now hold (the hero holds no
  figure).

**Recommendation: C.** It is the only one of the three that gives GridIntel
a face without putting anything between the reader and a figure. If C is
not liked, B is the safer second: it is the best on a phone in daylight.

### Shared by all three (built)

| Token | Light | Dark | Meaning |
| --- | --- | --- | --- |
| ok | `#0b93a1` | `#22a6b8` | every input present and measured |
| caution | `#c98500` | `#c08600` | estimated inputs, a caveat, a finding |
| alert | `#c8324a` | `#ea5470` | insufficient data, over rating |
| series 1, 2, 3 | `#2a78d6` `#eb6834` `#1baf7a` | `#3987e5` `#d95926` `#199e70` | technical, commercial, collection |

- The three status colours were checked as a set for deuteranopia,
  protanopia and tritanopia against each theme's surface, and every pair
  passes. **"ok" is now a teal, not a green**: that is what makes the set
  safe. Each status still carries its mark and its word.
- The chart colours pass the same check in both themes. On white, the green
  is under 3:1 against the surface, so every chart writes its values beside
  its marks.
- Type: body text 13 px (was 12), captions 12 (was 11), table heads 11 (was
  10), nothing under 10 (was 9).

## 5. What the prototype is, and is not

**Built**: the navigation and the shell (sidebar, phone menu, the folding
data bar, a theme button); light and dark themes from one set of tokens; the
Platform Overview; the Utility and Mini-grid Overviews; a GIS Map for each
sector; the AI Assistant (planned) page for each sector; the redirects; the
one finding component; two small visuals; the read models behind the
overviews, tested.

**Not rebuilt**: Executive, Operations and its levels, Reliability, Revenue,
Assets, Events / Alarms, Sites and the site screens. They take the new
tokens (colours, type sizes, panel shape) because every component names a
token, and nothing else about them changed. Their problems in section 1 are
still there: on a phone nine of them still slide sideways.

**No dependency was added.** The hero art, the visuals and the motion are
SVG and CSS written by hand. No UI or animation library is proposed.

## 6. Decisions for the Founder

1. **The visual direction**: A, B or C.
2. **"ok" as a teal instead of a green**, for colour-blind safety. It is
   built; it can be put back, at the cost of the green and the red being
   one colour for about one man in twelve.
3. **The default theme.** Built: the reader's device decides, and their
   choice is kept. The alternative is to open in one theme for everyone.
4. **What became of the old Platform Overview.** Its architecture diagram,
   the founder's story and the partner logos are not on the new one. The
   files are still in the repository and nothing links to them. Say whether
   any of it belongs on the product, or on a separate public site.
5. **The hero sentence**: "See where energy and money are lost, and trace
   every figure to its source." It is the product's first line; it is the
   Founder's to word.
6. **Type sizes went up one step on every screen**, including the ones not
   rebuilt. That makes dense tables a little wider.
7. **The order of UI-B**, if the direction is approved: recommended
   Executive, then Events / Alarms, then the Operations levels, then the
   rest, since that is the order a visitor meets them in.
