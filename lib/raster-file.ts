export function isRasterBytes(bytes: Uint8Array, type: string): boolean {
  if (type === "image/png")
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)
    );
  if (type === "image/jpeg")
    return (
      bytes.length >= 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255
    );
  if (type === "image/webp")
    return (
      bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  return false;
}
