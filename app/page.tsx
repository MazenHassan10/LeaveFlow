import { redirect } from "next/navigation";
import { LoginScreen } from "@/src/components/login-screen";
import { PendingScreen } from "@/src/components/pending-screen";
import { getSessionProfile } from "@/src/lib/session";

export default async function Home() {
  const { profile, setupError } = await getSessionProfile();

  if (!profile) return <LoginScreen setupError={setupError} />;
  if (profile.status !== "Active") return <PendingScreen profile={profile} />;
  redirect("/employee");
}
