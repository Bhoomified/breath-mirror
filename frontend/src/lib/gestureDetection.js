// frontend/src/lib/gestureDetection.js

export function isLShape(lm) {
  return lm[8].y < lm[6].y &&
         Math.abs(lm[4].x - lm[2].x) > 0.04 &&
         lm[12].y > lm[10].y &&
         lm[16].y > lm[14].y;
}

export function getPinch(lm, W, H) {
  const fx = (1 - lm[8].x) * W, fy = lm[8].y * H;
  const tx = (1 - lm[4].x) * W, ty = lm[4].y * H;
  return { fx, fy, dist: Math.hypot(fx - tx, fy - ty) };
}