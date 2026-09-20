import test from "node:test";
import assert from "node:assert/strict";
import {parseMoney} from "../lib/money";

test("parseMoney accepts Brazilian decimal and thousands formats",()=>{
  assert.equal(parseMoney("9,99"),9.99);
  assert.equal(parseMoney("1.234,56"),1234.56);
});

test("parseMoney preserves dot decimal input",()=>{
  assert.equal(parseMoney("9.99"),9.99);
});

test("parseMoney rejects malformed and negative values",()=>{
  assert.equal(parseMoney("-1,00"),null);
  assert.equal(parseMoney("9,999"),null);
  assert.equal(parseMoney("abc"),null);
});
