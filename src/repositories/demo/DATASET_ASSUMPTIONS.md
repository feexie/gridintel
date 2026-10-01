# Synthetic demo dataset: assumptions

**This dataset is synthetic.** It describes no real utility, network, asset,
customer, meter reading, outage, bill or payment. Every record's provenance
names a data source of kind `synthetic`, and every service result derived from
it carries `sourcing.synthetic = true`, which the UI must show.

It was designed to exercise the analytics engine with a network that behaves
like a small Nigerian distribution network. Every number below is an
assumption made for that purpose. None is a measurement, and none should be
quoted as a fact about any real network.

The dataset is generated in code (`src/repositories/demo`) from a fixed seed.
It is identical on every build.

## Time

- Period: 1–30 September 2026, in West Africa Time (UTC+1).
- Demo clock ("now"): 1 October 2026, 00:00 WAT. Nothing is dated later.
- Interval energy and telemetry are hourly. Real boundary meters usually
  record every 15 or 30 minutes; hourly keeps the dataset small.

## Network

| Level | Records |
| --- | --- |
| Organization | Savanna Electricity Distribution (synthetic); invented |
| Region | Northfield; invented |
| Substation | Riverside 33/11 kV injection substation, one 2.5 MVA power transformer |
| Feeders | Market Road (Band A) and Old Town (Band C), both 11 kV, rated 120 A |
| Distribution transformers | 6, rated 50–300 kVA, 11/0.415 kV |
| Connections | 432: 431 at low voltage and 1 customer supplied at 11 kV |

- **Deliberately small, so feeder loading is not realistic.** A real 11 kV
  feeder carries dozens of transformers. Each feeder here carries three, so
  its peak loading is only 10–18% of rating. That figure is an artefact of
  the small model, not a picture of a loaded feeder, and the UI must say so
  wherever feeder loading is shown. Transformer loading is realistic. The fix
  (more transformers per feeder) is deferred to the Phase 6 dataset widening.
- **Coordinates** place the network near Yola so a map has somewhere to draw
  it. The assets do not exist. Service points are scattered within about
  300 m of their transformer. A feeder's route is a straight polyline from
  the substation through its transformers. The power transformer has no
  coordinates of its own; it is in the substation.
- **Names** of places, assets and the organization are invented. No personal
  names are generated.

## NERC service bands

Band definitions were checked against the NERC Service-Based Tariff FAQ
(nerc.gov.ng, checked 1 October 2026): minimum average hours of supply per
day of 20 (A), 16 (B), 12 (C), 8 (D) and 4 (E).

- Market Road is Band A (minimum 20 h). It averages about 21.5 hours a day,
  so it complies on average, but it falls below 20 hours on 7 of the 30 days.
  This is deliberate: a feeder that complies on average while failing on
  individual days is the realistic case.
- Old Town is Band C (minimum 12 h). It averages about 13.8 hours a day and
  falls below 12 hours on 3 days, when a fault or the upstream loss comes on
  top of load shedding.
- The band on a feeder is stored as a classification only. Hours of supply
  are calculated from the outage log, never read from the band.
- The day-by-day test is a GridIntel reference calculation, not a regulatory
  determination.

## Customers and metering

| Transformer | Rating | Connections | Prepaid | Postpaid | Unmetered |
| --- | --- | --- | --- | --- | --- |
| DT-MKT-1 Market Square | 300 kVA | 60 | 41 | 15 | 4 |
| DT-MKT-2 Garden Estate | 100 kVA | 76 | 52 | 7 | 17 |
| DT-MKT-3 Hilltop Close | 50 kVA | 30 | 23 | 7 | 0 |
| DT-OLD-1 Old Town Central | 100 kVA | 85 | 23 | 18 | 44 |
| DT-OLD-2 Riverbank | 100 kVA | 135 | 41 | 20 | 74 |
| DT-OLD-3 South Gate | 50 kVA | 45 | 17 | 7 | 21 |
| MV customer on Market Road | 11 kV | 1 | 0 | 1 | 0 |

- An unmetered connection has a service point and an account but no meter.
- DT-MKT-3 is fully metered on purpose, so one energy account is complete.
- DT-OLD-2 has too many connections for its rating on purpose.
- Nine accounts on Old Town are disconnected for the whole month and use
  nothing.
- **Every customer meter is treated as an interval-read smart meter**, prepaid
  ones included. In reality most prepaid meters are not read hourly. This is
  the largest simplification in the dataset.
- Bypassed meters: 5% of metered connections on Market Road and 8% on Old
  Town. A bypassed meter records 45% of what is consumed.
- An unmetered connection uses 25% more than a metered one of the same kind.

