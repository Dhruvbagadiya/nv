import { useRef, useState, useCallback, useEffect } from 'react';

/**
 * LogoCropper
 *
 * A self-contained file-picker + square crop UI built entirely on the browser
 * Canvas API — no external dependencies.
 *
 * Props:
 *   onCropped(blob, mimeType)  — called with the final cropped blob
 *   onCancel()                 — called when the user dismisses
 *   aspectRatio                — default 1 (square)
 *   outputSize                 — output canvas size in px (default 256)
 */
/**
 * extractDominantColorFromData(data, width, height)
 * Core pixel analysis — works on raw ImageData.data (Uint8ClampedArray).
 */
export function extractDominantColorFromData(data, _w, _h) {
  const buckets = Array.from({ length: 16 }, () => ({ r: 0, g: 0, b: 0, count: 0, sat: 0 }));

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue;
    const rr = r / 255, gg = g / 255, bb = b / 255;
    const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
    const l = (max + min) / 2;
    if (l > 0.90 || l < 0.08) continue;
    if (max === min) continue;
    const d = max - min;
    const s = d / (l > 0.5 ? 2 - max - min : max + min);
    if (s < 0.15) continue;
    let h;
    switch (max) {
      case rr: h = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6; break;
      case gg: h = ((bb - rr) / d + 2) / 6; break;
      default: h = ((rr - gg) / d + 4) / 6;
    }
    const bucket = buckets[Math.floor(h * 16)];
    bucket.r += r; bucket.g += g; bucket.b += b;
    bucket.sat += s; bucket.count++;
  }

  let best = null, bestScore = 0;
  for (const bk of buckets) {
    if (bk.count < 10) continue;
    const score = bk.count * (bk.sat / bk.count);
    if (score > bestScore) { bestScore = score; best = bk; }
  }
  if (!best) return null;

  return '#' + [
    Math.round(best.r / best.count),
    Math.round(best.g / best.count),
    Math.round(best.b / best.count),
  ].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * extractDominantColor(imgEl)
 * Convenience wrapper that samples from an HTMLImageElement.
 */
export function extractDominantColor(imgEl) {
  const SIZE = 80;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  canvas.getContext('2d').drawImage(imgEl, 0, 0, SIZE, SIZE);
  const { data } = canvas.getContext('2d').getImageData(0, 0, SIZE, SIZE);
  return extractDominantColorFromData(data, SIZE, SIZE);
}

