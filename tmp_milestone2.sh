#!/usr/bin/env bash
set -euo pipefail

cd /home/yusuf/gridintel

mkdir -p \
  src/app/dashboard/utility/network \
  src/app/dashboard/utility/assets/substations/[id] \
  src/app/dashboard/utility/assets/feeders/[id] \
  src/app/dashboard/utility/assets/transformers/[id] \
  src/app/dashboard/utility/assets/meters/[id] \
  src/app/dashboard/utility/outages \
  src/app/dashboard/utility/revenue \
  src/app/dashboard/utility/alarms \
  src/app/dashboard/utility/control-room \
  src/app/dashboard/intelligence/analytics \
  src/app/dashboard/intelligence/gis \
  src/app/dashboard/intelligence/ai \
  src/app/dashboard/der \
  src/app/dashboard/minigrid \
  src/app/dashboard/planning \
  src/app/dashboard/reports \
  src/app/dashboard/settings

mkdir -p src/components/intelligence src/services/intelligence src/features
mkdir -p src/data/utility src/data/der src/data/minigrid src/data/planning

# Move mock data out of lib into data, preserving module folders.
if [ -d src/lib/mock ]; then
  cp -a src/lib/mock/. src/data/
  rm -rf src/lib/mock
fi

cat > src/types/common.ts <<'EOF'
export type Status = "online" | "offline" | "warning";

export interface Coordinates {
  latitude: number;
  longitude: number;
}
EOF

cat > src/app/dashboard/layout.tsx <<'EOF'
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
EOF

placeholder='export default function Page() {
  return (
    <div>
      <h1>Coming Soon</h1>
    </div>
  );
}
'

files=(
  src/app/dashboard/page.tsx
  src/app/dashboard/utility/page.tsx
  src/app/dashboard/utility/network/page.tsx
  src/app/dashboard/utility/assets/page.tsx
  src/app/dashboard/utility/assets/substations/page.tsx
  src/app/dashboard/utility/assets/substations/[id]/page.tsx
  src/app/dashboard/utility/assets/feeders/page.tsx
  src/app/dashboard/utility/assets/feeders/[id]/page.tsx
  src/app/dashboard/utility/assets/transformers/page.tsx
  src/app/dashboard/utility/assets/transformers/[id]/page.tsx
  src/app/dashboard/utility/assets/meters/page.tsx
  src/app/dashboard/utility/assets/meters/[id]/page.tsx
  src/app/dashboard/utility/outages/page.tsx
  src/app/dashboard/utility/revenue/page.tsx
  src/app/dashboard/utility/alarms/page.tsx
  src/app/dashboard/utility/control-room/page.tsx
  src/app/dashboard/intelligence/analytics/page.tsx
  src/app/dashboard/intelligence/gis/page.tsx
  src/app/dashboard/intelligence/ai/page.tsx
  src/app/dashboard/der/page.tsx
  src/app/dashboard/minigrid/page.tsx
  src/app/dashboard/planning/page.tsx
  src/app/dashboard/reports/page.tsx
  src/app/dashboard/settings/page.tsx
)

for f in "${files[@]}"; do
  printf "%s" "$placeholder" > "$f"
done
