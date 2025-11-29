#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SOURCE_SVG = path.resolve(__dirname, '..', 'src', 'gitportree.svg');
const OUTPUT_PNG = path.resolve(__dirname, '..', 'media', 'gitportree.png');

function parseAttributes(raw) {
  const attrs = {};
  let cleaned = raw.trim();
  if (cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  const regex = /([:\w-]+)\s*=\s*"([^"]*)"|([:\w-]+)\s*=\s*'([^']*)'/g;
  let match;
  while ((match = regex.exec(cleaned)) !== null) {
    const key = match[1] || match[3];
    const value = match[2] || match[4];
    attrs[key] = value;
  }
  return attrs;
}

function parseColor(hex) {
  if (!hex || hex === 'none') {
    return null;
  }
  if (hex.startsWith('#')) {
    if (hex.length === 7) {
      return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16)
      ];
    }
    if (hex.length === 4) {
      return [
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        parseInt(hex[3] + hex[3], 16)
      ];
    }
  }
  throw new Error(`Unsupported color format: ${hex}`);
}

function parsePathData(d) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g);
  if (!tokens) {
    return [];
  }
  const subpaths = [];
  let currentPoints = [];
  let close = false;
  let idx = 0;
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  while (idx < tokens.length) {
    const token = tokens[idx++];
    switch (token) {
      case 'M': {
        const x = parseFloat(tokens[idx++]);
        const y = parseFloat(tokens[idx++]);
        if (currentPoints.length) {
          subpaths.push({ points: currentPoints.slice(), close });
          currentPoints = [];
          close = false;
        }
        currentX = x;
        currentY = y;
        startX = x;
        startY = y;
        currentPoints.push({ x, y });
        break;
      }
      case 'L': {
        const x = parseFloat(tokens[idx++]);
        const y = parseFloat(tokens[idx++]);
        currentX = x;
        currentY = y;
        currentPoints.push({ x, y });
        break;
      }
      case 'H': {
        const x = parseFloat(tokens[idx++]);
        currentX = x;
        currentPoints.push({ x, y: currentY });
        break;
      }
      case 'V': {
        const y = parseFloat(tokens[idx++]);
        currentY = y;
        currentPoints.push({ x: currentX, y });
        break;
      }
      case 'Z': {
        if (currentPoints.length) {
          subpaths.push({ points: currentPoints.slice(), close: true });
          currentPoints = [];
        }
        close = false;
        currentX = startX;
        currentY = startY;
        break;
      }
      default:
        throw new Error(`Unsupported path command: ${token}`);
    }
  }

  if (currentPoints.length) {
    subpaths.push({ points: currentPoints.slice(), close });
  }

  return subpaths;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  paintPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return;
    }
    const idx = (y * this.width + x) * 4;
    this.data[idx] = color[0];
    this.data[idx + 1] = color[1];
    this.data[idx + 2] = color[2];
    this.data[idx + 3] = 255;
  }

  fillRoundedRect(x, y, w, h, radius, color) {
    const minX = Math.max(0, Math.floor(x));
    const minY = Math.max(0, Math.floor(y));
    const maxX = Math.min(this.width - 1, Math.ceil(x + w - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(y + h - 1));
    const r = Math.max(radius || 0, 0);

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const localX = px + 0.5 - x;
        const localY = py + 0.5 - y;
        let inside = true;
        if (r > 0) {
          const innerX = clamp(localX, r, w - r);
          const innerY = clamp(localY, r, h - r);
          const dx = localX - innerX;
          const dy = localY - innerY;
          inside = dx * dx + dy * dy <= r * r;
        }
        if (inside) {
          this.paintPixel(px, py, color);
        }
      }
    }
  }

  drawCircle(cx, cy, radius, color) {
    if (radius <= 0) {
      return;
    }
    const minX = Math.max(0, Math.floor(cx - radius - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(cx + radius + 1));
    const minY = Math.max(0, Math.floor(cy - radius - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(cy + radius + 1));
    const rSq = radius * radius;

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const dx = px + 0.5 - cx;
        const dy = py + 0.5 - cy;
        if (dx * dx + dy * dy <= rSq) {
          this.paintPixel(px, py, color);
        }
      }
    }
  }

  drawSegment(p1, p2, strokeWidth, color) {
    const half = strokeWidth / 2;
    const minX = Math.max(0, Math.floor(Math.min(p1.x, p2.x) - half - 1));
    const maxX = Math.min(this.width - 1, Math.ceil(Math.max(p1.x, p2.x) + half + 1));
    const minY = Math.max(0, Math.floor(Math.min(p1.y, p2.y) - half - 1));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(p1.y, p2.y) + half + 1));
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const lengthSq = dx * dx + dy * dy;

    if (lengthSq === 0) {
      this.drawCircle(p1.x, p1.y, half, color);
      return;
    }

    for (let py = minY; py <= maxY; py++) {
      for (let px = minX; px <= maxX; px++) {
        const cx = px + 0.5;
        const cy = py + 0.5;
        let t = ((cx - p1.x) * dx + (cy - p1.y) * dy) / lengthSq;
        t = clamp(t, 0, 1);
        const projX = p1.x + t * dx;
        const projY = p1.y + t * dy;
        const dist = Math.hypot(cx - projX, cy - projY);
        if (dist <= half) {
          this.paintPixel(px, py, color);
        }
      }
    }
  }

  drawPath(subpath, options) {
    const { strokeWidth, color, join, cap } = options;
    if (subpath.points.length < 2) {
      return;
    }
    for (let i = 1; i < subpath.points.length; i++) {
      this.drawSegment(subpath.points[i - 1], subpath.points[i], strokeWidth, color);
    }
    if (subpath.close) {
      this.drawSegment(subpath.points[subpath.points.length - 1], subpath.points[0], strokeWidth, color);
    }

    if (join === 'round') {
      const start = subpath.close ? 0 : 1;
      const end = subpath.close ? subpath.points.length : subpath.points.length - 1;
      for (let i = start; i < end; i++) {
        this.drawCircle(subpath.points[i].x, subpath.points[i].y, strokeWidth / 2, color);
      }
    }

    if (!subpath.close && cap === 'round') {
      this.drawCircle(subpath.points[0].x, subpath.points[0].y, strokeWidth / 2, color);
      this.drawCircle(subpath.points[subpath.points.length - 1].x, subpath.points[subpath.points.length - 1].y, strokeWidth / 2, color);
    }
  }
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  const crcValue = crc32(Buffer.concat([typeBuffer, data]));
  crcBuffer.writeUInt32BE(crcValue, 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function writePng(raster, outputPath) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(raster.width, 0);
  ihdr.writeUInt32BE(raster.height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const rowSize = raster.width * 4 + 1;
  const raw = Buffer.alloc(rowSize * raster.height);
  for (let y = 0; y < raster.height; y++) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0; // no filter
    const row = raster.data.subarray(y * raster.width * 4, (y + 1) * raster.width * 4);
    raw.set(row, rowStart + 1);
  }
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const chunks = [
    createChunk('IHDR', ihdr),
    createChunk('IDAT', compressed),
    createChunk('IEND', Buffer.alloc(0))
  ];

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, Buffer.concat([signature, ...chunks]));
}

