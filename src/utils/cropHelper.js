export const calculateCropTransform = (imgW, imgH, slotW, slotH, crop) => {
  const { zoom = 1.0, offsetXRatio = 0.0, offsetYRatio = 0.0 } = crop || {};

  const imgAspect = imgW / imgH;
  const slotAspect = slotW / slotH;

  const s_min = Math.max(slotW / imgW, slotH / imgH);
  const s = s_min * zoom;

  const w = imgW * s;
  const h = imgH * s;

  let scaleFactorX, scaleFactorY;
  if (imgAspect > slotAspect) {
    scaleFactorX = (imgAspect / slotAspect) * zoom;
    scaleFactorY = zoom;
  } else {
    scaleFactorX = zoom;
    scaleFactorY = (slotAspect / imgAspect) * zoom;
  }

  // Pixel limits for offsets
  const maxOffsetX = (w - slotW) / 2;
  const minOffsetX = (slotW - w) / 2;
  const maxOffsetY = (h - slotH) / 2;
  const minOffsetY = (slotH - h) / 2;

  // Normalized bounds limits
  const minRatioX = (1 - scaleFactorX) / 2;
  const maxRatioX = (scaleFactorX - 1) / 2;
  const minRatioY = (1 - scaleFactorY) / 2;
  const maxRatioY = (scaleFactorY - 1) / 2;

  // Clamp normalized ratios
  const clampedRatioX = Math.max(minRatioX, Math.min(maxRatioX, offsetXRatio));
  const clampedRatioY = Math.max(minRatioY, Math.min(maxRatioY, offsetYRatio));

  // Convert clamped ratios to pixel offsets
  const offsetXClamped = clampedRatioX * slotW;
  const offsetYClamped = clampedRatioY * slotH;

  return {
    s,
    w,
    h,
    offsetXClamped,
    offsetYClamped,
    clampedRatioX,
    clampedRatioY,
    maxOffsetX,
    maxOffsetY,
    minOffsetX,
    minOffsetY,
    minRatioX,
    maxRatioX,
    minRatioY,
    maxRatioY
  };
};
