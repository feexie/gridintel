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

It is generated in independent parts: the registry, the outage log, the alarm
list, and the energy and billing of each supply (a transformer's connections,
or the 11 kV customer). A question about one connection is answered from its
own supply, without generating the rest (`onDemand.ts`); the records are the
same ones the whole dataset holds, and a test compares the two for every
supply.

## Time

- Period: 1–30 September 2026, in West Africa Time (UTC+1).
- Demo clock ("now"): 1 October 2026, 00:00 WAT. Nothing is dated later.
- Boundary meters (substation incomers, feeder heads, transformer
  totalizers) and telemetry are hourly. Real boundary meters usually record
  every 15 or 30 minutes; hourly keeps the dataset small.
- **One more telemetry reading is taken at the demo clock itself**, from
  every transformer monitor and remote terminal unit, so that "loading now"
  is a reading made now and not the 23:00 one. Each connection's demand at
  that instant is one more draw of the rule used for every other hour (the
  midnight shape of Thursday 1 October). A supply still off under an open
  interruption reads zero: Farm Road's feeder, its ten transformers and
  Hillcrest T2, which carries Farm Road alone. A zero is a measured reading,
  not a gap. No interval energy is written at the clock, and the reading is
  outside the month, so no peak, energy, revenue or reliability figure
  moves. **No load-shedding block is taken to begin at the clock**, although
  Old Town, Government Avenue and Farm Road are shed from midnight on most
  days of the month: the dataset holds no interruption that starts at or
  after the clock, so the other three feeders read as on.
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
- **Two transformers peak above their rating, each on purpose** (Founder
  decision, Phase 6c-2). Which transformers are overloaded is a design
  decision and no longer follows from the random draws.

  - **DT-OLD-2** has too many connections for its rating: an evening
    overload from residential load (121.2% at 20:00 on 20 September, 69
    hours over).
  - **DT-GOV-3** is a daytime overload from government (MDA) load (110.6% at
    14:00 on Tuesday 29 September, 53 hours over). It is left at the 300 kVA
    the generator drew for it. Its nine government accounts draw their load
    in office hours, on top of a customer count sized for the evening, so
    its demand in office hours is 97% of rating before any variation and
    goes over on working days.

  **Every other generated transformer on Government Avenue is sized for its
  daytime peak.** The generator still counts a transformer's residential and
  commercial customers so that the evening peak falls at a loading drawn
  between 50% and 80% of the rating in the profile, and still adds
  government accounts at 0.03 per kVA of that rating, each with a mean peak
  of 14 kW in office hours. That is where the overloads used to come from:
  the government load falls by day, not in the evening the count was drawn
  for. The rating installed is now chosen afterwards:

  > the smallest standard rating (50, 100, 200, 300, 500, 750 or 1,000 kVA),
  > not below the one in the profile, that is larger than the transformer's
  > highest demand before variation × 1.296.

  The highest demand before variation is the busiest hour of the week for
  the connections as drawn, with the low-voltage loss and the power factor.
  1.296 is the most the variation can add: the largest daily factor (1.08)
  times the largest hourly noise (1.2). The bound uses the largest values
  there can be, not the ones that were drawn, so **none of these eleven can
  exceed its rating under any seed**. A test holds each to it.

  | Transformer | Rating before | Rating now | Peak before | Peak now |
  | --- | --- | --- | --- | --- |
  | DT-GOV-1 | 300 kVA | 500 kVA | 85.1% | 51.1% |
  | DT-GOV-2 | 200 kVA | 300 kVA | 91.1% | 60.7% |
  | DT-GOV-3 (designed) | 300 kVA | 300 kVA | 110.6% | 110.6% |
  | DT-GOV-4 | 200 kVA | 300 kVA | 101.3% | 67.6% |
  | DT-GOV-5 | 500 kVA | 750 kVA | 99.8% | 66.5% |
  | DT-GOV-6 | 200 kVA | 200 kVA | 84.8% | 84.8% |
  | DT-GOV-7 | 300 kVA | 500 kVA | 92.4% | 55.4% |
  | DT-GOV-8 | 200 kVA | 300 kVA | 86.7% | 57.8% |
  | DT-GOV-9 | 300 kVA | 500 kVA | 95.9% | 57.5% |
  | DT-GOV-10 | 200 kVA | 300 kVA | 104.4% | 69.6% |
  | DT-GOV-11 | 100 kVA | 100 kVA | 80.4% | 80.4% |
  | DT-GOV-12 | 200 kVA | 300 kVA | 96.0% | 64.0% |

  Nine ratings were raised by one standard size. Nothing else changed: the
  connections, their consumption, the bills, the payments, the outages and
  the feeder's own loading (72.3% of its 200 A) are exactly as before, so no
  energy, revenue or reliability figure moved.

  The guarantee has a cost that should be seen: a rating must be 1.3 times
  the demand before variation, so the eleven now peak at 51–85% of rating
  where they peaked at 80–104%. Government Avenue no longer runs close to
  rating by day. A rule that only made an overload unlikely would leave them
  higher, and would bring the seed back in.

  DT-GOV-3 is not guaranteed in the same way: it is overloaded with the
  connections as drawn under the dataset's fixed seed, and a test holds it
  there. The other feeders are unchanged. Their generated transformers are
  sized for the evening at up to 82–88% of rating before variation, and none
  goes over with the fixed seed.

  The case is realistic (a transformer in a government district that peaks
  by day), and it is not a claim about any real asset.
