import { Sidebar } from "@/components/sidebar";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireProfile();

  return (
    <div className="shell">
      <Sidebar profile={profile} />
      <main className="main">{children}</main>
    </div>
  );
}
