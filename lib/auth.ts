import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "editor" | "viewer";

export type CurrentProfile = {
  id: string;
  email: string | null;
  full_name: string;
  role: AppRole;
  active: boolean;
};

export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,active")
    .eq("id", user.id)
    .single();

  if (error || !profile || !profile.active) {
    await supabase.auth.signOut();
    redirect("/login?error=inactive");
  }

  return profile as CurrentProfile;
}

export function canEdit(role: AppRole) {
  return role === "admin" || role === "editor";
}

export function isAdmin(role: AppRole) {
  return role === "admin";
}