- **Coordinates** place the network near Yola so a map has somewhere to draw
  it. The assets do not exist. Hillcrest is placed about 7 km north-east of
  Riverside. Generated transformers are spaced along a straight heading from
  their substation, with a small random offset. Service points are scattered
  within about 300 m of their transformer. A feeder's route is a straight
  polyline from the substation through its transformers, and the registry
  marks it `schematic`: it shows what is connected, not where a line runs,
  and a map must say so. The registry does not say how any point was
  obtained, so points are `unspecified`. A power transformer has no
  coordinates of its own; it is shown at its substation, marked `inherited`.
- **Three invented districts** are laid over the network so that "what is
  inside an area" and "totals by area" have areas to work on (`areas.ts`).
  They are rectangles named "Demonstration district South / North-west /
  North-east (synthetic)", of kind `other`. **They are not administrative
  boundaries**: no state, LGA or ward of Nigeria is in the dataset. South
  holds Riverside, all of Old Town and four Market Road transformers;
  North-west holds Hillcrest, all of Government Avenue and two Market Road
  transformers; North-east holds Farm Road's ten transformers and six of
  Market Road's. Market Road's route crosses all three and Farm Road's
  crosses one boundary, so neither feeder is in any one district. The
  organization has no territory record: the only viewer of the
  demonstration sees everything.
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
  | Postpaid, not AMI | 1,447 | Two readings of the register: one from August's reading round, one from September's | `conventional` |
  | Prepaid, not AMI | 2,518 | Nothing from the meter. Its vends are in the billing records | `conventional` |
  | Unmetered | none | Nothing | none |

  - **AMI meters** are on every maximum-demand account (the 90 government
    accounts and the 11 kV customer) and on 4.7% of the other metered
    accounts (197): 7% on Market Road, 5% on Government Avenue, 1% on Old
    Town and on Farm Road, plus all 30 connections of DT-MKT-3. They are
    hourly, to match the boundary meters.
  - **Register readings** are held for the 1,425 postpaid meters that are
    not AMI and whose account is active.
  - **The reading round takes days.** A reader walks one transformer's
    meters as a route, between 08:00 and 16:00. Every route's September
    round ends on 30 September, in time for the billing run that night. Most
    routes take two or three days (28 to 30 September); three long routes
    take four (27 to 30 September). Which day and hour a meter is read is
    fixed by its place on the route, so it is read at the same place in
    August's round, 30 days earlier. A bill therefore covers 30 days that
    begin and end up to four days before the calendar month does.
  - **August is not modelled.** The model has hourly consumption for
    September only. What a meter registered on the last days of August is
    taken to be what it registered on the same weekday four weeks later.
    This is an assumption of the model, used only to size the advance; no
    August consumption is written out as an observation.
  - **A register advance counts toward recorded consumption** when both
    readings are within 3 days of the period's ends (ADR 0010): from
    29 August, and from 28 September. 1,267 advances count, as their own
    measured source beside the 287 complete AMI meters. The first day of
    each long route falls outside the window, on purpose, so that the
    exclusion and its reason show on screen:

    | Route | First day read | Outside the window | Meters |
    | --- | --- | --- | --- |
    | DT-FRM-4, DT-FRM-7 (long rural routes, Farm Road) | 28 August and 27 September | The opening reading, and the closing one | 8 |
    | DT-OLD-6 (Old Town's largest route; its August round began a day late, so its cycle is 29 days) | 29 August and 27 September | The closing reading only | 16 |

    Where both readings are outside, the screen gives the first reason: no
    reading within 3 days of the start of the period.
  - **Some readings are estimated.** The round misses 5% of meters on Market
    Road and Government Avenue, 20% on Old Town and 25% on Farm Road: 138
    in all. The billing system then estimates the closing reading, between
    75% and 125% of what the meter actually registered, and dates it when
    the meter was due to be read. The reading is held with quality
    `estimated` and the bill raised on it has basis `estimated`, each saying
    why. An advance resting on an estimated reading is not counted toward
    recorded consumption. Four of the 138 are also on the first day of a
    long route and are counted once, under the window. So the "register
    advance not counted" connections on the screens are 158: 134 estimated,
    8 with no opening reading in the window and 16 with no closing one.
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
  the register between its two readings (a 30-day reading cycle, not the
  calendar month), or for an estimate of it where the meter was not read. Such a bill is an estimated bill and counts toward the
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
- **One outage is open at the demo clock** (ADR 0013, amendment): an 11 kV
  fault on Farm Road, conductor down, from 23:20 on 30 September. All ten
  transformers are off, nothing has been restored, and the record has no
  restoration time and the status `open`. *Designed so "Interruptions in
  progress" is not empty.* Every other designed outage has the status
  `closed`.
  - The energy model removes Farm Road's consumption for its last 40
    minutes, so energy received, billed and unbilled moved slightly.
  - **It counts in SAIDI, SAIFI and hours of supply, to the end of the
    period**, and those figures are marked provisional (ADR 0013, second
    amendment). Farm Road's SAIDI is 442.5 h with it and would be 441.8 h
    without: 40 minutes for each of its 1,015 customers. 30 September
    becomes the tenth day below the band minimum.
  - **Farm Road's reported SAIDI and SAIFI were raised to 1.0 h and 1.1**
    (from 0.4 h and 0.2), so that the report still agrees with the records
    on its own attribution rule.
  - Loading "now" on Farm Road is the reading at the demo clock: zero, on
    the feeder, on its ten transformers and on Hillcrest T2 (see "Time").
- One customer complaint with no restoration time and no status, to show how
  an incomplete record is excluded from the indices rather than guessed at.
  It is a data-quality item, not an interruption in progress.
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

## Alarms

The alarm list a utility's SCADA and monitors would hold (ADR 0011 and its
amendment). 32 alarms, each with the source's code and the kind it maps to.

