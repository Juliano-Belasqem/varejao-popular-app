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


test("visual engine rejects circular groups",()=>{
  const doc=createVisualDocument();
  const transform={x:0,y:0,width:100,height:50,rotation:0,opacity:1,layer:1};
  doc.elements=[
    {id:"a",type:"group",name:"A",visible:true,locked:false,transform,children:["b"]},
    {id:"b",type:"group",name:"B",visible:true,locked:false,transform:{...transform,layer:2},children:["a"]},
  ];
  assert.throws(()=>validateVisualDocument(doc),/referência circular/);
});

test("visual engine supports skew and requires integer layers",()=>{
  const doc=createVisualDocument();
  doc.elements=[{id:"text",type:"text",name:"Texto",visible:true,locked:false,transform:{x:0,y:0,width:100,height:50,rotation:0,opacity:1,layer:1,skewX:12,skewY:-4}}];
  assert.equal(validateVisualDocument(doc).elements[0].transform.skewX,12);
  doc.elements[0].transform.layer=1.5;
  assert.throws(()=>validateVisualDocument(doc),/Transformação inválida/);
});
