# A Multi-Year Daily Operations Dataset from a Rural Solar Mini-Grid in Southern Nigeria

**Authors:** Tam Kemabonta and Abiye Geoffrey
**License:** [CC BY 4.0](LICENSE)
**DOI:** _to be added on deposit_

## Overview

Daily electricity use per smart meter, daily site totals, customer-level payment records, customer attributes and tariff information for one rural solar mini-grid (Site A, southern Nigeria; site code RMG01), with site description, equipment, capital cost, operating cost lines, tariffs, an outage log with reliability indices, and meter communications uptime. All identifiers are replaced by pseudonymous codes.

| Item | Description |
| --- | --- |
| Source | Smart-meter and payment system export from the mini-grid's management platform, plus operator documents for the site, cost, tariff and reliability tables. |
| Location | Southern Nigeria. No more precise location is given. |
| Coverage | Per-meter daily readings 2020-08-26 to 2025-01-25 (1,614 days, 1,576 with data). Payments 2020-07-17 to 2025-01-26. Community daily series 2022-06-06 to 2025-01-25. Meter communications uptime 2020-08-26 to 2026-10-24 (communications only). |
| Time resolution | Daily. No hourly or sub-daily data. |
| Units | Energy in kWh. Money in Nigerian naira (NGN). |
| Time zone | UTC+01:00 (West Africa Time). All dates are local calendar dates. |
| Size | 133 meters with readings; 142 customer-meter links; 248 customer codes; 6 agent codes; 142,450 meter-days; 21,300 payment records. |
| Main totals | Sum of per-meter kWh 25,050.9; PAY payments NGN 7,499,650 (19,769 payments). |

## Files

All files are in `data/`. The workbook `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026.xlsx` has 19 sheets. Each sheet is also provided as a CSV named `Rural_Solar_MiniGrid_Operations_Dataset_10-24-2026_<Sheet>.csv`, plus `..._Coding_Convention.csv`, which repeats the coding convention.

| Table | Rows | Content |
| --- | --- | --- |
| README_Overview | 42 | Title, authors, citation, license, source, coverage, units |
| Site_Description | 38 | Technology, capacities, customers, energization, years of operation |
| Equipment | 16 | As-built equipment and design-only items |
| CAPEX | 17 | Actual build cost by category; 2019 estimate (design only) |
| OPEX | 11 | Operating cost lines that exist |
| Tariffs | 4 | Tariffs stated by the operator |
| Reliability_Outages | 17 | Logged outage events, Dec 2020 to Nov 2021 |
| Reliability_Indices | 12 | Monthly SAIDI, CAIDI, SAIFI, CAIFI, CIII, MAIFI, ASAI |
| Site_Daily | 1,614 | Daily site kWh, meters reporting, payments, data flags, logged outage flag |
| Site_Monthly | 54 | Site_Daily by month |
| Site_Yearly | 6 | Site_Daily by year |
| Meter_Daily | 142,450 | Daily kWh per meter code and customer class |
| Meter_Uptime | 804 | Communications uptime per meter code, six reports |
| Customers | 248 | Class, year created, linked meters |
| Meter_Customer_Link | 142 | Meter code and customer code of each customer-meter pair |
| Payments | 21,300 | Payment events (PAY, UCU, REV) with agent and customer codes |
| Tariffs_and_Events | 14 | Tariffs, dated events and data notes |
| Data_Dictionary | 129 | Every column with unit, source and notes |
| Caveats | 29 | Known gaps and limitations |

## Coding convention

- Site: `RMG01`. Meters: `RMG01-Mnnnn`. Customers: `RMG01-Cnnnn`. Agents: `RMG01-Axx`.
- Codes are ordered by coarse dates (first reading date, creation year, first payment date), with ties ordered at random using a fixed seed. The mapping key to real identifiers is held privately by the data custodian and is not part of this dataset.
- Names, phone numbers, payment references, SIM numbers, coordinates, balances and real meter, customer and agent identifiers are removed. Customer creation dates are reduced to the year, and payment times are removed.
- Codes `RMG01-M0135` to `RMG01-M0145` are linked meters with no daily readings and appear only in Meter_Customer_Link.

## Key caveats

See the `Caveats` table for the full list. In brief:

- No per-meter usage or community series for 38 days, 2023-04-26 to 2023-06-02 (blank, not zero).
- The site total measured at the site data concentrator is higher than the sum of per-meter readings (17.9% over all days with both). Operator observations: the air conditioning of the battery and inverter enclosure was never metered, and customers were observed stealing electricity and bypassing meters. The data does not allow the gap to be split between these.
- No PV generation, battery or voltage data is included.
- Payments (PAY) are credit purchases, not the value of energy used.
- Tariff change dates are approximate.
- Site, cost and equipment values come from operator documents, not measurements.

## How to cite

Kemabonta, T., & Geoffrey, A. (2026). *A Multi-Year Daily Operations Dataset from a Rural Solar Mini-Grid in Southern Nigeria* [Data set]. DOI to be added.

See also `CITATION.cff`.

## License

This dataset is licensed under the Creative Commons Attribution 4.0 International License (CC BY 4.0). See [LICENSE](LICENSE).