- **27 follow from the outage log**, raised when supply was lost and cleared
  when the last part was restored: 19 losses of the rural 33 kV line and the
  Riverside line fault (`INCOMER-UV`), four feeder trips, three transformer
  or low-voltage faults (`DT-LV-LOSS`). Load shedding and planned work raise
  none. The alarm of the Farm Road fault still open at the demo clock is
  not cleared: it is standing, acknowledged at 23:24.
- **Feeder trips name the protection that operated.** Overcurrent
  (`FDR-OC-TRIP`): the three-minute trip and reclose on Market Road, and the
  cable fault on Government Avenue, which locked out. Earth fault
  (`FDR-EF-TRIP`): the conductor down on Old Town, and the one on Farm Road
  that is still open.
- **Communications failures** (`RTU-COMMS-FAIL`). The front end polls every
  remote unit hourly, substation RTUs and transformer monitors alike, and
  alarms on the second missed poll.
  - The monitor on DT-OLD-3: raised 16:55 on 30 September, two polls after
    its last check-in at 14:55; acknowledged; standing at the demo clock.
    *Designed so a source alarm and a derived condition agree.*
  - Riverside's RTU: 10:08 to 10:41 on 12 September. It falls between two
    hourly readings, so no reading is missing. Heartbeats are held for the
    last day only, so it leaves no trace there.
- **No overload alarm.** The source systems have none. *Designed so the
  loading conditions on DT-GOV-3 and DT-OLD-2 are derived conditions that no
  source alarm raised.*
- **Three more alarms for the states a list must show**: one standing and
  unacknowledged (Hillcrest DC supply), one standing and acknowledged
  (Riverside T1 oil temperature), one entered by hand with no raise time
  (`DOOR-OPEN`). The last has a code that is not mapped to a kind.
- The alarm record is complete. That is what lets a screen say "no source
  alarm was raised"; from a partial record it could only say it cannot tell.
- Simplification: the source's alarm rule for a silent unit (two missed
  hourly polls) and the reference rule (120 minutes) give the same instant.
  A real front end polls far more often than a monitor checks in.

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
them out. The reference calculation puts those faults on the network, where
they belong. The table sets the reported figures beside the reference
calculation:

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

**The report states its attribution rule in one place and not in another**
(ADR 0007, amendment), so that both cases are on the screens:

- Its **feeder tables** carry a definition of upstream that includes the
  33 kV lines. Each feeder figure states that rule, and is compared with a
  calculation made on it: Market Road 0.2 h against 0.2 h, Old Town 5.0 h
  against 5.6 h, Government Avenue 2.7 h against 3.1 h, Farm Road 0.4 h
  against 0.4 h. The reference figure from the table above is shown beside
  each, which is where the finding now appears at feeder level.
- Its **substation summary** carries no definition. The two substation
  figures are compared with the reference calculation, as in the table
  above, under a note that the variance may reflect a difference in
  classification.

Which part of the report states its rule is a choice made for the
demonstration, not a claim about how utilities report.

## Not modelled

Overload alarms, maintenance records, DER, embedded generation, reactive power flows,
voltage, tariff classes within a band, arrears, customer movement between
service points and topology changes.
