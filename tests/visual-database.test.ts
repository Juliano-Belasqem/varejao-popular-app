import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { createVisualDocument } from "../lib/visual-engine";
test("applied foundation preserves offers and immutable template versions under RLS", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
 create table profiles(id uuid primary key,role text,active boolean);
 create function public.can_edit() returns boolean language sql stable as $$select exists(select 1 from profiles where id=auth.uid() and active and role in ('admin','editor'))$$;
 create table products(id uuid primary key,unit text,ean text,name text,brand text,specification text);
 create table campaigns(id uuid primary key,start_date date,end_date date,created_by uuid,updated_by uuid);
 create table campaign_items(id uuid primary key default gen_random_uuid(),product_id uuid references products,campaign_id uuid references campaigns,normal_price numeric,offer_price numeric,highlighted_price text,ean_snapshot text,name_snapshot text,brand_snapshot text,specification_snapshot text,sort_order integer,unique(campaign_id,product_id));
 insert into profiles values('00000000-0000-4000-8000-000000000001','editor',true),('00000000-0000-4000-8000-000000000002','viewer',true),('00000000-0000-4000-8000-000000000003','editor',false);
 insert into products(id,name,unit) values('00000000-0000-4000-8000-000000000010','Leite','UN');
 insert into campaigns(id,start_date,end_date) values('00000000-0000-4000-8000-000000000020','2026-09-01','2026-09-30');
 insert into campaign_items(product_id,campaign_id,normal_price,offer_price) values('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000020',6,5);
 grant usage on schema public,auth to authenticated,anon;grant select on profiles,products,campaigns to authenticated;grant select,insert,update,delete on campaign_items to authenticated;`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20260920050000_offers_foundation.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (
        await db.query<{ n: number }>(
          "select count(*)::int n from campaign_items where offer_id is null",
        )
      ).rows[0].n,
      0,
    );
    const role = async (n: number) =>
      db.exec(
        `reset role;set role authenticated;set test.uid='00000000-0000-4000-8000-${String(n).padStart(12, "0")}';`,
      );
    await role(1);
    const doc = createVisualDocument("Original");
    const save = async (id: string | null, name: string) =>
      db.query<{ template_id: string; version: number }>(
        "select * from save_visual_template($1,$2,'custom',$3::jsonb,auth.uid())",
        [id, name, JSON.stringify({ ...doc, name })],
      );
    const first = (await save(null, "Original")).rows[0];
    assert.equal(first.version, 1);
    const second = (await save(first.template_id, "Revisado")).rows[0];
    assert.equal(second.version, 2);
    const versions = await db.query<{ version: number; document: typeof doc }>(
      "select version,document from visual_template_versions order by version",
    );
    assert.equal(versions.rows[0].document.name, "Original");
    assert.equal(versions.rows[1].document.name, "Revisado");
    await db.exec(
      "update visual_template_versions set document='{}';delete from visual_template_versions;",
    );
    assert.equal(
      (await db.query("select * from visual_template_versions")).rows.length,
      2,
      "versions cannot be changed or deleted by editor",
    );
    await assert.rejects(
      db.query(
        "select * from save_visual_template($1,'Inválido','custom',$2::jsonb,auth.uid())",
        [first.template_id, JSON.stringify({ ...doc, width: -1 })],
      ),
    );
    assert.equal(
      (
        await db.query<{ current_version: number }>(
          "select current_version from visual_templates",
        )
      ).rows[0].current_version,
      2,
    );
    await role(2);
    assert.equal(
      (await db.query("select * from visual_template_versions")).rows.length,
      2,
    );
    await assert.rejects(save(first.template_id, "Proibido"), /Sem permissão/);
    await role(3);
    assert.equal(
      (await db.query("select * from visual_template_versions")).rows.length,
      0,
    );
    await assert.rejects(save(null, "Proibido"), /Sem permissão/);
    await db.exec("reset role;set role anon;");
    await assert.rejects(
      db.query("select * from visual_templates"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
