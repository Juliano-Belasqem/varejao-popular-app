import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("media mutation guard rejects publishing/published changes and permits draft edits", async () => {
  const db = new PGlite();
  const publication = "00000000-0000-4000-8000-000000000101";
  const media = "00000000-0000-4000-8000-000000000102";
  try {
    await db.exec(`
      create type public.publication_status as enum ('draft','scheduled','publishing','published','error','cancelled');
      create table public.publications(id uuid primary key, status public.publication_status not null);
      create table public.publication_media(
        id uuid primary key, publication_id uuid not null references public.publications(id) on delete cascade,
        storage_path text not null
      );
    `);
    await db.exec(readFileSync(new URL("../supabase/migrations/20261003090000_guard_publication_media_mutation.sql", import.meta.url), "utf8"));
    await db.query("insert into public.publications(id,status) values ($1,'draft')", [publication]);
    await db.query("insert into public.publication_media(id,publication_id,storage_path) values ($1,$2,'a.png')", [media,publication]);
    await db.query("update public.publications set status='publishing' where id=$1", [publication]);
    await assert.rejects(db.query("delete from public.publication_media where id=$1", [media]), /Cannot modify media/);
    await assert.rejects(db.query("update public.publication_media set storage_path='b.png' where id=$1", [media]), /Cannot modify media/);
    await assert.rejects(db.query("insert into public.publication_media(id,publication_id,storage_path) values ('00000000-0000-4000-8000-000000000103',$1,'c.png')", [publication]), /Cannot modify media/);
    await db.query("update public.publications set status='published' where id=$1", [publication]);
    await assert.rejects(db.query("delete from public.publication_media where id=$1", [media]), /Cannot modify media/);
    await db.query("update public.publications set status='draft' where id=$1", [publication]);
    await db.query("update public.publication_media set storage_path='b.png' where id=$1", [media]);
    assert.equal((await db.query<{storage_path:string}>("select storage_path from public.publication_media where id=$1", [media])).rows[0].storage_path, "b.png");
    await db.query("delete from public.publications where id=$1", [publication]);
    assert.equal((await db.query("select id from public.publication_media")).rows.length, 0);
  } finally {
    await db.close();
  }
});