## Consumption

- Each connection has a peak demand drawn between 50% and 150% of its group
  mean: residential 0.9 kW (Market Road) or 0.55 kW (Old Town); commercial
  2.5–3.2 kW; the 11 kV customer 120 kW.
- Demand follows a fixed daily shape per category (residential peaks at
  20:00, commercial at 10:00–14:00), a weekday factor, a daily factor per
  transformer (±8%) and hourly noise per connection (±20%).
- Consumption is zero for exactly the time a transformer is off.
- No load pickup after an outage, no seasonality, no reverse flow.

## Technical losses

Fixed fractions of the energy entering each section, not load-dependent:

- Low-voltage network and transformer: 4.5–5.5% on Market Road, 7.5–10% on
  Old Town (10% on the overloaded transformer).
- 11 kV line: 2% on Market Road, 3.5% on Old Town.
- Power transformer and busbars: 1%.

Technical loss cannot be metered directly. The dataset therefore includes a
synthetic **technical-loss study** as reported figures, and the energy
account uses it as a reported input of quality `estimated`. Every result
built on it is therefore `calculated_with_estimates`, and commercial loss is
shown as a derived residual that inherits the study's uncertainty. The
synthetic study states the model's own loss, so the split happens to come out
exact here; a real study would not.

## Billing, tariffs and collection

- All amounts are in NGN, stored in kobo.
- **Tariffs are assumptions, not current published rates:** ₦209.50/kWh on
  the Band A feeder and ₦50.00/kWh on the Band C feeder, the same for
  non-maximum-demand and maximum-demand customers. No VAT, fixed charges or
  arrears.
- Prepaid: two to four vends in the month, each paid when raised, for 94–106%
  of what the meter recorded.
- Postpaid with a meter: one bill at a month-end run (30 September, 23:30)
  for what the meter recorded.
- Unmetered: one estimated bill at the same run for a fixed energy: 220 kWh
  (residential) or 600 kWh (commercial) on Market Road, 90 or 250 kWh on Old
  Town. These figures are invented; they are not NERC capping values.
- Collection is on a cash basis. Each postpaid or unmetered account pays in
  full, pays nothing, or pays 30–80%, with these chances of paying in full /
  nothing: Market Road postpaid 70% / 8%, unmetered 40% / 25%; Old Town
  postpaid 40% / 30%, unmetered 15% / 50%. The 11 kV customer pays 93%.
- Simplification: the money received in September is sized against the
  September bill. In reality it would settle earlier bills.

## Outages

- **Load shedding** in whole-hour blocks, attributed to transmission: Market
  Road is off for 2–5 hours on two days in three (a five-hour block leaves 19
  hours, under its band minimum); Old Town is off for 4–5 hours overnight and
  5–6 hours in the day, every day.
- Six individual events: an 11 kV fault on Old Town restored in two stages, a
  three-minute feeder trip on Market Road, planned maintenance on one
  transformer, a loss of 33 kV supply to the whole substation, a transformer
  fault on DT-OLD-2 and a storm outage on DT-OLD-3.
- One customer complaint with no restoration time, to show how an incomplete
  record is excluded from the indices rather than guessed at.
- Every interruption is recorded per transformer. Its customer count is the
  number of active accounts connected under that transformer in the
  registry, held as `topology_derived`. That is the realistic case for an
  outage system with a network model, and it is what the dataset actually
  does. A derived count is not an estimate, so it does not make the
  reliability indices "calculated with estimates"; the indices carry a
  warning that the counts come from the network model.
- The one customer complaint has a count of 1, held as `recorded`.

## Deliberate data-quality cases

- One customer meter on DT-MKT-2 has no readings for 14–15 September (a gap).
- Four hourly readings of the DT-OLD-3 totalizer are marked `estimated`.
- One transformer monitor (DT-OLD-3) stops sending heartbeats nine hours
  before the demo clock.

## Reported figures

A synthetic monthly report states ATC&C, collection efficiency, SAIDI and
SAIFI for the region, the substation and each feeder. They were written to
differ from what the records support, so that reported and calculated values
can be compared. Each figure states its basis:

- SAIDI and SAIFI count network interruptions only (no load shedding, no
  loss of upstream supply), with planned work included. They are compared
  with the network-attributable calculation, never with the total.
- ATC&C is a fraction of energy input, with collection on a cash basis.
- Collection efficiency is on a cash basis, except Old Town's, which is
  deliberately on an accrual basis so that one comparison on the screens
  shows the "not comparable" case.

## Not modelled

Alarms, maintenance records, DER, embedded generation, reactive power flows,
voltage, tariff classes within a band, arrears, customer movement between
service points and topology changes.
