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
  await page
    .locator(".visual-canvas text")
    .filter({ hasText: "Produto de exemplo" })
    .waitFor();
  await label("Nome do template").fill("Teste universal");
  assert.equal(await page.locator(".visual-static-guide").count(), 2);
  await label("Mostrar grade").uncheck();
  assert.equal(await page.locator("#visual-grid").count(), 0);
  await label("Mostrar grade").check();
  await page.keyboard.down("Control"); await page.keyboard.press("Quote"); await page.keyboard.up("Control");
  assert.equal(await page.locator("#visual-grid").count(), 0);
  await page.keyboard.down("Control"); await page.keyboard.press("Quote"); await page.keyboard.up("Control");
  assert.equal(await page.locator("#visual-grid").count(), 1);
  await label("Guias centrais").uncheck();
  assert.equal(await page.locator(".visual-static-guide").count(), 0);
  await label("Guias centrais").check();
  await page.keyboard.down("Control"); await page.keyboard.press("Semicolon"); await page.keyboard.up("Control");
  assert.equal(await page.locator(".visual-static-guide").count(), 0);
  await page.keyboard.down("Control"); await page.keyboard.press("Semicolon"); await page.keyboard.up("Control");
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
  await button("Desfazer").click();
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
  await button("Desfazer").click();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Produto", exact: true })
    .click();
  await label("Rotação").fill("0");
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: "Produto", exact: true })
    .click();
  await label("Vínculo de dados").fill("");
  await label("Texto livre / alternativa").fill("Oferta especial");
  await label("Rotação").fill("25");
  await label("Espaço entre letras").fill("2");
  await label("Posição X").fill("82");
  await button("Desfazer").click();
  let state = await document();
  assert.equal(
    state.elements[0].transform.x,
    70,
    "undo restores previous coordinates",
  );
  await button("Refazer").click();
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
  await page.locator(".visual-tool-rail button[title=\"Camadas\"]").click();
  await page
    .locator(".visual-layer-list")
    .getByRole("button", { name: /Preço segmentado/ })
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
    .getByRole("button", { name: /Preço segmentado/ })
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
