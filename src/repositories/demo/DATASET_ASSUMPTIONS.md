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
- Boundary meters (substation incomers, feeder heads, transformer
  totalizers) and telemetry are hourly. Real boundary meters usually record
  every 15 or 30 minutes; hourly keeps the dataset small.
- **A customer meter reports only what that kind of meter can report**
  (ADR 0009; see "Customers and metering"). Consumption is still modelled
  hour by hour for every connection, to size the bills, the vends and the
  boundary meters. Most of it is never written out as an observation.

## Network

| Level | Records |
| --- | --- |
| Organization | Savanna Electricity Distribution (synthetic); invented |
| Region | Northfield; invented |
| Substations | Riverside and Hillcrest, both 33/11 kV injection substations. Riverside has one 33 kV incomer and one 5 MVA power transformer. Hillcrest has two incomers, two power transformers (T1 5 MVA, T2 2.5 MVA) and two sections of 11 kV busbar |
| Feeders | Riverside: Market Road (Band A, 120 A) and Old Town (Band C, 120 A). Hillcrest: Government Avenue (Band B, 200 A) and Farm Road (Band D, 60 A). All 11 kV |
| Distribution transformers | 48, rated 50–500 kVA, 11/0.415 kV: 12 on Market Road, 14 on Old Town, 12 on Government Avenue, 10 on Farm Road |
| Connections | 6,448: 6,447 at low voltage and 1 customer supplied at 11 kV |

- **Hillcrest is laid out as most Nigerian injection substations are.** Each
  33 kV incomer has its own power transformer and its own section of the
  11 kV busbar, and the two sections are run apart (no bus coupler is
  modelled). The town 33 kV line feeds T1 and bus section A, which carries
  Government Avenue. The rural 33 kV line feeds T2 and bus section B, which
  carries Farm Road. Each incomer has its own boundary meter, and the
  substation's energy received is the sum of the two. The ratings are
  assumptions sized to the feeders: Government Avenue is rated 3.8 MVA and
  Farm Road 1.1 MVA. The registry records the bus section on the power
  transformer; a feeder is on the section of the transformer it is fed from.
- **The four feeders are four different problems.** Market Road is
  commercial and well metered. Old Town is mostly unmetered with poor
  collection. Government Avenue is well metered and well run, but loses its
  collection to government accounts. Farm Road is rural, mostly unmetered,
  and on a bus section whose 33 kV line fails on most days.
- **Six transformers are designed by hand; 42 are generated.** The first
  three on Market Road and on Old Town keep the figures they had before the
  network was widened. Every other transformer is generated from its
  feeder's profile: a fixed list of ratings, and for each a customer count
  sized so that the evening peak falls at a loading drawn from a range
  (50–82% on Market Road, 50–88% on Old Town, 50–80% on Government Avenue,
  40–75% on Farm Road). Generated transformers are named by number
  ("Old Town transformer 7").
- **Feeder loading is now that of a loaded feeder.** Peak loading is about
  79% of rating on Market Road, 81% on Old Town, 72% on Government Avenue
  and 54% on Farm Road. The caveat shown beside feeder loading when each
  feeder carried three transformers has been removed.
- **Four transformers peak above their rating.** DT-OLD-2 has too many
  connections for its rating on purpose. DT-GOV-3, DT-GOV-10 and DT-GOV-4
  were not designed by hand: on Government Avenue the customer count is
  sized for the evening peak, and the daytime load of the government
  accounts comes on top of it, so these three peak above rating in office
  hours. This is a consequence of how the generator sizes a transformer,
  kept because it is a realistic case, and it is not a claim about any real
  asset.
- **Coordinates** place the network near Yola so a map has somewhere to draw
  it. The assets do not exist. Hillcrest is placed about 7 km north-east of
  Riverside. Generated transformers are spaced along a straight heading from
  their substation, with a small random offset. Service points are scattered
  within about 300 m of their transformer. A feeder's route is a straight
  polyline from the substation through its transformers. A power transformer
  has no coordinates of its own; it is in its substation.
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
  falls below 12 hours on 2 days, when a fault or the upstream loss comes on
  top of load shedding.
- Government Avenue is Band B (minimum 16 h). It averages about 17.7 hours a
  day and falls below 16 hours on 7 days.
