import { redirect } from "next/navigation";
import { getSessionFromCookies } from "@/lib/auth";
import { JellypullShell } from "@/components/JellypullShell";

export default async function HomePage() {
  const session = await getSessionFromCookies();
  if (!session.authenticated) {
    redirect("/login");
  }

  return <JellypullShell username={session.username || "admin"} />;
}
