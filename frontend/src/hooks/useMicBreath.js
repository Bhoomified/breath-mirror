// frontend/src/hooks/useMicBreath.js
import { useEffect, useRef } from 'react';

export function useMicBreath(onBreath, threshold = 0.02) {
  const savedCallback = useRef(onBreath);
  savedCallback.current = onBreath;

  useEffect(() => {
    let audioCtx, rafId, stopped = false;
    let breathCooldown = 0; // throttle: only actually trigger fog every N frames

    async function start() {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new AudioContext();
        const src = audioCtx.createMediaStreamSource(ms);
        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 800;
        src.connect(hp);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        hp.connect(analyser);
        const buf = new Float32Array(analyser.frequencyBinCount);

        const tick = () => {
          if (stopped) return;
          rafId = requestAnimationFrame(tick);
          analyser.getFloatTimeDomainData(buf);
          let s = 0;
          for (const v of buf) s += v * v;
          const rms = Math.sqrt(s / buf.length);

          if (breathCooldown > 0) breathCooldown--;
          if (rms > threshold && breathCooldown === 0) {
            savedCallback.current(rms);
            breathCooldown = 4; // matches original v1 throttle
          }
        };
        tick();
      } catch (e) {
        console.warn('Mic access denied', e);
      }
    }

    start();
    return () => { stopped = true; if (rafId) cancelAnimationFrame(rafId); audioCtx?.close(); };
  }, [threshold]);
}