- Farm Road is Band D (minimum 8 h). It averages about 9.3 hours a day and
  falls below 8 hours on 9 days, when its 33 kV supply fails on top of load
  shedding.
- The band on a feeder is stored as a classification only. Hours of supply
  are calculated from the outage log, never read from the band.
- The day-by-day test is a GridIntel reference calculation, not a regulatory
  determination.

## Customers and metering

By feeder:

| Feeder | Connections | Prepaid | Postpaid | Unmetered |
| --- | --- | --- | --- | --- |
| Market Road (with the 11 kV customer) | 1,477 | 962 | 332 | 183 |
| Old Town | 2,141 | 574 | 365 | 1,202 |
| Government Avenue (with 90 government accounts) | 1,766 | 937 | 779 | 50 |
| Farm Road | 1,064 | 177 | 127 | 760 |

The six hand-designed transformers, unchanged by the widening:

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
- **Government (MDA) accounts** are a customer category of their own, kept
  apart from "public" services. There are 90, all on Government Avenue:
  about 0.03 per kVA of each transformer's rating. Each is metered, postpaid
  and billed on a meter reading as a maximum-demand account, with a mean
  peak demand of 14 kW. What sets them apart is how seldom they pay.
- **Demand class.** The 11 kV customer and the government accounts are
  recorded as maximum-demand (MD). MD and medium-voltage accounts are left
  out of the rate that values unbilled energy in the revenue gap. On Farm
  Road, 2% of accounts (19) have no demand class recorded in the registry:
  they are left out of the rate, not assumed to be non-MD, and the revenue
  gap says how many. Every other account is non-MD.
- DT-MKT-3 is fully metered on purpose, and every meter on it is an AMI
  meter, so one transformer has a complete downstream boundary and its
  measured cross-checks can be made.
- Disconnected for the whole month, using nothing: 3% of connections on Old
  Town (75) and 4% on Farm Road (49).
- **What each kind of customer meter reports** (ADR 0009):

  | Meter | Meters | What the dataset holds | Meter type |
  | --- | --- | --- | --- |
  | AMI | 288 | Hourly interval energy | `smart` |
  | Postpaid, not AMI | 1,447 | Two readings of the register: at 00:00 on 1 September and at 23:00 on 30 September | `conventional` |
  | Prepaid, not AMI | 2,518 | Nothing from the meter. Its vends are in the billing records | `conventional` |
  | Unmetered | none | Nothing | none |

  - **AMI meters** are on every maximum-demand account (the 90 government
    accounts and the 11 kV customer) and on 4.7% of the other metered
    accounts (197): 7% on Market Road, 5% on Government Avenue, 1% on Old
    Town and on Farm Road, plus all 30 connections of DT-MKT-3. They are
    hourly, to match the boundary meters.
  - **Register readings** are held for the 1,425 postpaid meters that are
    not AMI and whose account is active. The reading round reaches a meter
    at 23:00 on 30 September, half an hour before the billing run, so a
    reading covers what was used up to 23:00 and the bill raised on it
    covers 1 September 00:00 to 30 September 23:00, not the whole month.
    Reading every meter at the same instant, and at the first instant of the
    month, is a simplification: a real round takes days.
  - **Some readings are estimated.** The round misses 5% of meters on Market
    Road and Government Avenue, 20% on Old Town and 25% on Farm Road: 138
    in all. The billing system then estimates the closing reading, between
    75% and 125% of what the meter actually registered. The reading is held
    with quality `estimated` and the bill raised on it has basis
    `estimated`, each saying why.
  - **Prepaid meters that are not AMI are not read.** What the model knows
    they registered is used to size their vends and is never written out.
    Energy vended is shown as "energy purchased" and is never added to
    recorded consumption: credit is carried from one month to the next.
  - The meter with a two-day gap (see "Deliberate data-quality cases") is an
    AMI meter, since only an AMI meter has intervals to lose.
- Bypassed meters, as a share of metered connections: 5% on Market Road, 8%
  on Old Town, 2% on Government Avenue and 10% on Farm Road. A bypassed
  meter records 45% of what is consumed.
- An unmetered connection uses 25% more than a metered one of the same kind.

## Consumption

