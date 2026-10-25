import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/session";

export default async function Home() {
  const s = await getSession();
  redirect(s ? ROLE_HOME[s.role] : "/login");
}