function main() {
  if (!fs.existsSync(SOURCE_SVG)) {
    throw new Error(`Missing source SVG at ${SOURCE_SVG}`);
  }
  const svg = fs.readFileSync(SOURCE_SVG, 'utf8');
  const svgMatch = svg.match(/<svg\b([^>]*)>/);
  if (!svgMatch) {
    throw new Error('Invalid SVG: missing <svg> tag');
  }
  const svgAttrs = parseAttributes(svgMatch[1]);
  const viewBox = svgAttrs.viewBox ? svgAttrs.viewBox.trim().split(/\s+/).map(Number) : null;
  if (!viewBox || viewBox.length !== 4) {
    throw new Error('SVG viewBox is required');
  }
  const [, , width, height] = viewBox;
  const raster = new Raster(Math.round(width), Math.round(height));

  const elementRegex = /<(rect|path|circle)\b([^>]*)\/?>/g;
  let match;
  while ((match = elementRegex.exec(svg)) !== null) {
    const [, tag, rawAttrs] = match;
    const attrs = parseAttributes(rawAttrs);
    switch (tag) {
      case 'rect': {
        const fill = parseColor(attrs.fill);
        if (!fill) {
          break;
        }
        const x = parseFloat(attrs.x || '0');
        const y = parseFloat(attrs.y || '0');
        const w = parseFloat(attrs.width);
        const h = parseFloat(attrs.height);
        const rx = parseFloat(attrs.rx || attrs.ry || '0');
        raster.fillRoundedRect(x, y, w, h, rx, fill);
        break;
      }
      case 'circle': {
        const fill = parseColor(attrs.fill);
        if (!fill) {
          break;
        }
        const cx = parseFloat(attrs.cx);
        const cy = parseFloat(attrs.cy);
        const r = parseFloat(attrs.r);
        raster.drawCircle(cx, cy, r, fill);
        break;
      }
      case 'path': {
        const strokeColor = parseColor(attrs.stroke);
        if (!strokeColor || !attrs.d) {
          break;
        }
        const strokeWidth = parseFloat(attrs['stroke-width'] || '1');
        const join = attrs['stroke-linejoin'] || 'miter';
        const cap = attrs['stroke-linecap'] || 'butt';
        const subpaths = parsePathData(attrs.d);
        subpaths.forEach(subpath => {
          if (subpath.points.length >= 2) {
            raster.drawPath(subpath, {
              strokeWidth,
              color: strokeColor,
              join,
              cap
            });
          }
        });
        break;
      }
      default:
        break;
    }
  }

  writePng(raster, OUTPUT_PNG);
  console.log(`Generated icon at ${OUTPUT_PNG}`);
}

main();
