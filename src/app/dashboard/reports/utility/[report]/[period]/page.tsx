import { reportPage } from "@/app/dashboard/reportRoutes";

const route = reportPage("utility");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
