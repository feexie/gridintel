import { redirect } from "next/navigation";
import { hrefOf } from "@/constants/views";

export default function HomePage() {
  redirect(hrefOf("platform.home"));
}
