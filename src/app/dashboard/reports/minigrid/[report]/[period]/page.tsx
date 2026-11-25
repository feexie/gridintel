import { reportPage } from "@/app/dashboard/reportRoutes";

const route = reportPage("minigrid");

export const generateStaticParams = route.generateStaticParams;
export const generateMetadata = route.generateMetadata;
export default route.Page;
