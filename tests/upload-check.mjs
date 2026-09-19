import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
mkdirSync("test-results", { recursive: true });
import assert from "node:assert/strict";
const browser = process.env.TEST_CDP_URL
  ? await chromium.connectOverCDP(process.env.TEST_CDP_URL)
  : await chromium.launch({
      headless: true,
      ...(process.env.TEST_BROWSER_CHANNEL
        ? { channel: process.env.TEST_BROWSER_CHANNEL }
        : {}),
    });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
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
    url: "http://localhost:3000",
  },
]);
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto("http://localhost:3000/app/validade-proxima");
await page.getByText("Configurar template e campos", { exact: true }).click();
await page.waitForFunction(() => document.querySelector("details fieldset")?.disabled === false);
await page
  .locator("input[type=file]")
  .setInputFiles({
    name: "background.pdf",
    mimeType: "application/pdf",
    buffer: testPdf(),
  });
await page
  .getByRole("status")
  .filter({ hasText: "Fundo preparado" })
  .waitFor({ timeout: 20000 });
await page
  .getByRole("button", { name: "Salvar template", exact: true })
  .click();
await page.getByRole("status").filter({ hasText: "Template salvo" }).waitFor();
let first = await page.evaluate(
  async () => await (await fetch("/api/templates?id=validity")).json(),
);
assert.ok(first.config.backgroundUrl.includes("template-assets/validity/"));
await page.reload();
await page.waitForFunction(() =>
  document
    .querySelector(".configured-ticket")
    ?.style.backgroundImage.includes("template-assets"),
);
await page.getByText("Configurar template e campos", { exact: true }).click();
await page.waitForFunction(() => document.querySelector("details fieldset")?.disabled === false);
await page
  .locator("input[type=file]")
  .setInputFiles("public/media-templates/validity-background.png");
await page.getByRole("status").filter({ hasText: "Fundo preparado" }).waitFor();
await page
  .getByRole("button", { name: "Salvar template", exact: true })
  .click();
await page.getByRole("status").filter({ hasText: "Template salvo" }).waitFor();
const second = await page.evaluate(
  async () => await (await fetch("/api/templates?id=validity")).json(),
);
assert.notEqual(first.config.backgroundUrl, second.config.backgroundUrl);
console.log(
  "PASS: PDF upload/conversion, PNG replacement and persistent background reload",
);
await page.goto(
  "http://localhost:3000/app/campanhas/00000000-0000-4000-8000-000000000010/gerar",
);
await page.getByText("Configurar template e campos", { exact: true }).click();
await page.waitForFunction(() => document.querySelector("details fieldset")?.disabled === false);
await page
  .locator("input[type=file]")
  .setInputFiles("public/media-templates/validity-background.png");
await page.getByRole("status").filter({ hasText: "Fundo preparado" }).waitFor();
await page
  .getByRole("button", { name: "Salvar template", exact: true })
  .click();
await page.getByRole("status").filter({ hasText: "Template salvo" }).waitFor();
await page.reload();
const digital = await page.evaluate(
  async () => await (await fetch("/api/templates?id=digital-feed")).json(),
);
assert.ok(digital.config.backgroundUrl.includes("digital-feed/"));
console.log(
  "PASS: digital background upload persists independently from validity",
);
await page.goto(
  "http://localhost:3000/app/produtos/00000000-0000-4000-8000-000000000010",
);
await page
  .locator("input[type=file]")
  .setInputFiles("public/media-templates/validity-background.png");
await page.getByRole("button", { name: "Enviar imagem", exact: true }).click();
await page.getByText("2 imagem(ns) cadastrada(s)", { exact: true }).waitFor();
const response = await page.request.get(
  "http://localhost:3000/api/product-image/00000000-0000-4000-8000-000000000010",
);
assert.equal(response.status(), 200);
assert.ok(response.headers()["content-type"].includes("image/png"));
console.log(
  "PASS: product upload -> registration -> authenticated image endpoint",
);
await page.goto("http://localhost:3000/app/marca");
await page.locator("input[type=color]").first().fill("#112233");
await page
  .getByRole("button", { name: "Salvar identidade", exact: true })
  .click();
await page
  .getByText("Tipografia salva. Os geradores podem usar esses padrões.", {
    exact: true,
  })
  .waitFor();
await page.reload();
await page.waitForFunction(
  () => document.querySelector("input[type=color]")?.value === "#112233",
);
assert.equal(await page.locator("fieldset").count(), 3);
console.log(
  "PASS: global brand colors persist and typography is grouped by module",
);
await page.request.get("http://127.0.0.1:54329/__role?role=viewer");
const denied = await page.evaluate(async () => {
  const f = new FormData();
  f.set("id", "validity");
  return (await fetch("/api/templates", { method: "PUT", body: f })).status;
});
assert.equal(denied, 403);
await page.request.get("http://127.0.0.1:54329/__role?role=editor");
assert.deepEqual(errors, []);
console.log("PASS: viewer denied template writes; no browser runtime errors");
await browser.close();

function testPdf() {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 300] /Contents 4 0 R /Resources << >> >>",
  ];
  const stream = "0.2 0.4 0.8 rg 0 0 200 300 re f";
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj, i) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 5\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
    .join("");
  pdf += `trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

