import type { ReactNode } from "react";
import { SyntheticBanner } from "@/components/operations/Level";
import { getDataNotice } from "@/composition/operations";

export default function OperationsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SyntheticBanner notice={getDataNotice()} />
      {children}
    </>
  );
}
