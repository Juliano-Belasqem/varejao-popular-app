import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  ...(process.env.TEST_BROWSER_CHANNEL
    ? { channel: process.env.TEST_BROWSER_CHANNEL }
    : {}),
});
const context = await browser.newContext({
  viewport: { width: 1550, height: 1050 },
  acceptDownloads: true,
});
await context.addInitScript(()=>{window.print=()=>{window.top.__visualPrinted={pages:document.querySelectorAll("section").length,css:document.querySelector("style")?.textContent};window.dispatchEvent(new Event("afterprint"))}});
const session = {
  access_token: "test-token",
  refresh_token: "test-refresh",
  expires_at: 9999999999,
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "00000000-0000-4000-8000-000000000001" },
};
await context.addCookies([
  {
    name: "sb-127-auth-token",
    value:
      "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
    url: base,
  },
]);
await mkdir("test-results", { recursive: true });
const page = await context.newPage(),
  errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const label = (name) => page.getByLabel(name, { exact: true });
const button = (name) => page.getByRole("button", { name, exact: true });
async function download(name, filename) {
  const pending = page.waitForEvent("download");
  await button(name).click();
  const file = await pending;
  await file.saveAs(`test-results/${filename}`);
  return file;
}
async function document() {
  await download("Exportar documento", "visual-document.json");
  return JSON.parse(
    await readFile("test-results/visual-document.json", "utf8"),
  );
}
try {
  await page.goto(`${base}/app/editor-visual`);
  await button("Salvar template").waitFor();
  const mainNav = page.getByRole("navigation", { name: "Módulos principais" });
  assert.equal(await mainNav.getByRole("link", { name: "Motor Visual", exact: true }).getAttribute("aria-current"), "page", "main navigation marks the current module");
  await button("Recolher menu principal").click();
  assert.equal(await page.locator(".sidebar-collapsed").count(), 1, "main navigation can collapse");
  assert.equal(await page.locator(".sidebar-collapsed").getByText("Motor Visual", { exact: true }).count(), 1, "collapsed navigation preserves accessible module labels");
  await page.reload();
  await button("Salvar template").waitFor();
  await page.waitForFunction(() => document.querySelector(".sidebar")?.classList.contains("sidebar-collapsed"));
  assert.equal(await page.locator(".sidebar-collapsed").count(), 1, "main navigation collapse persists after reload");
  await button("Expandir menu principal").click();
  assert.equal(await page.locator(".sidebar-collapsed").count(), 0, "main navigation expands again");
  await button("◉ Preview").click();
  assert.equal(await button("◉ Sair do preview").getAttribute("aria-pressed"), "true", "preview button exposes active state");
  await page.keyboard.press("Escape");
  await button("◉ Preview").waitFor();
  await page
    .locator(".visual-canvas text")
    .filter({ hasText: "Produto de exemplo" })
    .waitFor();
  await label("Nome do template").fill("Teste universal");
  await page.getByRole("button", { name: "Recolher menu lateral" }).click();
  assert.equal(await page.locator(".visual-workspace-sidebar-collapsed").count(), 1);
  await page.getByRole("button", { name: "Expandir menu lateral" }).click();
  assert.equal(await page.locator(".visual-workspace-sidebar-collapsed").count(), 0);
  await page.keyboard.press("Control+\\");
  assert.equal(await page.locator(".visual-workspace-sidebar-collapsed").count(), 1, "sidebar shortcut collapses the contextual panel");
  await page.keyboard.press("Control+\\");
  assert.equal(await page.locator(".visual-workspace-sidebar-collapsed").count(), 0, "sidebar shortcut expands the contextual panel");
  assert.equal(await page.locator(".visual-static-guide").count(), 2);
  await label("Mostrar grade").uncheck();
  assert.equal(await page.locator("#visual-grid").count(), 0);
  await label("Mostrar grade").check();
  assert.equal(await page.locator("#visual-grid").count(), 1);
  await label("Guias centrais").uncheck();
  assert.equal(await page.locator(".visual-static-guide").count(), 0);
  await label("Guias centrais").check();
  assert.equal(await page.locator(".visual-static-guide").count(), 2);
  await label("Margem segura").check();
  assert.equal(await page.locator('[data-safe-area="true"]').count(), 1);
  await label("Margem segura").uncheck();
  assert.equal(await page.locator('[data-safe-area="true"]').count(), 0);
  await label("Encaixe e guias").uncheck();
  const hit = page.locator('[data-hit-id="product"]');
  await hit.scrollIntoViewIfNeeded();
  const box = await hit.boundingBox(),
    canvas = await page.locator(".visual-canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 20,
    box.y + box.height / 2 + 10,
    { steps: 3 },
  );
  await page.mouse.up();
  let dragged = await document();
  assert.ok(
    Math.abs(
      dragged.elements[0].transform.x - (70 + (20 * 1080) / canvas.width),
    ) < 0.01,
    "free drag converts pixels to document units",
  );
  await page.locator(".visual-editor > .visual-toolbar").getByRole("button", { name: "Desfazer", exact: true }).click();
  await hit.click();
  await label("Bloqueado").check();
  await page.keyboard.press("ArrowRight");
  dragged = await document();
  assert.equal(
    dragged.elements[0].transform.x,
    70,
    "locked element cannot move",
  );
  await label("Bloqueado").uncheck();
  await label("Rotação").fill("20");
  const handle = page.getByRole("button", {
    name: "Redimensionar 1,1",
    exact: true,
  });
  await handle.scrollIntoViewIfNeeded();
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 15, hb.y + hb.height / 2 + 12, {
    steps: 3,
  });
  await page.mouse.up();
  dragged = await document();
  assert.ok(dragged.elements[0].transform.width > 750);
  await page.locator(".visual-editor > .visual-toolbar").getByRole("button", { name: "Desfazer", exact: true }).click();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Produto", exact: true })
    .click();
  await label("Rotação").fill("0");
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Produto", exact: true })
    .click();
  await page.locator("summary").filter({ hasText: /^Dados vinculados$/ }).click();
  await label("Vínculo de dados").fill("");
  await label("Texto livre / alternativa").fill("Oferta especial");
  await label("Rotação").fill("25");
  await label("Espaço entre letras").fill("2");
  await button("Aplicar efeito deslocado").click();
  await label("Posição X").fill("82");
  await page.locator(".visual-editor > .visual-toolbar").getByRole("button", { name: "Desfazer", exact: true }).click();
  let state = await document();
  assert.equal(
    state.elements[0].transform.x,
    70,
    "undo restores previous coordinates",
  );
  await page.locator(".visual-editor > .visual-toolbar").getByRole("button", { name: "Refazer", exact: true }).click();
  state = await document();
  assert.equal(state.elements[0].transform.x, 82);
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Produto", exact: true })
    .click();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Preço", exact: true })
    .click({ modifiers: ["Shift"] });
  await button("Agrupar").click();
  await label("Largura").fill("1000");
  await label("Rotação").fill("15");
  await button("Desagrupar").click();
  state = await document();
  assert.ok(state.elements[0].transform.scaleX > 0);
  assert.equal(state.elements.length, 2);
  await page.locator(".visual-tool-rail button[title=\"Produtos\"]").click();
  await label("Buscar produto").fill("LEITE");
  await label("Produto para inserir").selectOption(
    "00000000-0000-4000-8000-000000000010",
  );
  await button("+ Inserir produto vinculado").click();
  await page
    .getByRole("status")
    .filter({ hasText: "LEITE inserido e vinculado" })
    .waitFor();
  state = await document();
  const productGroup = state.elements.find(
    (element) => element.type === "group" && element.name === "LEITE",
  );
  assert.ok(productGroup, "smart product block is inserted");
  const productChildren = state.elements.filter((element) =>
    productGroup.children.includes(element.id),
  );
  assert.deepEqual(
    new Set(productChildren.map((element) => element.binding)),
    new Set([
      "product.image",
      "product.name",
      "product.brand",
      "product.specification",
      "product.salePrice",
      "product.ean",
    ]),
    "smart product block keeps editable data bindings",
  );
  await button("Excluir seleção").click();
  await page.locator(".visual-tool-rail button[title=\"Marca\"]").click();
  await button("+ Título da marca").click();
  state = await document();
  const brandTitle = state.elements.find((element) => element.name === "Título");
  assert.ok(brandTitle, "Brand Kit inserts an editable title");
  assert.equal(brandTitle.textStyle.fontFamily, "Arial, sans-serif");
  await button("Primária").click();
  state = await document();
  const coloredBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(coloredBrandTitle.textStyle.color, "#2F42A6", "Brand Kit applies the primary color");
  await button("Aplicar estilo de preço").click();
  state = await document();
  const pricedBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(pricedBrandTitle.textStyle.fontWeight, 900, "Brand Kit applies the price weight");
  assert.equal(pricedBrandTitle.textStyle.color, "#2F42A6", "Brand Kit price preset uses the primary color");
  await button("Aplicar efeito deslocado").click();
  state = await document();
  const offsetBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(offsetBrandTitle.textStyle.offsetStrokeColor, "#667085", "offset stroke preset keeps its own color");
  assert.equal(offsetBrandTitle.textStyle.offsetStrokeWidth, 2, "offset stroke preset keeps its own width");
  assert.equal(offsetBrandTitle.textStyle.offsetStrokeX, 5, "offset stroke preset keeps horizontal displacement");
  assert.equal(offsetBrandTitle.textStyle.offsetStrokeY, 5, "offset stroke preset keeps vertical displacement");
  await button("Remover efeito").click();
  state = await document();
  const clearOffsetBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(clearOffsetBrandTitle.textStyle.offsetStrokeWidth, 0, "remove offset stroke clears its width");
  assert.equal(clearOffsetBrandTitle.textStyle.offsetStrokeColor, "transparent", "remove offset stroke clears its color");
  await button("Aplicar efeito deslocado").click();
  await page.locator("summary").filter({ hasText: /^Fundo, borda e sombra$/ }).click();
  await button("Sombra suave").click();
  state = await document();
  const shadowBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(shadowBrandTitle.decoration.shadowColor, "#00000066", "soft shadow preset uses translucent black");
  assert.equal(shadowBrandTitle.decoration.shadowBlur, 8, "soft shadow preset uses expected blur");
  assert.equal(shadowBrandTitle.decoration.shadowX, 4, "soft shadow preset uses horizontal offset");
  assert.equal(shadowBrandTitle.decoration.shadowY, 4, "soft shadow preset uses vertical offset");
  await button("Remover sombra").click();
  state = await document();
  const clearShadowBrandTitle = state.elements.find((element) => element.id === brandTitle.id);
  assert.equal(clearShadowBrandTitle.decoration.shadowColor, "transparent", "remove shadow clears shadow color");
  await button("Excluir seleção").click();
  await button("+ Preço da marca").click();
  state = await document();
  const brandPrice = state.elements.find((element) => element.name === "Preço");
  assert.ok(brandPrice, "Brand Kit inserts an editable price text");
  assert.equal(brandPrice.textStyle.fontWeight, 900, "Brand price starts with a strong price style");
  await button("Excluir seleção").click();
  await page.locator(".visual-tool-rail button[title=\"Ofertas\"]").click();
  await label("Dados da oferta").selectOption(
    "00000000-0000-4000-8000-000000000010",
  );
  await page.locator(".visual-tool-rail button[title=\"Produtos\"]").click();
  assert.equal(await label("Produto para inserir").inputValue(), "");
  await label("Produto para inserir").selectOption(
    "00000000-0000-4000-8000-000000000010",
  );
  await page.locator(".visual-tool-rail button[title=\"Ofertas\"]").click();
  assert.equal(await label("Dados da oferta").inputValue(), "");
  await label("Dados da oferta").selectOption(
    "00000000-0000-4000-8000-000000000010",
  );
  await button("+ Inserir oferta vinculada").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Oferta de LEITE inserida e vinculada" })
    .waitFor();
  state = await document();
  const offerGroup = state.elements.find(
    (element) => element.type === "group" && element.name === "Oferta · LEITE",
  );
  assert.ok(offerGroup, "smart offer block is inserted");
  const offerChildren = state.elements.filter((element) =>
    offerGroup.children.includes(element.id),
  );
  assert.ok(
    offerChildren.some((element) => element.binding === "offer.price"),
    "smart offer block binds offer price",
  );
  assert.ok(
    offerChildren.some((element) => element.binding === "offer.normalPrice"),
    "smart offer block binds normal price",
  );
  assert.ok(
    offerChildren.some((element) => element.binding === "product.ean"),
    "smart offer block binds product barcode",
  );
  await button("Excluir seleção").click();
  await page.locator(".visual-tool-rail button[title=\"Imagens\"]").click();
  await button("+ Quadro de imagem").click();
  await label("Enviar ou substituir imagem").setInputFiles(
    "public/media-templates/validity-background.png",
  );
  await page
    .getByRole("status")
    .filter({ hasText: "Imagem guardada" })
    .waitFor();
  await button("Preencher").click();
  await label("Recorte horizontal (%)").fill("25");
  await button("Centralizar recorte").click();
  state = await document();
  const imageElement = state.elements.find((element) => element.type === "image");
  assert.equal(imageElement.fit, "cover");
  assert.deepEqual(imageElement.imagePosition, { x: 0.5, y: 0.5 });
  await page.locator(".visual-tool-rail button[title=\"Elementos\"]").click();
  await button("▭ Forma").click();
  await label("Forma").selectOption("ellipse");
  await button("▥ Código").click();
  await page.locator('.visual-canvas [aria-label^="EAN-13"]').waitFor();
  await page.locator(".visual-tool-rail button[title=\"Texto\"]").click();
  await button("R$ Preço segmentado").click();
  await page.locator(".visual-tool-rail button[title=\"Componentes\"]").click();
  await label("Nome do componente").fill("Preço reutilizável");
  await button("+ Salvar nesta sessão").click();
  await page.getByText("Preço reutilizável", { exact: true }).waitFor();
  const beforeComponentInsert = await document();
  await page.locator(".visual-component-item").filter({ hasText: "Preço reutilizável" }).getByRole("button", { name: "Inserir" }).click();
  const afterComponentInsert = await document();
  assert.ok(afterComponentInsert.elements.length > beforeComponentInsert.elements.length, "saved component inserts a cloned editable block");
  await page.locator(".visual-tool-rail button[title=\"Camadas\"]").click();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Preço segmentado ▸", exact: true })
    .dblclick();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Centavos", exact: true })
    .click();
  await label("Tamanho da fonte").fill("75");
  await button("← Sair do grupo").click();
  await button("Salvar template").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Salvo · versão 1" })
    .waitFor();
  await page
    .getByText("Biblioteca, versões e dados de preview", { exact: true })
    .click();
  await label("Oferta no preview").selectOption(
    "00000000-0000-4000-8000-000000000010",
  );
  await page
    .locator(".visual-canvas text")
    .filter({ hasText: "4,95" })
    .waitFor();
  await label("Template da biblioteca").selectOption({
    label: "Teste universal · v1",
  });
  const id = await label("Template da biblioteca").inputValue();
  await page.goto(`${base}/app/editor-visual?template=${id}`);
  assert.equal(await label("Nome do template").inputValue(), "Teste universal");
  state = await document();
  assert.equal(state.elements.filter((e) => e.type === "image").length, 1);
  assert.ok(
    state.elements
      .find((e) => e.type === "image")
      .source.startsWith("/api/visual-assets?"),
  );
  await button("+ Prancheta").click();
  await label("Formato").selectOption("210,297,mm");
  await label("Nome da prancheta").fill("Cartaz A4");
  await page.locator(".visual-tool-rail button[title=\"Texto\"]").click();
  await button("+ Texto").click();
  await label("Texto livre / alternativa").fill("Segunda página");
  await button("Salvar template").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Salvo · versão 2" })
    .waitFor();
  await page.reload();
  await button("2. Cartaz A4").click();
  assert.equal(await label("Largura da prancheta").inputValue(), "210");
  await button("1. Teste universal").click();
   await download("Exportar SVG", "visual-export.svg");
  const svg = await readFile("test-results/visual-export.svg", "utf8");
  assert.ok(svg.includes("data:image/png;base64,"));
  assert.ok(!svg.includes("data-editor-overlay"));
  assert.ok(svg.includes('stroke="#667085"'), "SVG export preserves linked offset text stroke");
  await download("Exportar PNG", "visual-export.png");
  const png = await readFile("test-results/visual-export.png");
  assert.equal(png.readUInt32BE(16), 1080);
  assert.equal(png.readUInt32BE(20), 1080);
  await button("Imprimir / PDF (todas)").click();
  await page.waitForFunction(()=>window.__visualPrinted?.pages===2);
  const printed=await page.evaluate(()=>window.__visualPrinted);
  assert.ok(printed.css.includes("size:210mm 297mm"));
  await page.screenshot({
    path: "test-results/visual-editor-desktop.png",
    fullPage: true,
  });
  await page
    .getByText("Biblioteca, versões e dados de preview", { exact: true })
    .click();
  await button("Abrir v1").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Versão 1 carregada" })
    .waitFor();
  await button("2. Cartaz A4").waitFor({ state: "detached" });
  await button("Salvar template").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Salvo · versão 3" })
    .waitFor();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Preço segmentado ▸", exact: true })
    .click();
  await button("Salvar seleção como componente").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Componente salvo" })
    .waitFor();
  await label("Template da biblioteca").selectOption({
    label: "Teste universal · componente · v1 · componente",
  });
  await button("Inserir como componente").click();
  await page
    .getByRole("status")
    .filter({ hasText: "Inserida cópia" })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".visual-zoom-controls button[title^=\"Ajustar à tela\"]").click();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    "mobile must not overflow",
  );
  await page.screenshot({
    path: "test-results/visual-editor-mobile.png",
    fullPage: true,
  });
  await page.request.get("http://127.0.0.1:54329/__role?role=viewer");
  await page.reload();
  assert.equal(await button("Salvar template").isDisabled(), true);
  const denied = await page.request.post(`${base}/api/visual-assets`, {
    multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } },
  });
  assert.equal(denied.status(), 403);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: editor, undo/redo, affine groups, image persistence, real offer preview, multi-page versions, component reuse, SVG/PNG, mobile and viewer authorization",
  );
} catch (error) {
  await page.screenshot({
    path: "test-results/visual-failure.png",
    fullPage: true,
  });
  console.log(await page.locator(".visual-editor").innerText());
  throw error;
} finally {
  await page.request.get("http://127.0.0.1:54329/__role?role=editor");
  await browser.close();
}
