// frontend/src/hooks/useMicBreath.js
import { useEffect, useRef } from 'react';

export function useMicBreath(onBreath, threshold = 0.014) {
  const savedCallback = useRef(onBreath);
  savedCallback.current = onBreath;

  useEffect(() => {
    let audioCtx, rafId, stopped = false;

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
          if (rms > threshold) savedCallback.current(rms);
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