- Each connection has a peak demand drawn between 50% and 150% of its group
  mean: residential 0.9 kW (Market Road), 0.55 kW (Old Town), 1.0 kW
  (Government Avenue) or 0.35 kW (Farm Road); commercial 1.2–3.2 kW;
  government 14 kW; the 11 kV customer 120 kW.
- Demand follows a fixed daily shape per category (residential peaks at
  20:00, commercial at 10:00–14:00, government in office hours with little
  outside them and 20–25% at weekends), a weekday factor, a daily factor per
  transformer (±8%) and hourly noise per connection (±20%).
- Consumption is zero for exactly the time a transformer is off.
- No load pickup after an outage, no seasonality, no reverse flow.

## Technical losses

Fixed fractions of the energy entering each section, not load-dependent:

- Low-voltage network and transformer: 4.5–6% on Market Road and Government
  Avenue, 7.5–10% on Old Town (10% on DT-OLD-2), 9–13% on Farm Road.
- 11 kV line: 2% on Market Road, 3.5% on Old Town, 2.2% on Government Avenue,
  5% on Farm Road.
- Power transformer and busbars: 1% at each substation.

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
  the Band A feeder, ₦63.00 on Band B, ₦50.00 on Band C and ₦43.00 on Band D,
  the same for non-maximum-demand and maximum-demand customers. No VAT,
  fixed charges or arrears.
- Prepaid: two to four vends in the month, each paid when raised, for 94–106%
  of what the meter registered. The utility does not hold that figure; only
  the vends.
- Postpaid with an AMI meter, government accounts included: one bill at a
  month-end run (30 September, 23:30) for what the meter recorded.
- Postpaid with any other meter: one bill at the same run for the advance of
  the register between its two readings, or for an estimate of it where the
  meter was not read. Such a bill is an estimated bill and counts toward the
  estimated share of energy billed.
- Unmetered: one estimated bill at the same run for a fixed energy,
  residential / commercial: 220 / 600 kWh on Market Road, 90 / 250 on Old
  Town, 180 / 450 on Government Avenue, 55 / 160 on Farm Road. These figures
  are invented; they are not NERC capping values.
- Collection is on a cash basis. Each postpaid or unmetered account pays in
  full, pays nothing, or pays 30–80%, with these chances of paying in full /
  nothing:

  | Feeder | Postpaid | Unmetered | Government |
  | --- | --- | --- | --- |
  | Market Road | 70% / 8% | 40% / 25% | none on this feeder |
  | Old Town | 40% / 30% | 15% / 50% | none on this feeder |
  | Government Avenue | 80% / 5% | 50% / 20% | 8% / 72% |
  | Farm Road | 35% / 35% | 12% / 55% | none on this feeder |

  The 11 kV customer pays 93%. Government accounts come out at about 20%
  collected, against about 95% for residential accounts on the same feeder.
- Simplification: the money received in September is sized against the
  September bill. In reality it would settle earlier bills.

## Outages

- **Load shedding** in whole-hour blocks, attributed to transmission: Market
  Road is off for 2–5 hours on two days in three (a five-hour block leaves 19
  hours, under its band minimum); Old Town is off for 4–5 hours overnight and
  5–6 hours in the day, every day; Government Avenue is off for one block of
  4–9 hours every day, starting between midnight and 02:00 (a nine-hour block
  leaves 15 hours, under its band minimum); Farm Road is off for 6 hours
  overnight and 6–7 hours in the day, every day.
- **Every interruption records where it began** (its origin point): the
  grid, the transmission station, a 33 kV line, an 11 kV feeder, a
  transformer or the low-voltage network. Responsibility follows from that,
  not from an "upstream" label (ADR 0006, amendment). The 33 kV lines that
  feed the injection substations are the distribution company's own, as they
  are in Nigeria; only the 132/33 kV transmission station and the grid are
  upstream. Load shedding is recorded as beginning on the grid and stays its
  own class: a shortfall in the supply allocated, neither a network fault nor
  a loss of upstream supply.
- **Farm Road loses the long rural 33 kV line that supplies it on about two
  days in three** (19 times in the month), for 2–5 hours from about 17:00,
  on top of load shedding. Sixteen of these are faults on the line itself:
  the distribution company's, and network-attributable. Three (10, 18 and 29
  September) are outages at the transmission station the line comes from:
  the transmission company's, and upstream.
