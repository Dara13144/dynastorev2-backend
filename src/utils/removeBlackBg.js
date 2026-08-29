import fs from 'fs';
import zlib from 'zlib';

/**
 * Basic PNG processor to make pure black pixels transparent
 */
function processPNG(inputPath, outputPath) {
  const fileBuffer = fs.readFileSync(inputPath);
  
  // Verify PNG signature
  if (fileBuffer.readUInt32BE(0) !== 0x89504E47 || fileBuffer.readUInt32BE(4) !== 0x0D0A1A0A) {
    console.error('Not a valid PNG file');
    return;
  }

  let pos = 8;
  let ihdr = null;
  const idatChunks = [];
  const otherChunks = [];

  while (pos < fileBuffer.length) {
    const length = fileBuffer.readUInt32BE(pos);
    const type = fileBuffer.toString('ascii', pos + 4, pos + 8);
    const chunkData = fileBuffer.slice(pos + 8, pos + 8 + length);
    const crc = fileBuffer.readUInt32BE(pos + 8 + length);

    if (type === 'IHDR') {
      ihdr = {
        width: chunkData.readUInt32BE(0),
        height: chunkData.readUInt32BE(4),
        bitDepth: chunkData.readUInt8(8),
        colorType: chunkData.readUInt8(9),
        compression: chunkData.readUInt8(10),
        filter: chunkData.readUInt8(11),
        interlace: chunkData.readUInt8(12),
        raw: chunkData
      };
      otherChunks.push({ type, data: chunkData });
    } else if (type === 'IDAT') {
      idatChunks.push(chunkData);
    } else {
      otherChunks.push({ type, data: chunkData });
    }

    pos += 12 + length;
  }

  console.log(`PNG Info: Width=${ihdr.width}, Height=${ihdr.height}, ColorType=${ihdr.colorType}, BitDepth=${ihdr.bitDepth}`);

  // Decompress IDAT
  const compressedData = Buffer.concat(idatChunks);
  const decompressed = zlib.inflateSync(compressedData);

  const { width, height, colorType } = ihdr;
  const bytesPerPixel = colorType === 6 ? 4 : colorType === 2 ? 3 : 4;
  const stride = width * bytesPerPixel + 1; // +1 for filter byte per row

  // If colorType === 6 (RGBA), process scanlines
  if (colorType === 6) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * stride;
      // skip filter byte at rowStart
      for (let x = 0; x < width; x++) {
        const px = rowStart + 1 + x * 4;
        const r = decompressed[px];
        const g = decompressed[px + 1];
        const b = decompressed[px + 2];
        const a = decompressed[px + 3];

        // If pixel is black or very near black, make transparent with smooth falloff
        const maxVal = Math.max(r, g, b);
        if (maxVal < 15) {
          decompressed[px + 3] = 0;
        } else if (maxVal < 45) {
          const alphaFactor = (maxVal - 15) / 30;
          decompressed[px + 3] = Math.round(a * alphaFactor);
        }
      }
    }

    const recompressed = zlib.deflateSync(decompressed);

    // Build new PNG
    const outChunks = [];
    outChunks.push(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));

    for (const chunk of otherChunks) {
      if (chunk.type === 'IEND') {
        // Insert new IDAT before IEND
        const lenBuf = Buffer.alloc(4);
        lenBuf.writeUInt32BE(recompressed.length, 0);
        const typeBuf = Buffer.from('IDAT', 'ascii');
        const crc = crc32(Buffer.concat([typeBuf, recompressed]));
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc, 0);
        outChunks.push(lenBuf, typeBuf, recompressed, crcBuf);
      }

      const lenBuf = Buffer.alloc(4);
      lenBuf.writeUInt32BE(chunk.data.length, 0);
      const typeBuf = Buffer.from(chunk.type, 'ascii');
      const crc = crc32(Buffer.concat([typeBuf, chunk.data]));
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc, 0);
      outChunks.push(lenBuf, typeBuf, chunk.data, crcBuf);
    }

    fs.writeFileSync(outputPath, Buffer.concat(outChunks));
    console.log(`Successfully generated transparent PNG at ${outputPath}`);
  }
}

// Simple CRC32 implementation
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    crc = crc ^ byte;
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xEDB88320 & mask);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

processPNG('c:/Users/rosv2/dynastorev2/frontend/public/logo.png', 'c:/Users/rosv2/dynastorev2/frontend/public/logo.png');
