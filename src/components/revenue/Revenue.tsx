import Link from "next/link";
import type { CustomerClassRow, RevenueWorkspaceView } from "@/services/revenue/views";
import { KeyFold, SectorBand } from "@/components/system/Brand";
import { Fold, SectionNav, Sources, WideOpen } from "@/components/system/Fold";
import { MetricCell, MetricTile, Panel } from "@/components/system/Metric";
import { DecompositionBar, RevenueGapPanel } from "@/components/system/Panels";
import { HeadRow, Row, ShareBar, SubHead, Table, Td, Th } from "@/components/system/Table";
import { formatMoney, formatNumber, levelHref } from "@/components/system/format";

/** Billing and collection by customer class. Government (MDA) accounts are a class of their own and are marked. */
function ClassTable({ rows, currency, name }: { rows: CustomerClassRow[]; currency: string | null; name: string }) {
  return (
    <Table name={name} wide>
      <HeadRow>
        <Th>Customer class</Th>
        <Th right>Accounts</Th>
        <Th right>Billed</Th>
        <Th right>Collected</Th>
        <Th right>Collection eff.</Th>
        <Th right>Not collected</Th>
        <Th className="w-1/4">Share of what was not collected</Th>
      </HeadRow>
      <tbody>
        {rows.map((row) => (
          <Row key={row.category} id={row.category}>
            <Td>
              {row.category === "government" ? <span className="mr-1 text-caution">▲</span> : null}
              {row.label}
            </Td>
            <Td figure>{formatNumber(row.accounts)}</Td>
            <Td figure>{formatMoney(row.revenueBilled, currency)}</Td>
            <Td figure>{formatMoney(row.revenueCollected, currency)}</Td>
            <Td right>
              <MetricCell metric={row.collection} />
            </Td>
            <Td figure>{formatMoney(row.notCollected, currency)}</Td>
            <Td>{row.shareOfNotCollected === null ? <span className="text-ink-5">no shortfall</span> : <ShareBar share={row.shareOfNotCollected} />}</Td>
          </Row>
        ))}
      </tbody>
    </Table>
  );
}

const SECTIONS = [
  { id: "gap", label: "Revenue gap" },
  { id: "collection", label: "Collection by class" },
  { id: "loss-by-feeder", label: "Loss by feeder" },
];

export function Revenue({ view }: { view: RevenueWorkspaceView }) {
  const currency = view.revenueBilled.currency;
  return (
    <div className="space-y-4">
      <SectorBand eyebrow="Utility Intelligence" title="Revenue">
        {view.organization ?? "Organization not recorded"} · where revenue is not realised, who is not paying, and whether the loss is commercial or collection.
      </SectorBand>
      <SectionNav sections={SECTIONS} />
      <KeyFold />

      <RevenueGapPanel id="gap" gap={view.gap} below={{ title: "By feeder", rows: view.gapByFeeder }} valuation={view.valuation} bars={view.gapBars} />

      <Panel id="collection" title="Collection by customer class" aside="Cash basis: received in the period against billed in the period">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          <MetricTile metric={view.collectionEfficiency} sourcing={view.sourcing} emphasis />
          <MetricTile metric={view.revenueBilled} sourcing={view.sourcing} />
          <MetricTile metric={view.revenueCollected} sourcing={view.sourcing} />
        </div>
        <SubHead>Across the portfolio</SubHead>
        <ClassTable rows={view.byCustomerClass} currency={currency} name="class-portfolio" />
        <Fold label="What the classes and “not collected” mean" name="class-notes">
          <p>
            <span className="text-caution">▲</span> Government (MDA) accounts are ministries, departments and agencies, kept as a class of their own. &quot;Not collected&quot; is
            billed less collected in the period. It is not the amount owed: money received in a period may settle earlier bills. A class with no shortfall is never set against the
            others.
          </p>
        </Fold>
        <WideOpen label="Show each feeder's classes" name="class-by-feeder">
          <div className="grid gap-3 xl:grid-cols-2">
            {view.feeders.map((feeder) => (
              <div key={feeder.id} className="min-w-0" data-class-feeder={feeder.id}>
                <SubHead>
                  <Link href={levelHref("feeder", feeder.id)} className="normal-case tracking-normal text-link hover:text-link-hover hover:underline">
                    {feeder.name}
                  </Link>
                </SubHead>
                <ClassTable rows={feeder.byCustomerClass} currency={currency} name={`class-${feeder.id}`} />
              </div>
            ))}
          </div>
        </WideOpen>
      </Panel>

      <Panel id="loss-by-feeder" title="Commercial against collection loss, by feeder" aside="Energy not billed, beside energy billed and not paid for">
        <div className="grid gap-4 xl:grid-cols-2">
          {view.feeders.map((feeder) => (
            <div key={feeder.id} className="min-w-0" data-loss-feeder={feeder.id}>
              <SubHead>
                <Link href={levelHref("feeder", feeder.id)} className="normal-case tracking-normal text-link hover:text-link-hover hover:underline">
                  {feeder.name}
                </Link>
              </SubHead>
              <DecompositionBar losses={feeder.losses} />
            </div>
          ))}
        </div>
        <WideOpen name="loss-by-feeder">
          <Table name="loss-by-feeder" wide>
            <HeadRow>
              <Th>Feeder</Th>
              <Th right>Commercial loss</Th>
              <Th right>Collection loss</Th>
              <Th right>Technical loss</Th>
              <Th right>ATC&amp;C</Th>
              <Th right>Commercial gap</Th>
              <Th right>Collection gap</Th>
            </HeadRow>
            <tbody>
              {view.feeders.map((feeder) => (
                <Row key={feeder.id} id={feeder.id}>
                  <Td>
                    <Link href={levelHref("feeder", feeder.id)} className="text-link hover:text-link-hover hover:underline">
                      {feeder.name}
                    </Link>
                    <span className="block text-micro text-ink-5">{feeder.band ? `Band ${feeder.band}` : "No band recorded"}</span>
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.losses.parts.commercial} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.losses.parts.collection} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.losses.parts.technical} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.losses.atcc} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.commercialGap} />
                  </Td>
                  <Td right>
                    <MetricCell metric={feeder.collectionGap} />
                  </Td>
                </Row>
              ))}
            </tbody>
          </Table>
        </WideOpen>
        <Fold label="How the losses are measured" name="loss-notes">
          <p>
            Losses are shares of each feeder&apos;s own energy input, so a small feeder can have the largest share and the smallest sum of money. Commercial loss is a derived residual
            and inherits the technical-loss estimate; collection loss is calculated from bills and payments. The two gaps are the same losses in money, monthly, and are never set
            against each other.
          </p>
        </Fold>
      </Panel>

      <Sources sourcing={view.sourcing} />
    </div>
  );
}
