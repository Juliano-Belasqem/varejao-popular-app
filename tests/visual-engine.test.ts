import test from "node:test";
import assert from "node:assert/strict";
import {createVisualDocument,resolveBinding,validateVisualDocument} from "../lib/visual-engine";

test("visual document foundation validates a blank canvas",()=>{
  assert.equal(validateVisualDocument(createVisualDocument()).version,1);
});

test("visual engine resolves nested data bindings",()=>{
  assert.equal(resolveBinding("offer.price",{offer:{price:"9,99"}}),"9,99");
});

test("visual engine rejects duplicate element ids",()=>{
  const doc=createVisualDocument();
  const element={id:"price",type:"text" as const,name:"Preço",visible:true,locked:false,transform:{x:0,y:0,width:100,height:50,rotation:0,opacity:1,layer:1}};
  doc.elements=[element,{...element}];
  assert.throws(()=>validateVisualDocument(doc),/Elemento visual inválido/);
});

import {parseMoney} from "../lib/money";

test("money parser accepts Brazilian and decimal formats",()=>{
  assert.equal(parseMoney("9,99"),9.99);
  assert.equal(parseMoney("1.234,56"),1234.56);
  assert.equal(parseMoney("9.99"),9.99);
});

test("money parser rejects invalid or negative values",()=>{
  assert.equal(parseMoney("-1,00"),null);
  assert.equal(parseMoney("12,345"),null);
  assert.equal(parseMoney("abc"),null);
});
