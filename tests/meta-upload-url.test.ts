import test from "node:test";
import assert from "node:assert/strict";
import { assertMetaVideoUploadUrl } from "../lib/meta/upload-url";

test("accepts only the expected Meta HTTPS upload origins", () => {
  assert.equal(assertMetaVideoUploadUrl("https://rupload.facebook.com/video-upload").hostname, "rupload.facebook.com");
  assert.equal(assertMetaVideoUploadUrl("https://graph-video.facebook.com:443/upload").hostname, "graph-video.facebook.com");
});

test("rejects attacker-controlled destinations before OAuth token dispatch", () => {
  for (const value of [
    "http://rupload.facebook.com/upload",
    "https://rupload.facebook.com.evil.example/upload",
    "https://evil.example/upload",
    "https://user:pass@rupload.facebook.com/upload",
    "https://rupload.facebook.com:8443/upload",
    "https://127.0.0.1/upload",
    "not-a-url",
  ]) {
    assert.throws(() => assertMetaVideoUploadUrl(value), /não autorizado/, value);
  }
});