export default function LogoCropper({
  onCropped,
  onCancel,
  _aspectRatio = 1,
  outputSize  = 256,
}) {
  const fileRef       = useRef(null);
  const canvasRef     = useRef(null);
  const previewRef    = useRef(null);

  const [imageSrc,  setImageSrc]  = useState(null);
  const [imgEl,     setImgEl]     = useState(null);
  const [crop,      setCrop]      = useState({ x: 0, y: 0, size: 100 });
  const [dragging,  setDragging]  = useState(null); // null | 'move' | 'resize'
  const [dragStart, setDragStart] = useState(null);

  // ── Load selected file ──────────────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setImageSrc(ev.target.result);
    reader.readAsDataURL(file);
  };

  // ── Once image URL is ready, load it into an Image element ─────────────
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImgEl(img);
      const size = Math.min(img.naturalWidth, img.naturalHeight) * 0.8;
      setCrop({
        x: (img.naturalWidth  - size) / 2,
        y: (img.naturalHeight - size) / 2,
        size,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // ── Draw the preview canvas whenever crop or image changes ──────────────
  const draw = useCallback(() => {
    const canvas = previewRef.current;
    if (!canvas || !imgEl) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    // Draw the full image dimmed
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgEl, 0, 0, W, H);

    // Scale crop coords from image space → canvas space
    const scaleX = W / imgEl.naturalWidth;
    const scaleY = H / imgEl.naturalHeight;
    const cx     = crop.x    * scaleX;
    const cy     = crop.y    * scaleY;
    const cs     = crop.size * Math.min(scaleX, scaleY);

    // Darken outside the crop
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(cx, cy, cs, cs);

    // Draw the actual image inside the crop box (bright)
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, cy, cs, cs);
    ctx.clip();
    ctx.drawImage(imgEl, 0, 0, W, H);
    ctx.restore();

    // Crop border
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(cx, cy, cs, cs);

    // Corner handles
    const hs = 8;
    ctx.fillStyle = '#fff';
    [[cx, cy], [cx + cs - hs, cy], [cx, cy + cs - hs], [cx + cs - hs, cy + cs - hs]].forEach(([hx, hy]) => {
      ctx.fillRect(hx, hy, hs, hs);
    });
  }, [imgEl, crop]);

  useEffect(() => { draw(); }, [draw]);

  // ── Pointer events ──────────────────────────────────────────────────────
  const toImgCoords = (e) => {
    const canvas = previewRef.current;
    const rect   = canvas.getBoundingClientRect();
    const px     = (e.clientX - rect.left) * (canvas.width  / rect.width);
    const py     = (e.clientY - rect.top)  * (canvas.height / rect.height);
    const scaleX = canvas.width  / imgEl.naturalWidth;
    const scaleY = canvas.height / imgEl.naturalHeight;
    return { ix: px / scaleX, iy: py / scaleY };
  };

  const onPointerDown = (e) => {
    if (!imgEl) return;
    const { ix, iy } = toImgCoords(e);
    const { x, y, size } = crop;
    const handleZone = size * 0.12;

    // Check if near bottom-right resize handle
    if (ix >= x + size - handleZone && iy >= y + size - handleZone) {
      setDragging('resize');
    } else if (ix >= x && ix <= x + size && iy >= y && iy <= y + size) {
      setDragging('move');
    }
    setDragStart({ ix, iy, crop: { ...crop } });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragging || !dragStart || !imgEl) return;
    const { ix, iy } = toImgCoords(e);
    const dx = ix - dragStart.ix;
    const dy = iy - dragStart.iy;
    const maxW = imgEl.naturalWidth;
    const maxH = imgEl.naturalHeight;

    if (dragging === 'move') {
      setCrop((c) => ({
        ...c,
        x: Math.max(0, Math.min(maxW - c.size, dragStart.crop.x + dx)),
        y: Math.max(0, Math.min(maxH - c.size, dragStart.crop.y + dy)),
      }));
    } else if (dragging === 'resize') {
      const delta   = (dx + dy) / 2;
      const newSize = Math.max(20, Math.min(
        Math.min(maxW - dragStart.crop.x, maxH - dragStart.crop.y),
        dragStart.crop.size + delta
      ));
      setCrop((c) => ({ ...c, size: newSize }));
    }
  };

  const onPointerUp = () => {
    setDragging(null);
    setDragStart(null);
  };

  // Produce the cropped blob and extract the dominant color from it.
  const applyCrop = () => {
    const out = canvasRef.current;
    const ctx = out.getContext('2d');
    ctx.clearRect(0, 0, outputSize, outputSize);
    ctx.drawImage(imgEl, crop.x, crop.y, crop.size, crop.size, 0, 0, outputSize, outputSize);

    // Sample dominant color from the already-drawn output canvas pixels.
    const { data } = ctx.getImageData(0, 0, outputSize, outputSize);
    const detectedColor = extractDominantColorFromData(data, outputSize, outputSize);

    out.toBlob((blob) => onCropped(blob, 'image/png', detectedColor), 'image/png', 0.92);
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  if (!imageSrc) {
    return (
      <div className="logo-cropper-pick">
        <div className="logo-cropper-dropzone" onClick={() => fileRef.current?.click()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" style={{ width: 32, height: 32, color: 'var(--ink-300)' }}>
            <rect x="3" y="3" width="18" height="18" rx="3"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <div className="logo-cropper-hint">Click to select a logo image</div>
          <div className="logo-cropper-sub">PNG, JPEG or WebP · max 2 MB</div>
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp"
          style={{ display: 'none' }} onChange={handleFile} />
        <div className="logo-cropper-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    );
  }

  return (
    <div className="logo-cropper">
      <div className="logo-cropper-heading">Drag to position · corner handle to resize</div>

      {/* Interactive preview canvas */}
      <canvas
        ref={previewRef}
        width={imgEl ? Math.min(imgEl.naturalWidth, 480) : 480}
        height={imgEl ? Math.min(imgEl.naturalHeight, 360) : 360}
        className="logo-cropper-canvas"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: dragging === 'move' ? 'grabbing' : 'grab', touchAction: 'none' }}
      />

      {/* Live square preview */}
      {imgEl && (
        <div className="logo-cropper-preview-row">
          <div className="logo-cropper-preview-label">Preview</div>
          <div className="logo-cropper-preview-sizes">
            {[64, 40, 28].map((sz) => (
              <div key={sz} className="logo-cropper-preview-item">
                <PreviewThumb imgEl={imgEl} crop={crop} size={sz} />
                <div className="logo-cropper-preview-sz">{sz}px</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hidden output canvas — used only to produce the blob */}
      <canvas ref={canvasRef} width={outputSize} height={outputSize} style={{ display: 'none' }} />

      <div className="logo-cropper-actions">
        <button type="button" className="btn btn-outline"
          onClick={() => { setImageSrc(null); setImgEl(null); }}>
          Choose different image
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={applyCrop}>
          Use this crop
        </button>
      </div>
    </div>
  );
}

// Small live thumbnail — redraws whenever crop changes.
function PreviewThumb({ imgEl, crop, size }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !imgEl) return;
    const ctx = ref.current.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(imgEl, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
  }, [imgEl, crop, size]);

  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      style={{
        width: size, height: size, border: '1px solid var(--border)',
        borderRadius: size > 40 ? 8 : 4, display: 'block',
      }}
    />
  );
}