- The rural line's losses interrupt Farm Road only, because the line feeds
  Hillcrest's second incomer and bus section B, and Farm Road is the only
  feeder on that section. Government Avenue, on bus section A, is
  unaffected. The three transmission-station outages are of the 33 kV
  breaker that supplies the rural line, so they too interrupt bus section B
  only.
- Nine individual events: an 11 kV fault on Old Town restored in two stages,
  a three-minute feeder trip on Market Road, planned maintenance on DT-MKT-2,
  a fault on the 33 kV line feeding Riverside that took out the whole
  substation, a transformer fault on DT-OLD-2, a storm outage on DT-OLD-3, an
  11 kV cable fault on Government Avenue, planned maintenance on DT-GOV-4 and
  a low-voltage fault on DT-FRM-3.
- **The Riverside event was a choice.** The record says only that the
  substation lost its 33 kV supply for 3 h 35 min. It is modelled as a fault
  on Riverside's own 33 kV line, so it is network-attributable. Had it begun
  at the transmission station it would be upstream.
- Neither the 33 kV lines nor the transmission station are assets in the
  registry. Their outages name them in words, as unresolved references.
- Individual events are placed in hours that load shedding never uses on the
  feeder concerned, so no supply is recorded as off twice at once.
- One customer complaint with no restoration time, to show how an incomplete
  record is excluded from the indices rather than guessed at.
- Every interruption is recorded per transformer. Its customer count is the
  number of active accounts connected under that transformer in the
  registry, held as `topology_derived`. That is the realistic case for an
  outage system with a network model, and it is what the dataset actually
  does. A derived count is not an estimate, so it does not make the
  reliability indices "calculated with estimates"; the indices carry a
  warning that the counts come from the network model.
- The one customer complaint has a count of 1, held as `recorded`. It has no
  origin point: where it began is not known.

## Deliberate data-quality cases

- One AMI customer meter on DT-MKT-2 has no intervals for 14–15 September (a
  gap of 48 hours).
- Four hourly readings of the DT-OLD-3 totalizer are marked `estimated`.
- One transformer monitor (DT-OLD-3) stops sending heartbeats nine hours
  before the demo clock.

## Reported figures

A synthetic monthly report states ATC&C, collection efficiency, SAIDI and
SAIFI for each substation and each feeder, and ATC&C and collection
efficiency for the region. They were written to
differ from what the records support, so that reported and calculated values
can be compared. Each figure states its basis:

- SAIDI and SAIFI count network interruptions only (no load shedding, no
  loss of upstream supply), with planned work included. They are compared
  with the network-attributable calculation, never with the total.
- ATC&C is a fraction of energy input, with collection on a cash basis.
- Collection efficiency is on a cash basis, except Old Town's, which is
  deliberately on an accrual basis so that one comparison on the screens
  shows the "not comparable" case.

**The report deliberately misattributes 33 kV faults.** It is written as a
utility would state it: faults on its own 33 kV lines are booked as loss of
upstream supply, so its "network interruptions only" SAIDI and SAIFI leave
them out. The calculation puts those faults on the network, where they
belong. Both figures state the same basis, so they are compared, and the
difference shows as a variance:

| Scope | SAIDI reported | SAIDI calculated, network | Variance | SAIFI reported | SAIFI calculated, network |
| --- | --- | --- | --- | --- | --- |
| Riverside | 3.0 h | 6.9 h | +3.9 h | 0.9 | 1.65 |
| Hillcrest | 1.9 h | 22.8 h | +20.9 h | 0.8 | 6.56 |
| Market Road | 0.2 h | 3.8 h | +3.6 h | 0.1 | 1.05 |
| Old Town | 5.0 h | 9.2 h | +4.2 h | 1.4 | 2.08 |
| Government Avenue | 2.7 h | 3.1 h | +0.4 h | 1.0 | 1.08 |
| Farm Road | 0.4 h | 57.1 h | +56.7 h | 0.2 | 16.11 |

This variance is a designed finding, not an error. The reported figures must
not be retuned to remove it. Government Avenue shows no such gap because no
33 kV line fault interrupted it.

## Not modelled

Alarms, maintenance records, DER, embedded generation, reactive power flows,
voltage, tariff classes within a band, arrears, customer movement between
service points and topology changes.
