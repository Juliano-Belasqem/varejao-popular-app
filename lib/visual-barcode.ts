const L = [
  "0001101",
  "0011001",
  "0010011",
  "0111101",
  "0100011",
  "0110001",
  "0101111",
  "0111011",
  "0110111",
  "0001011",
];
const G = [
  "0100111",
  "0110011",
  "0011011",
  "0100001",
  "0011101",
  "0111001",
  "0000101",
  "0010001",
  "0001001",
  "0010111",
];
const parity = [
  "LLLLLL",
  "LLGLGG",
  "LLGGLG",
  "LLGGGL",
  "LGLLGG",
  "LGGLLG",
  "LGGGLL",
  "LGLGLG",
  "LGLGGL",
  "LGGLGL",
];
export function ean13(value: string) {
  const digits = value.replace(/\s/g, "");
  if (!/^\d{12,13}$/.test(digits)) return null;
  const check =
    (10 -
      ([...digits.slice(0, 12)].reduce(
        (sum, d, i) => sum + Number(d) * (i % 2 ? 3 : 1),
        0,
      ) %
        10)) %
    10;
  if (digits.length === 13 && Number(digits[12]) !== check) return null;
  const code = digits.slice(0, 12) + check;
  let bits = "101";
  for (let i = 1; i <= 6; i++)
    bits += (parity[Number(code[0])][i - 1] === "L" ? L : G)[Number(code[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++)
    bits += L[Number(code[i])].replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
  return { code, bits: bits + "101" };
}
