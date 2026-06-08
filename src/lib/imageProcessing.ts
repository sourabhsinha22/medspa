// Analyzes and corrects lighting on face photos before AI processing

export interface LightingAnalysis {
  overallBrightness: number;   // 0-255
  leftBrightness: number;
  rightBrightness: number;
  imbalance: number;           // 0-100, how uneven left vs right
  isAcceptable: boolean;
  warnings: string[];
}

// Analyze lighting from a video frame or canvas
export function analyzeLighting(
  source: HTMLVideoElement | HTMLCanvasElement
): LightingAnalysis {
  const canvas = document.createElement("canvas");
  const isVideo = source instanceof HTMLVideoElement;
  canvas.width = isVideo ? source.videoWidth : source.width;
  canvas.height = isVideo ? source.videoHeight : source.height;

  if (canvas.width === 0 || canvas.height === 0) {
    return {
      overallBrightness: 128,
      leftBrightness: 128,
      rightBrightness: 128,
      imbalance: 0,
      isAcceptable: true,
      warnings: [],
    };
  }

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(source, 0, 0);

  const W = canvas.width;
  const H = canvas.height;

  // Sample the center 60% of the frame (face region)
  const x0 = Math.floor(W * 0.2);
  const x1 = Math.floor(W * 0.8);
  const y0 = Math.floor(H * 0.1);
  const y1 = Math.floor(H * 0.9);
  const midX = Math.floor(W / 2);

  const leftData = ctx.getImageData(x0, y0, midX - x0, y1 - y0).data;
  const rightData = ctx.getImageData(midX, y0, x1 - midX, y1 - y0).data;

  const avgBrightness = (data: Uint8ClampedArray) => {
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      // Perceptual luminance
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return total / (data.length / 4);
  };

  const leftBrightness = avgBrightness(leftData);
  const rightBrightness = avgBrightness(rightData);
  const overallBrightness = (leftBrightness + rightBrightness) / 2;
  const imbalance = Math.abs(leftBrightness - rightBrightness);
  const imbalancePct = Math.min((imbalance / 128) * 100, 100);

  const warnings: string[] = [];
  if (overallBrightness < 60) warnings.push("Too dark — move to brighter light");
  if (overallBrightness > 220) warnings.push("Too bright — avoid direct light");
  if (imbalancePct > 25) {
    const darker = leftBrightness < rightBrightness ? "left" : "right";
    warnings.push(`Uneven lighting — ${darker} side is darker`);
  }

  return {
    overallBrightness,
    leftBrightness,
    rightBrightness,
    imbalance: imbalancePct,
    isAcceptable: warnings.length === 0,
    warnings,
  };
}

