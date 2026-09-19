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
page.on("pageerror", (error) => errors.push(error.message));
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
await page.goto("http://localhost:3000/app/validade-proxima");
await page.getByRole("button", { name: "Imprimir / salvar PDF" }).waitFor();
await page.waitForFunction(
  () => !document.querySelector("button.btn.primary[disabled]"),
);
await page
  .getByLabel("Produto do catálogo")
  .first()
  .selectOption("00000000-0000-4000-8000-000000000010");
await page.getByLabel("Preço oferta", { exact: true }).first().fill("4,95");
await page.getByLabel("Validade", { exact: true }).first().fill("20/09/26");
await page
  .locator(".validity-sheet")
  .screenshot({ path: "test-results/validity-preview.png" });
await page.getByText("Configurar template e campos", { exact: true }).click();
await page.getByLabel("Campo", { exact: true }).selectOption("product");
await page.getByLabel("Posição X (%)", { exact: true }).fill("8");
await page
  .getByRole("button", { name: "Salvar template", exact: true })
  .click();
await page.getByRole("status").filter({ hasText: "Template salvo" }).waitFor();
await page.reload();
await page.getByText("Configurar template e campos", { exact: true }).click();
await page.getByLabel("Campo", { exact: true }).selectOption("product");
assert.equal(
  await page.getByLabel("Posição X (%)", { exact: true }).inputValue(),
  "8",
);
console.log(
  "PASS: template layout persisted through API/reload; validity preview rendered",
);
await page.goto(
  "http://localhost:3000/app/campanhas/00000000-0000-4000-8000-000000000010/gerar",
);
await page.getByRole("button", { name: "Baixar PNG", exact: true }).waitFor();
await page.waitForFunction(() => {
  const c = document.querySelector("canvas");
  return c?.width === 1080 && c?.height === 1080;
});
await page
  .locator("canvas")
  .first()
  .screenshot({ path: "test-results/digital-feed-preview.png" });
await page
  .getByRole("combobox", { name: "Formato", exact: true })
  .first()
  .selectOption("story");
await page.waitForFunction(() => {
  const c = document.querySelector("canvas");
  return c?.width === 1080 && c?.height === 1920;
});
const download = page.waitForEvent("download");
await page.getByRole("button", { name: "Baixar PNG", exact: true }).click();
await (await download).saveAs("test-results/digital-story-export.png");
console.log("PASS: Feed/Story renders; PNG export succeeds");
await page.goto(
  "http://localhost:3000/app/publicacoes/00000000-0000-4000-8000-000000000010",
);
await page.locator(".publication-media-frame img").first().waitFor();
for (const width of [1280, 390]) {
  await page.setViewportSize({ width, height: 900 });
  const boxes = await page
    .locator(".publication-media-frame")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        const i = n.querySelector("img")?.getBoundingClientRect();
        return {
          x: r.x,
          y: r.y,
          right: r.right,
          bottom: r.bottom,
          width: r.width,
          height: r.height,
          img: i ? { right: i.right, bottom: i.bottom } : null,
        };
      }),
    );
  for (const b of boxes) {
    assert.ok(b.width > 0 && b.height > 0);
    if (b.img) {
      assert.ok(b.img.right <= b.right + 1);
      assert.ok(b.img.bottom <= b.bottom + 1);
    }
  }
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert.ok(
        a.right <= b.x + 1 ||
          b.right <= a.x + 1 ||
          a.bottom <= b.y + 1 ||
          b.bottom <= a.y + 1,
      );
    }
}
await page.screenshot({
  path: "test-results/publication-mobile-preview.png",
  fullPage: true,
});
console.log(
  "PASS: publication media frames do not overlap at desktop/mobile widths",
);
assert.deepEqual(errors, []);
console.log("PASS: no browser runtime errors");
await browser.close();
