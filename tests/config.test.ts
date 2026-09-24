import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultTemplate,
  validateLayout,
  templateIds,
} from "../lib/template-config";
import { resolveFonts } from "../lib/brand-kit/fields";
import { isPrivateAddress } from "../lib/remote-image";
import { isRasterBytes } from "../lib/raster-file";

test("legacy fonts migrate without coupling modules", () => {
  const input = { price: "Old font", "validity.price": "New font" };
  assert.equal(resolveFonts(input, "campaign").price, "Old font");
  assert.equal(resolveFonts(input, "validity").price, "New font");
  assert.equal(resolveFonts(input, "validity").normalPrice, "Old font");
});
test("uploaded and remote files require matching raster signatures", () => {
  assert.equal(
    isRasterBytes(
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      "image/png",
    ),
    true,
  );
  assert.equal(
    isRasterBytes(
      new TextEncoder().encode("<html>blocked</html>"),
      "image/png",
    ),
    false,
  );
  assert.equal(
    isRasterBytes(new Uint8Array([255, 216, 255]), "image/png"),
    false,
  );
});
test("defaults fit their canvas and round-trip", () => {
  for (const id of templateIds)
    assert.deepEqual(
      validateLayout(id, defaultTemplate(id).layout),
      defaultTemplate(id).layout,
    );
});
test("layout rejects out-of-bounds, missing and malformed fields", () => {
  for (const patch of [
    { x: -1 },
    { width: 101 },
    { fontSize: NaN },
    { color: "url(x)" },
    { visible: "true" },
    { align: "justify" },
  ]) {
    const layout = defaultTemplate("validity").layout;
    Object.assign(layout.product, patch);
    assert.throws(() => validateLayout("validity", layout));
  }
  assert.throws(() => validateLayout("validity", {}));
  const legacy = defaultTemplate("digital-feed").layout;
  const legacyProduct = { ...legacy.productLine1 };
  const legacyPrice = { ...legacy.priceReais };
  const legacyLayout = { product: legacyProduct, brand: legacy.brand, specification: legacy.specification, image: legacy.image, price: legacyPrice, footer: legacy.footer, logo: legacy.logo };
  const migrated = validateLayout("digital-feed", legacyLayout);
  assert.deepEqual(migrated.productLine1, legacyProduct);
  assert.deepEqual(migrated.currency, defaultTemplate("digital-feed").layout.currency);
  assert.deepEqual(migrated.priceReais, legacyPrice);
  assert.deepEqual(migrated.priceCents, defaultTemplate("digital-feed").layout.priceCents);
  const previousLayout = { ...legacy, price: legacyPrice } as Record<string, typeof legacyPrice>;
  delete previousLayout.priceReais;
  delete previousLayout.priceCents;
  const previousMigrated = validateLayout("digital-feed", previousLayout);
  assert.deepEqual(previousMigrated.priceReais, legacyPrice);
  assert.deepEqual(previousMigrated.priceCents, defaultTemplate("digital-feed").layout.priceCents);
  assert.throws(() => validateLayout("digital-feed", { brand: legacy.brand }));
});
test("typography outline layer round-trips and rejects invalid values", () => {
  const layout = defaultTemplate("digital-feed").layout;
  layout.productLine1.strokeLayer = "above";
  const validated = validateLayout("digital-feed", layout);
  assert.equal(validated.productLine1.strokeLayer, "above");
  (layout.productLine1 as unknown as { strokeLayer: string }).strokeLayer = "invalid";
  assert.throws(() => validateLayout("digital-feed", layout));
});
test("public IPv6 images work; local and mapped private addresses are rejected", () => {
  for (const ip of [
    "8.8.8.8",
    "2001:4860:4860::8888",
    "2606:4700:4700::1111",
    "::ffff:808:808",
  ])
    assert.equal(isPrivateAddress(ip), false, ip);
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.2",
    "172.16.0.1",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ])
    assert.equal(isPrivateAddress(ip), true, ip);
});
