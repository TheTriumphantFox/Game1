// Headless harness for browser sprite-loader files.
//
// Stubs just enough DOM (Image, canvas, 2D context) over real PNG pixels so a
// file written for the browser can be exercised in node and checked on
// BEHAVIOUR, not shape. Structural checks — syntax, greps, "does the function
// exist" — passed both of the fatal bugs in the first villager-sprite.js, so
// they are not worth much on their own.
//
// The sheet is handed in as a raw RGBA dump beside a tiny .json of its size,
// because node has no PNG decoder and pulling one in would be a dependency.

const fs = require('fs');

function loadRaw(rawPath, metaPath) {
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  const buf = fs.readFileSync(rawPath);
  return { width: meta.width, height: meta.height, data: new Uint8ClampedArray(buf) };
}

class ImageData {
  constructor(data, width, height) {
    this.data = data; this.width = width; this.height = height;
  }
}

// A 2D context backed by a plain RGBA array. Implements only what a sprite
// loader touches: drawImage (3- and 9-arg), getImageData, putImageData, and
// the imageSmoothingEnabled flag it is expected to save and restore.
class Ctx2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.imageSmoothingEnabled = true;
    this._px = new Uint8ClampedArray(canvas.width * canvas.height * 4);
    this.drawCalls = [];
  }
  _blit(src, sx, sy, sw, sh, dx, dy, dw, dh) {
    const W = this.canvas.width, H = this.canvas.height;
    // Nearest-neighbour, which is what imageSmoothingEnabled=false means and
    // all a pixel-art loader should ever be asking for.
    for (let y = 0; y < Math.round(dh); y++) {
      for (let x = 0; x < Math.round(dw); x++) {
        const tx = Math.round(dx) + x, ty = Math.round(dy) + y;
        if (tx < 0 || ty < 0 || tx >= W || ty >= H) continue;
        const ux = sx + Math.floor(x * sw / dw), uy = sy + Math.floor(y * sh / dh);
        if (ux < 0 || uy < 0 || ux >= src.width || uy >= src.height) continue;
        const si = (uy * src.width + ux) * 4, di = (ty * W + tx) * 4;
        if (src.data[si + 3] === 0) continue;          // preserve transparency
        this._px[di] = src.data[si]; this._px[di + 1] = src.data[si + 1];
        this._px[di + 2] = src.data[si + 2]; this._px[di + 3] = src.data[si + 3];
      }
    }
  }
  drawImage(img, ...a) {
    // A source is either an Image (backed by the raw sheet) or another canvas
    // — the tinted sheet is a canvas, and a loader that caches its recolour
    // will always be blitting from one.
    let src = img._raw || img;
    if (!src.data && typeof img.getContext === 'function') {
      const g = img.getContext('2d');
      src = { width: img.width, height: img.height, data: g._px };
    }
    if (!src.data) throw new Error('drawImage: source has no pixels');
    this.drawCalls.push({ args: a.slice() });
    if (a.length === 2) this._blit(src, 0, 0, src.width, src.height, a[0], a[1], src.width, src.height);
    else if (a.length === 4) this._blit(src, 0, 0, src.width, src.height, a[0], a[1], a[2], a[3]);
    else if (a.length === 8) this._blit(src, a[0], a[1], a[2], a[3], a[4], a[5], a[6], a[7]);
    else throw new Error('drawImage arity ' + a.length);
  }
  getImageData(x, y, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const s = ((y + j) * this.canvas.width + (x + i)) * 4, d = (j * w + i) * 4;
        out[d] = this._px[s]; out[d + 1] = this._px[s + 1];
        out[d + 2] = this._px[s + 2]; out[d + 3] = this._px[s + 3];
      }
    }
    return new ImageData(out, w, h);
  }
  putImageData(img, x, y) {
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const s = (j * img.width + i) * 4, d = ((y + j) * this.canvas.width + (x + i)) * 4;
        this._px[d] = img.data[s]; this._px[d + 1] = img.data[s + 1];
        this._px[d + 2] = img.data[s + 2]; this._px[d + 3] = img.data[s + 3];
      }
    }
  }
  save() {} restore() {} translate() {} rotate() {} clearRect() {}
}

class Canvas {
  constructor() { this.width = 300; this.height = 150; this._ctx = null; }
  getContext() { if (!this._ctx) this._ctx = new Ctx2D(this); return this._ctx; }
}

// Build the sandbox globals a loader expects, and load it.
function makeEnv(sheet) {
  const env = {};
  env.ImageData = ImageData;
  env.document = {
    createElement(tag) {
      if (tag !== 'canvas') throw new Error('createElement(' + tag + ')');
      return new Canvas();
    },
  };
  // Image resolves synchronously the moment .src is assigned, so a loader that
  // correctly gates on its own ready-state works, and one that draws before
  // load would still be caught by the behaviour checks rather than by timing.
  env.Image = class {
    constructor() { this.onload = null; this.onerror = null; this._raw = null; }
    set src(v) {
      this._src = v;
      this._raw = sheet;
      this.naturalWidth = sheet.width; this.naturalHeight = sheet.height;
      this.width = sheet.width; this.height = sheet.height;
      if (this.onload) this.onload();
    }
    get src() { return this._src; }
  };
  return env;
}

module.exports = { loadRaw, makeEnv, Canvas, Ctx2D, ImageData };
