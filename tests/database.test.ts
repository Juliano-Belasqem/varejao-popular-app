import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("migration enforces RLS, persistence and atomic primary image replacement", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema storage;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
      create table profiles(id uuid primary key,role text,active boolean);
      create function public.can_edit() returns boolean language sql stable as $$select exists(select 1 from public.profiles where id=auth.uid() and active and role in ('admin','editor'))$$;
      create table products(id uuid primary key);
      create table product_images(id uuid primary key default gen_random_uuid(),product_id uuid references products,storage_path text,source text,source_url text,approved boolean,is_primary boolean,created_by uuid references profiles);
      create unique index one_primary on product_images(product_id) where is_primary;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
      alter table storage.objects enable row level security;
      alter table product_images enable row level security;
      create policy image_read on product_images for select to authenticated using(true);
      create policy image_edit on product_images for all to authenticated using(can_edit()) with check(can_edit());
      create policy product_storage_read on storage.objects for select to authenticated using(bucket_id='product-images');
      grant usage on schema public,auth,storage to authenticated,anon;
      grant select on profiles to authenticated;
      grant select,update on products to authenticated;
      grant select,insert,update,delete on product_images,storage.objects to authenticated;
      insert into profiles values ('00000000-0000-4000-8000-000000000001','editor',true),('00000000-0000-4000-8000-000000000002','viewer',true),('00000000-0000-4000-8000-000000000003','editor',false);
      insert into products values ('00000000-0000-4000-8000-000000000010');
      insert into storage.objects(bucket_id,name) values ('product-images','00000000-0000-4000-8000-000000000010/a.png'),('product-images','00000000-0000-4000-8000-000000000010/b.png');
    `);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20260919035044_configurable_templates_and_product_images.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const role = async (id: number) =>
      db.exec(
        `reset role; set role authenticated; set test.uid='00000000-0000-4000-8000-${String(id).padStart(12, "0")}';`,
      );
    await role(1);
    await db.exec(
      `update art_templates set layout='{"product":{"x":10}}',background_path='validity/test.png',revision=1 where id='validity'; insert into storage.objects(bucket_id,name) values('template-assets','validity/test.png');`,
    );
    const row = (
      await db.query<{ revision: number; background_path: string }>(
        "select * from art_templates where id='validity'",
      )
    ).rows[0];
    assert.equal(row.revision, 1);
    assert.equal(row.background_path, "validity/test.png");
    const first = (
      await db.query<{ id: string }>(
        "select register_product_image('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000010/a.png','manual') as id",
      )
    ).rows[0].id;
    const second = (
      await db.query<{ id: string }>(
        "select register_product_image('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000010/b.png','manual') as id",
      )
    ).rows[0].id;
    assert.notEqual(first, second);
    await assert.rejects(
      db.query(
        "select set_product_primary_image('00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000099')",
      ),
    );
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select id from product_images where is_primary",
        )
      ).rows[0].id,
      second,
    );
    await assert.rejects(
      db.query(
        "select register_product_image('00000000-0000-4000-8000-000000000010','missing.png','manual')",
      ),
    );
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select id from product_images where is_primary",
        )
      ).rows[0].id,
      second,
    );
    await role(2);
    assert.equal(
      (await db.query("select * from art_templates")).rows.length,
      3,
    );
    assert.equal(
      (await db.query("update art_templates set revision=2 returning id")).rows
        .length,
      0,
    );
    await assert.rejects(
      db.exec(
        "insert into storage.objects(bucket_id,name) values('template-assets','unauthorized.png')",
      ),
    );
    await assert.rejects(
      db.query(
        "select set_product_primary_image('00000000-0000-4000-8000-000000000010',$1)",
        [first],
      ),
    );
    await assert.rejects(
      db.query(
        "select remove_product_image('00000000-0000-4000-8000-000000000010',$1)",
        [second],
      ),
    );
    await role(1);
    await db.query(
      "select remove_product_image('00000000-0000-4000-8000-000000000010',$1)",
      [second],
    );
    assert.equal(
      (
        await db.query<{ id: string }>(
          "select id from product_images where is_primary",
        )
      ).rows[0].id,
      first,
    );
    await role(3);
    assert.equal(
      (await db.query("select * from art_templates")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select * from storage.objects where bucket_id='template-assets'",
        )
      ).rows.length,
      0,
    );
    await db.exec("reset role;set role anon;");
    await assert.rejects(db.query("select * from art_templates"));
    await assert.rejects(
      db.query(
        "select set_product_primary_image('00000000-0000-4000-8000-000000000010',$1)",
        [first],
      ),
    );
  } finally {
    await db.close();
  }
});
