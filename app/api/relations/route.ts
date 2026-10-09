import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { canEdit, isAdmin } from "@/lib/auth";
import { parseRelationItems } from "@/lib/supplier-relations";

async function context() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("id,role,active").eq("id", user.id).single();
  if (!profile?.active) return { response: NextResponse.json({ error: "Perfil inativo" }, { status: 403 }) } as const;
  return { supabase, profile } as const;
}

export async function GET() {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  const { data, error } = await ctx.supabase.from("supplier_relations").select("id,supplier_id,status,notes,created_at,finalized_at,cancellation_reason,suppliers(id,name),supplier_relation_items(id,product_id,occurrence_id,quantity,products(id,ean,name))").order("created_at", { ascending: false }).limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  if (!canEdit(ctx.profile.role)) return NextResponse.json({ error: "Sem permissão para criar rascunhos" }, { status: 403 });
  const body = await request.json().catch(() => null) as { supplier_id?: string; notes?: string; items?: unknown } | null;
  if (!body?.supplier_id || !Array.isArray(body.items)) return NextResponse.json({ error: "Fornecedor e itens são obrigatórios" }, { status: 400 });
  const items = parseRelationItems(JSON.stringify(body.items));
  const { data: relation, error } = await ctx.supabase.from("supplier_relations").insert({ supplier_id: body.supplier_id, notes: body.notes?.trim() || null, created_by: ctx.profile.id, updated_by: ctx.profile.id }).select("id").single();
  if (error || !relation) return NextResponse.json({ error: error?.message ?? "Não foi possível criar" }, { status: 400 });
  const { error: itemsError } = await ctx.supabase.from("supplier_relation_items").insert(items.map((item) => ({ relation_id: relation.id, product_id: item.product_id, occurrence_id: item.occurrence_id, quantity: item.quantity })));
  if (itemsError) { await ctx.supabase.from("supplier_relations").delete().eq("id", relation.id); return NextResponse.json({ error: itemsError.message }, { status: 400 }); }
  return NextResponse.json({ id: relation.id, status: "draft" }, { status: 201 });
}

export async function PATCH(request: Request) {
  const ctx = await context();
  if ("response" in ctx) return ctx.response;
  const body = await request.json().catch(() => null) as { id?: string; action?: string; reason?: string } | null;
  if (!body?.id || !["finalize", "cancel"].includes(body.action ?? "")) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  if (!isAdmin(ctx.profile.role)) return NextResponse.json({ error: "Somente administradores podem finalizar ou cancelar" }, { status: 403 });
  const rpc = body.action === "finalize" ? "finalize_supplier_relation" : "cancel_supplier_relation";
  const args = body.action === "finalize" ? { p_relation_id: body.id } : { p_relation_id: body.id, p_reason: body.reason ?? "" };
  const { data, error } = await ctx.supabase.rpc(rpc, args);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
