const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const manifest = require('../src/renderer/sprite-manifest');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

function readRgbaPng(filePath) {
  const input = fs.readFileSync(filePath);
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('不是 PNG 文件');

  let offset = 8;
  let width;
  let height;
  let bitDepth;
  let colorType;
  let interlace;
  const idat = [];
  while (offset < input.length) {
    const length = input.readUInt32BE(offset);
    const type = input.toString('ascii', offset + 4, offset + 8);
    const data = input.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
    throw new Error(`只支持非交错 RGBA8 PNG，实际 bitDepth=${bitDepth} colorType=${colorType}`);
  }

  const bytesPerPixel = 4;
  const rowBytes = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(width * height * bytesPerPixel);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset++];
    const rowOffset = y * rowBytes;
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = inflated[sourceOffset++];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowOffset + x - rowBytes] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset + x - rowBytes - bytesPerPixel]
        : 0;
      let value;
      if (filter === 0) value = raw;
      else if (filter === 1) value = raw + left;
      else if (filter === 2) value = raw + up;
      else if (filter === 3) value = raw + Math.floor((left + up) / 2);
      else if (filter === 4) value = raw + paeth(left, up, upperLeft);
      else throw new Error(`未知 PNG filter ${filter}`);
      pixels[rowOffset + x] = value & 255;
    }
  }
  return { width, height, pixels };
}

function inspectFrame(image, frameX, frameWidth) {
  const { width, height, pixels } = image;
  const mask = new Uint8Array(frameWidth * height);
  let minX = frameWidth;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  let boundaryPixels = 0;
  let hiddenRgbPixels = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const sourceX = frameX + x;
      const pixelOffset = (y * width + sourceX) * 4;
      const alpha = pixels[pixelOffset + 3];
      if (alpha === 0) {
        if (pixels[pixelOffset] || pixels[pixelOffset + 1] || pixels[pixelOffset + 2]) hiddenRgbPixels += 1;
        continue;
      }
      mask[y * frameWidth + x] = 1;
      count += 1;
      sumX += x;
      sumY += y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      if (x === 0 || x === frameWidth - 1 || y === 0 || y === height - 1) boundaryPixels += 1;
    }
  }

  const visited = new Uint8Array(mask.length);
  const componentSizes = [];
  const queue = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    let size = 0;
    while (head < tail) {
      const index = queue[head++];
      size += 1;
      const x = index % frameWidth;
      const y = Math.floor(index / frameWidth);
      const neighbours = [index - 1, index + 1, index - frameWidth, index + frameWidth];
      for (const next of neighbours) {
        if (next < 0 || next >= mask.length || visited[next] || !mask[next]) continue;
        const nextX = next % frameWidth;
        const nextY = Math.floor(next / frameWidth);
        if (Math.abs(nextX - x) + Math.abs(nextY - y) !== 1) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (size >= 20) componentSizes.push(size);
  }
  componentSizes.sort((a, b) => b - a);

  return {
    frameWidth,
    frameHeight: height,
    bbox: count ? [minX, minY, maxX + 1, maxY + 1] : null,
    centroid: count ? [sumX / count, sumY / count] : null,
    coverage: count / (frameWidth * height),
    boundaryPixels,
    hiddenRgbPixels,
    componentSizes,
  };
}

