# ADR 0016: Mini-grid sites: outside the substation tree, accounted from their own generation

Date: 2026-10-10
Status: Accepted. The Founder accepted it at the Phase 10a realism review
(2026-10-12): curtailment as built, and the other seven points under "For
the Founder to confirm", with three changes to the synthetic dataset. See
"As accepted" at the end.

## Context

The blueprint's section 13 listed where the domain and the engine assumed a
distribution utility: every asset under a substation, energy entering from
upstream, boundary-meter roles for a network only, and KPI and telemetry
vocabularies with no generation in them. A mini-grid fits none of these.

## Decisions

### 1. A site is an entity under no substation

`MinigridSite` (`src/domain/site.ts`) has an operator and no electrical
parent. `GenerationAsset` is a PV array, a battery, a generator or an
inverter of a site, with nameplate data only. `ScopeKind` gains `site`:
an electrical scope of its own, never a section of a network.

A site's connections are ordinary `ServicePoint`s whose supply is
`{ kind: "site" }`, with ordinary meters, accounts, charges and payments.
One canonical type per concept: nothing is copied for mini-grids.

`Customer` gains two optional fields: `tariffTier`, as the operator names
its tiers, and `productiveUse`. Absent means not recorded; an account with
no flag is never taken to be a household.

### 2. Site meters have roles of their own

`MeterInstallation` gains `generation` (the output of a PV array or a
generator), `storage` (import is charging, export is discharging) and
`site_output` (where the powerhouse hands over to the distribution
network). They belong to a site and to no network section, so they are
never added to a network energy account, and the rule against counting
embedded generation twice (ADR 0005, `metering.ts`) is untouched.

### 3. Generation is the energy-account input

For one site and one period (`src/analytics/site/energy.ts`, methodology
`gridintel.site.reference` 0.1.0):

```text
  PV generation          metered
+ Generator generation   metered
= Energy generated
− Net into storage       metered: energy in − energy out
− Station use            residual
= Energy sent out        metered: the energy available to customers
− Distribution loss      residual: technical loss and unmetered use together
= Energy delivered       customer meters
  → energy sold (billed), revenue billed, revenue collected
```

Every metered line needs every interval of every meter. A gap makes the
figure unavailable and names the meter; nothing is substituted.

### 4. Storage loss is calculated with an estimate

Storage loss is net energy into storage less the change in stored energy.
The change in stored energy is the change in state of charge times
nameplate capacity. Nameplate is not what an aged battery holds, so the
figure is `calculated_with_estimates`. The chain uses the metered net
intake and does not depend on it.

### 5. Curtailment stands beside the chain, as an estimate

Curtailed energy cannot be metered. It is the site controller's estimate
(`curtailed_power_kw`, quality `estimated`, method in provenance). Without
one it is not available; it is never derived by assuming a performance
ratio. It is not subtracted from energy generated (see point 1 below).

The performance ratio is PV energy over rated power times in-plane
irradiation at 1 kW/m², and counts curtailment as a loss, as IEC 61724
does. A second figure, "before curtailment", adds the estimate back, to
tell an array that is held back from one that is underperforming.

### 6. Availability is customer-weighted, from the interruption record

Uptime is one less customer-hours interrupted over connections times hours.
Hours of supply per day is 24 times that. Each is given with planned
interruptions and without, each stating its basis. An interruption the
source says is open counts to the period end, provisionally (as ADR 0013).
With no interruption record, availability is unknown, never 100%.

### 7. A real zero needs a complete register

A site with no generator generated nothing from one only when its asset
register is complete. Otherwise the same absence is unknown.

### 8. An operator's records are a set of repositories of their own

The mini-grid operator is another organization than the distribution
utility. Its records are served through the same ports by a second set of
repositories with its own result cache (`getMinigridRepositories`). The
utility's screens never read them, and nothing of the utility's enters a
site's figures. One new port, `SiteRepository`, holds the site register.

The alternative, one set holding both, was rejected for now: three existing
queries select by period alone (outages, alarms, and billing or reported
figures asked for without a filter), so the utility's read models would
have been handed the operator's records. Scoping those queries by
organization belongs with the viewer work of Phase 8.

The platform's list of data sources includes the operator's, so that a site
on the shared map is known to be synthetic and is never related to a real
area (ADR 0014).

### 9. Reported figures carry the basis that matters for a site

`KpiBasis` gains `shareOf` (energy generated or sent out), `connections`
(active or all) and `energySold` (billed or metered), and `lossBasis` gains
the two site denominators. A site report's claim is compared only with the
calculation on its own basis (ADR 0007).

## What was changed in Utility, and what was not

Changed, to admit the new kinds without behaving differently: the switches
over scope kind, meter role and supply kind in `boundary.ts`,
`reliability/scope.ts`, `topology/place.ts`, `topology/registry.ts` and
`operations/levels.ts` say that a site is not theirs. `mapView` takes an
optional `frame`. No Utility figure moved: its 551 unit tests pass with one
line changed in one test, a type narrowing.

Not changed: the network energy account, the cut, band compliance, the
revenue gap. A site does not go through them.

## For the Founder to confirm

1. **Curtailment is not subtracted from energy generated.** The brief
   reads "energy generated − storage losses − curtailment = energy
   available". Metered generation is already net of curtailment, which
   happens before the meter, so subtracting it would count it twice, and
   it would put an estimate inside a chain that is otherwise metered. As
   built, energy available is the metered energy sent out, and curtailment
   is an estimated figure beside PV generation. The alternative is a chain
   that starts from PV energy available (generation plus the estimate),
   which makes every line below it calculated with an estimate.
2. **Storage loss uses nameplate capacity** and is marked estimated.
3. **"Fuel share" is read as the generator's share of energy generated**
   (one less the renewable fraction), with fuel per kWh beside it.
4. **Energy sold is energy billed.** For a prepaid account that is energy
   purchased, as in Utility (ADR 0009). Consumption per connection, from
   customer meters, is a separate figure.
5. **Distribution loss is not split** into technical and commercial. That
   needs a loss study, and the dataset holds none for the sites.
6. **A low-battery disconnection is recorded as load shedding.** No new
   interruption cause was added.
7. **Two repository sets** rather than one, until Phase 8.
8. **Sites are on the Map workspace's layer list now**, off when the map
   opens. The layer is the platform's own and needed no screen work; the
   Mini-grid workspace and embedded site maps are 10b.

## As accepted (Founder, 2026-10-12)

**Curtailment as built is accepted.** Metered PV is already net of
curtailment, so it is shown beside PV generation as an estimate and is not
subtracted from energy generated. Points 2 to 8 are confirmed.

Three changes followed, all to the synthetic dataset and none to the
domain or the methodology. They are recorded in `DATASET_ASSUMPTIONS.md`.

1. **Generator dispatch.** Cycle charging at Tamarind Cross and Palm
   Landing: the generator runs at 75% of its rating and charges the
   battery. Load following at low output is kept at Dry River as a
   designed finding. Specific fuel consumption shows the contrast: 0.30
   litres per kWh against 0.42.
2. **Palm Landing's poor collection comes from postpaid accounts only**:
   its productive-use accounts on credit and its public institutions. No
   household or shop is postpaid at any site. The site commercial result
   gained collection by customer class (`byClass`), which says how many
   accounts of each class are prepaid and postpaid.
3. **Palm Landing's low state of charge is kept as a designed sign** of an
   ageing, undersized battery.
