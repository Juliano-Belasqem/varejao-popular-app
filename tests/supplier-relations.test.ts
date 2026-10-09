import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { availableStock, parseRelationItems } from "../lib/supplier-relations";

test("relation item parsing rejects invalid and duplicate allocations", () => {
  assert.deepEqual(parseRelationItems(JSON.stringify([{ product_id: "p1", quantity: "2,5" }])), [{ product_id: "p1", quantity: 2.5, occurrence_id: null }]);
  assert.throws(() => parseRelationItems(JSON.stringify([{ product_id: "p1", quantity: 1 }, { product_id: "p1", quantity: 2 }])), /Não repita/);
  assert.equal(availableStock(10, 3), 7);
});

test("database finalization is atomic, admin-only, concurrency-safe by row locks, and cancellation releases without deleting audit", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create type app_role as enum ('admin','editor','viewer');
      create table profiles(id uuid primary key, role app_role, active boolean);
      create table products(id uuid primary key, stock numeric);
      create table audit_logs(id bigint generated always as identity primary key, actor_id uuid, action text, entity_type text, entity_id text, details jsonb, created_at timestamptz default now());
      create function public.current_role() returns app_role language sql stable security definer as $$select role from profiles where id=auth.uid() and active$$;
      create function public.is_admin() returns boolean language sql stable security definer as $$select public.current_role()='admin'$$;
      create function public.can_edit() returns boolean language sql stable security definer as $$select public.current_role() in ('admin','editor')$$;
      create function touch_updated_at() returns trigger language plpgsql as $$begin new.updated_at=now(); return new; end$$;
      grant usage on schema public,auth to authenticated;
      grant select on profiles,products,audit_logs to authenticated;
      insert into profiles values ('00000000-0000-4000-8000-000000000001','admin',true),('00000000-0000-4000-8000-000000000002','editor',true);
      insert into products values ('00000000-0000-4000-8000-000000000010',10);
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261009100000_supplier_relations_reservations.sql", import.meta.url), "utf8"));
    await db.exec("reset role; set role authenticated; set test.uid='00000000-0000-4000-8000-000000000002';");
    const supplier = (await db.query<{ id: string }>("insert into suppliers(name) values('Fornecedor X') returning id")).rows[0].id;
    const relation = (await db.query<{ id: string }>("insert into supplier_relations(supplier_id,created_by) values($1,auth.uid()) returning id", [supplier])).rows[0].id;
    await db.query("insert into supplier_relation_items(relation_id,product_id,quantity) values($1,'00000000-0000-4000-8000-000000000010',7)", [relation]);
    await assert.rejects(db.query("select finalize_supplier_relation($1)", [relation]), /Somente administradores/);
    await db.exec("set test.uid='00000000-0000-4000-8000-000000000001';");
    await db.query("select finalize_supplier_relation($1)", [relation]);
    assert.equal((await db.query("select * from supplier_relation_reservations where released_at is null")).rows.length, 1);
    const second = (await db.query<{ id: string }>("insert into supplier_relations(supplier_id,created_by) values($1,auth.uid()) returning id", [supplier])).rows[0].id;
    await db.query("insert into supplier_relation_items(relation_id,product_id,quantity) values($1,'00000000-0000-4000-8000-000000000010',4)", [second]);
    await assert.rejects(db.query("select finalize_supplier_relation($1)", [second]), /Saldo insuficiente/);
    await db.query("select cancel_supplier_relation($1,'ajuste de recebimento')", [relation]);
    assert.equal((await db.query("select * from supplier_relation_reservations where released_at is null")).rows.length, 0);
    assert.equal((await db.query("select action from audit_logs where entity_id=$1", [relation])).rows.length, 2);
  } finally { await db.close(); }
});