function validate() {
  const root = path.resolve(__dirname, '..');
  const results = [];
  const errors = [];
  const stateMedianCoverage = {};

  for (const [state, config] of Object.entries(manifest)) {
    const stateFrames = [];
    for (const file of config.files) {
      const filePath = path.join(root, 'assets', 'sprites', file.name);
      if (!fs.existsSync(filePath)) {
        errors.push(`${state}: 缺少 ${file.name}`);
        continue;
      }
      let image;
      try {
        image = readRgbaPng(filePath);
      } catch (error) {
        errors.push(`${state}/${file.name}: ${error.message}`);
        continue;
      }
      if (image.width !== image.height * file.frames) {
        errors.push(`${state}/${file.name}: 尺寸 ${image.width}x${image.height} 与 ${file.frames} 帧不匹配`);
        continue;
      }
      if (image.height > 512) errors.push(`${state}/${file.name}: 单帧超过 512px`);
      const frameWidth = image.width / file.frames;
      for (let index = 0; index < file.frames; index += 1) {
        const frame = inspectFrame(image, index * frameWidth, frameWidth);
        stateFrames.push(frame);
        if (!frame.bbox) errors.push(`${state}/${file.name}#${index}: 空帧`);
        if (frame.boundaryPixels > 0) errors.push(`${state}/${file.name}#${index}: 主体触碰帧边界`);
        if (frame.componentSizes.length > 1 && frame.componentSizes[1] >= 100) {
          errors.push(`${state}/${file.name}#${index}: 存在分离碎片 (${frame.componentSizes.slice(0, 3).join(',')})`);
        }
        if (frame.hiddenRgbPixels > 0) {
          errors.push(`${state}/${file.name}#${index}: 透明像素残留 RGB (${frame.hiddenRgbPixels})`);
        }
      }
      results.push({ state, file: file.name, width: image.width, height: image.height });
    }

    const stationary = ['idle', 'headTilt', 'pawReach', 'dragged', 'reminder', 'sleep'];
    if (stationary.includes(state) && stateFrames.length > 1 && stateFrames.every((frame) => frame.centroid)) {
      const xs = stateFrames.map((frame) => frame.centroid[0]);
      const maxDrift = Math.max(...xs) - Math.min(...xs);
      const frameWidth = stateFrames[0].frameWidth;
      if (maxDrift > frameWidth * 0.08) {
        errors.push(`${state}: 横向中心漂移过大 (${maxDrift.toFixed(1)}px)`);
      }

      const coverages = stateFrames.map((frame) => frame.coverage);
      const minCoverage = Math.min(...coverages);
      const maxCoverage = Math.max(...coverages);
      if (minCoverage > 0 && maxCoverage / minCoverage > 1.35) {
        errors.push(`${state}: 主体面积变化过大 (${(maxCoverage / minCoverage).toFixed(2)}x)`);
      }

      if (state !== 'dragged' && stateFrames.every((frame) => frame.bbox)) {
        const baselines = stateFrames.map((frame) => frame.bbox[3]);
        const baselineDrift = Math.max(...baselines) - Math.min(...baselines);
        if (baselineDrift > stateFrames[0].frameHeight * 0.08) {
          errors.push(`${state}: 落脚基线漂移过大 (${baselineDrift.toFixed(1)}px)`);
        }
      }
    }

    if (stateFrames.length > 0) {
      const sortedCoverages = stateFrames.map((frame) => frame.coverage).sort((a, b) => a - b);
      const middle = Math.floor(sortedCoverages.length / 2);
      stateMedianCoverage[state] = sortedCoverages.length % 2
        ? sortedCoverages[middle]
        : (sortedCoverages[middle - 1] + sortedCoverages[middle]) / 2;
    }
  }

  const idleCoverage = stateMedianCoverage.idle;
  if (idleCoverage) {
    for (const state of ['walk', 'roll', 'dragged']) {
      const coverage = stateMedianCoverage[state];
      if (!coverage) continue;
      const ratio = coverage / idleCoverage;
      if (ratio < 0.78 || ratio > 1.22) {
        errors.push(`${state}: 主体视觉尺寸与静待基准不一致 (${ratio.toFixed(2)}x)`);
      }
    }
  }

  return { ok: errors.length === 0, checkedFiles: results, stateMedianCoverage, errors };
}

const report = validate();
const jsonIndex = process.argv.indexOf('--json');
if (jsonIndex >= 0 && process.argv[jsonIndex + 1]) {
  fs.mkdirSync(path.dirname(path.resolve(process.argv[jsonIndex + 1])), { recursive: true });
  fs.writeFileSync(path.resolve(process.argv[jsonIndex + 1]), JSON.stringify(report, null, 2));
}

if (report.ok) {
  console.log(`精灵图校验通过：${report.checkedFiles.length} 个文件`);
} else {
  console.error(`精灵图校验失败：${report.errors.length} 个问题`);
  for (const error of report.errors) console.error(`- ${error}`);
  process.exitCode = 1;
}
