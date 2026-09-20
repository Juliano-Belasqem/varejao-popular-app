// Local-only contract fixture. Never uses production credentials or contacts Supabase.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
const id = "00000000-0000-4000-8000-000000000001";
const productId = "00000000-0000-4000-8000-000000000010";
const png = readFileSync(
  new URL("../public/media-templates/validity-background.png", import.meta.url),
);
const profile = {
  id,
  email: "editor@example.test",
  full_name: "Editor de teste",
  role: "editor",
  active: true,
};
const product = {
  id: productId,
  name: "LEITE",
  brand: "LATVIDA",
  specification: "INTEGRAL 1L",
  ean: "7509546702667",
  sale_price: 5.49,
  unit: "UN",
  active: true,
};
const campaign = {
  id: productId,
  name: "Campanha de teste",
  theme: "Ofertas",
  start_date: "2026-09-01",
  end_date: "2026-09-30",
  status: "draft",
};
const templates = Object.fromEntries(
  ["validity", "digital-feed", "digital-story"].map((id) => [
    id,
    { id, layout: {}, background_path: null, revision: 0 },
  ]),
);
const objects = new Map([["product-images/test.png", png]]);
const visualTemplates=[];
const visualVersions=[];
let settings = {
  id: "default",
  logo_path: null,
  primary_color: "#2F42A6",
  accent_color: "#FF8A1F",
  field_fonts: {},
};
const images = [
  {
    id: productId,
    product_id: productId,
    storage_path: "test.png",
    approved: true,
    is_primary: true,
    source: "manual",
    created_at: new Date().toISOString(),
  },
];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:54329");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  if (req.method === "OPTIONS") {
    res.end();
    return;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const bytes = Buffer.concat(chunks);
  let body = {};
  try {
    body = JSON.parse(bytes.toString());
  } catch {}
  function json(data, status = 200) {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  }
  if (url.pathname === "/auth/v1/user")
    return json({
      id,
      aud: "authenticated",
      role: "authenticated",
      email: profile.email,
      app_metadata: {},
      user_metadata: {},
    });
  if (url.pathname === "/__role") {
    profile.role = url.searchParams.get("role") || "editor";
    return json({ ok: true });
  }
  if (url.pathname.startsWith("/storage/v1/object/list/")) return json([]);
  if (
    url.pathname.startsWith("/storage/v1/object/sign/") &&
    req.method === "POST"
  )
    return json({
      signedURL: url.pathname.replace("/storage/v1", "") + "?token=test",
    });
  if (url.pathname.startsWith("/storage/v1/object/")) {
    const key = url.pathname.replace(
      /^\/storage\/v1\/object\/(authenticated\/|sign\/)?/,
      "",
    );
    if (req.method === "POST") {
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        const request = new Request("http://localhost", {
          method: "POST",
          headers: { "content-type": req.headers["content-type"] },
          body: bytes,
        });
        const form = await request.formData();
        const file = form.get("");
        objects.set(
          key,
          file instanceof File ? Buffer.from(await file.arrayBuffer()) : bytes,
        );
      } else objects.set(key, bytes);
      return json({ Key: key, Id: crypto.randomUUID() });
    }
    const data = objects.get(key) || png;
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(data);
    return;
  }
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    if(url.pathname.endsWith("save_visual_template")){
      if(profile.role==="viewer")return json({message:"Sem permissão."},403);
      const templateId=body.p_template_id||crypto.randomUUID();
      let template=visualTemplates.find(t=>t.id===templateId);
      if(!template){template={id:templateId,current_version:0,active:true};visualTemplates.push(template)}
      Object.assign(template,{name:body.p_name,category:body.p_category,current_version:template.current_version+1,updated_at:new Date().toISOString()});
      visualVersions.push({template_id:templateId,version:template.current_version,document:body.p_document,created_at:new Date().toISOString()});
      return json([{template_id:templateId,version:template.current_version}]);
    }
    if (url.pathname.endsWith("register_product_image")) {
      images.forEach((i) => (i.is_primary = false));
      const image = {
        id: crypto.randomUUID(),
        product_id: body.p_product_id,
        storage_path: body.p_storage_path,
        approved: true,
        is_primary: true,
        source: body.p_source,
      };
      images.push(image);
      return json(image.id);
    }
    return json(null);
  }
  const table = url.pathname.split("/").pop();
  const eq = (name) => url.searchParams.get(name)?.replace(/^eq\./, "");
  let data = [];
  if(table==="visual_templates")data=visualTemplates.filter(t=>!eq("id")||t.id===eq("id")).slice().reverse();
  if(table==="visual_template_versions")data=visualVersions.filter(v=>(!eq("template_id")||v.template_id===eq("template_id"))&&(!eq("version")||String(v.version)===eq("version"))).slice().reverse();
  if(table==="offers")data=[{id:productId,product_id:productId,offer_price:4.95,normal_price:5.49,unit:"UN",starts_on:"2026-09-01",ends_on:"2026-09-30",products:product,campaigns:campaign}];
  if (table === "profiles") data = [profile];
  if (table === "products") data = [product];
  if (table === "product_images") data = [...images].sort((a,b)=>Number(b.is_primary)-Number(a.is_primary));
  if (table === "campaigns") data = [campaign];
  if (table === "campaign_items")
    data = [
      {
        id: productId,
        product_id: productId,
        name_snapshot: product.name,
        brand_snapshot: product.brand,
        specification_snapshot: product.specification,
        normal_price: 5.49,
        offer_price: 4.95,
        highlighted_price: "offer",
        sort_order: 0,
      },
    ];
  if (table === "publications")
    data = [
      {
        id: productId,
        campaign_id: productId,
        network: "instagram",
        type: "carousel",
        status: "draft",
        caption: "Teste",
      },
    ];
  if (table === "publication_media")
    data = [1, 2, 3].map((n) => ({
      id: String(n),
      publication_id: productId,
      public_url: `http://127.0.0.1:54329/storage/v1/object/sign/test/${n}.png`,
      media_type: "image",
      sort_order: n,
    }));
  if (table === "brand_settings") {
    if (req.method === "PATCH") settings = { ...settings, ...body };
    data = [settings];
  }
  if (table === "art_templates") {
    const row = templates[eq("id")];
    if (row) {
      if (req.method === "PATCH" && String(row.revision) === eq("revision"))
        Object.assign(row, body);
      data = [row];
    }
  }
  if (req.headers.accept?.includes("vnd.pgrst.object"))
    return json(data[0] ?? null);
  res.setHeader(
    "Content-Range",
    `0-${Math.max(data.length - 1, 0)}/${data.length}`,
  );
  return json(data);
});
server.listen(54329, "127.0.0.1", () =>
  console.log("Local Supabase fixture: 54329"),
);
