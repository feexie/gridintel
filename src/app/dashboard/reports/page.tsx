import { allReportsIndex } from "@/app/dashboard/reportRoutes";

/* Every report the viewer may open, across sectors. Open to anyone who may open one report
   (constants/access.ts). */
export default function AllReportsPage() {
  return allReportsIndex();
}
