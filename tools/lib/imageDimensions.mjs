// Only PNG/JPEG, with dimensions read from the file itself (no extra dependency).
export function dimensions(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), extension: 'png' };
  }
  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 255) continue;
      let marker = bytes[offset++];
      while (marker === 255) marker = bytes[offset++];
      if (marker === 0xDA || marker === 0xD9) break;
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD8)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2) break;
      if ([0xC0, 0xC1, 0xC2].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3), extension: 'jpg' };
      }
      offset += length;
    }
  }
  throw new Error('Unsupported or corrupt PNG/JPEG');
}