// CLAHE: Contrast Limited Adaptive Histogram Equalization
// Normalizes lighting locally across the image — much better than global equalization
// Divides image into tiles, equalizes each, then blends edges (bilinear interpolation)
export function applyCLAHE(
  sourceCanvas: HTMLCanvasElement,
  tileSize = 64,
  clipLimit = 1.5
): HTMLCanvasElement {
  const W = sourceCanvas.width;
  const H = sourceCanvas.height;

  const ctx = sourceCanvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, W, H);
  const data = imageData.data;

  // Convert to LAB-like: work only on luminance channel
  const luminance = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    luminance[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const cols = Math.ceil(W / tileSize);
  const rows = Math.ceil(H / tileSize);

  // Build CDF (cumulative distribution function) per tile
  const tileCDFs: number[][] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x0 = col * tileSize;
      const y0 = row * tileSize;
      const x1 = Math.min(x0 + tileSize, W);
      const y1 = Math.min(y0 + tileSize, H);

      const hist = new Array(256).fill(0);
      let count = 0;

      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const v = Math.min(255, Math.floor(luminance[y * W + x]));
          hist[v]++;
          count++;
        }
      }

      // Clip histogram
      const clipThreshold = Math.floor((clipLimit * count) / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > clipThreshold) {
          excess += hist[i] - clipThreshold;
          hist[i] = clipThreshold;
        }
      }
      // Redistribute excess evenly
      const redistPerBin = Math.floor(excess / 256);
      for (let i = 0; i < 256; i++) hist[i] += redistPerBin;

      // Build CDF
      const cdf = new Array(256).fill(0);
      cdf[0] = hist[0];
      for (let i = 1; i < 256; i++) cdf[i] = cdf[i - 1] + hist[i];
      const cdfMin = cdf.find((v) => v > 0) ?? 1;
      const normalized = cdf.map((v) =>
        Math.round(((v - cdfMin) / (count - cdfMin)) * 255)
      );

      tileCDFs.push(normalized);
    }
  }

  // Apply with bilinear interpolation between tile CDFs
  const output = new Uint8ClampedArray(data);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = luminance[y * W + x];
      const v = Math.min(255, Math.floor(px));

      // Find surrounding tile centers
      const tileX = (x - tileSize / 2) / tileSize;
      const tileY = (y - tileSize / 2) / tileSize;
      const tx0 = Math.max(0, Math.floor(tileX));
      const ty0 = Math.max(0, Math.floor(tileY));
      const tx1 = Math.min(cols - 1, tx0 + 1);
      const ty1 = Math.min(rows - 1, ty0 + 1);

      const fx = Math.max(0, Math.min(1, tileX - tx0));
      const fy = Math.max(0, Math.min(1, tileY - ty0));

      const v00 = tileCDFs[ty0 * cols + tx0][v];
      const v10 = tileCDFs[ty0 * cols + tx1][v];
      const v01 = tileCDFs[ty1 * cols + tx0][v];
      const v11 = tileCDFs[ty1 * cols + tx1][v];

      const interpolated =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx * (1 - fy) +
        v01 * (1 - fx) * fy +
        v11 * fx * fy;

      // Apply correction: scale original RGB channels by luminance ratio
      const idx = (y * W + x) * 4;
      const ratio = px > 0 ? interpolated / px : 1;
      output[idx] = Math.min(255, Math.round(data[idx] * ratio));
      output[idx + 1] = Math.min(255, Math.round(data[idx + 1] * ratio));
      output[idx + 2] = Math.min(255, Math.round(data[idx + 2] * ratio));
      output[idx + 3] = data[idx + 3];
    }
  }

  const outCanvas = document.createElement("canvas");
  outCanvas.width = W;
  outCanvas.height = H;
  const outCtx = outCanvas.getContext("2d")!;
  outCtx.putImageData(new ImageData(output, W, H), 0, 0);
  return outCanvas;
}

// Draw image to canvas, apply mild CLAHE only when needed, blend with original
export function preprocessImage(imageDataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;

      // Original canvas
      const origCanvas = document.createElement("canvas");
      origCanvas.width = W;
      origCanvas.height = H;
      origCanvas.getContext("2d")!.drawImage(img, 0, 0);

      // Assess lighting on original
      const lighting = analyzeLighting(origCanvas);

      // If lighting is acceptable, return original as-is
      if (lighting.isAcceptable) {
        resolve(origCanvas);
        return;
      }

      // Apply CLAHE on a copy
      const srcCopy = document.createElement("canvas");
      srcCopy.width = W;
      srcCopy.height = H;
      srcCopy.getContext("2d")!.drawImage(img, 0, 0);
      const claheCanvas = applyCLAHE(srcCopy);

      // Blend: 60% CLAHE + 40% original — prevents over-correction
      const out = document.createElement("canvas");
      out.width = W;
      out.height = H;
      const ctx = out.getContext("2d")!;
      ctx.drawImage(origCanvas, 0, 0);
      ctx.globalAlpha = 0.6;
      ctx.drawImage(claheCanvas, 0, 0);
      ctx.globalAlpha = 1.0;

      resolve(out);
    };
    img.onerror = reject;
    img.src = imageDataUrl;
  });
}
