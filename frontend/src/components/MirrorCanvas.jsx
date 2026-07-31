import { useEffect, useRef, useState } from 'react';
import { FogRenderer } from '../lib/fogRenderer';
import { isLShape } from '../lib/gestureDetection';
import { useMicBreath } from '../hooks/useMicBreath';

const HOLD_MS = 1500;

export default function MirrorCanvas({ onStatusChange, onPhotoCaptured, breathRingRef }) {
  const videoRef = useRef(null);
  const cameraCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const blurCanvasRef = useRef(null);
  const frameCanvasRef = useRef(null);
  const cursorRef = useRef(null);
  const offscreenRef = useRef(document.createElement('canvas'));
  const fogRef = useRef(null);
  const dimsRef = useRef({ W: 0, H: 0 });
  const isDrawingRef = useRef(false);
  const holdStartRef = useRef(null);
  const countingDownRef = useRef(false);

  const [flash, setFlash] = useState(false);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => { fogRef.current = new FogRenderer(maskCanvasRef.current); }, []);

  useMicBreath((volume) => {
    if (!fogRef.current) return;
    fogRef.current.addFog(volume, dimsRef.current.W, dimsRef.current.H);
    breathRingRef.current?.pulse();
    if (!countingDownRef.current) onStatusChange('pinch to draw');
  });

  useEffect(() => {
    function resize() {
      const W = window.innerWidth, H = window.innerHeight;
      dimsRef.current = { W, H };
      [cameraCanvasRef, maskCanvasRef, blurCanvasRef, frameCanvasRef].forEach(r => {
        r.current.width = W; r.current.height = H;
      });
      offscreenRef.current.width = W; offscreenRef.current.height = H;
    }
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    let mpCamera, hands, rafId;
    const video = videoRef.current;

    function render() {
      rafId = requestAnimationFrame(render);
      const { W, H } = dimsRef.current;
      if (video.readyState < 2) return;
      const camCtx = cameraCanvasRef.current.getContext('2d');
      const offCtx = offscreenRef.current.getContext('2d');
      const blurCtx = blurCanvasRef.current.getContext('2d');

      camCtx.save(); camCtx.translate(W, 0); camCtx.scale(-1, 1);
      camCtx.drawImage(video, 0, 0, W, H); camCtx.restore();

      offCtx.save();
      offCtx.filter = 'blur(14px) brightness(1.05)';
      offCtx.translate(W, 0); offCtx.scale(-1, 1);
      offCtx.drawImage(video, 0, 0, W, H); offCtx.restore();
      offCtx.fillStyle = 'rgba(205,218,228,0.35)';
      offCtx.fillRect(0, 0, W, H);

      blurCtx.clearRect(0, 0, W, H);
      blurCtx.drawImage(offscreenRef.current, 0, 0);
      blurCtx.globalCompositeOperation = 'destination-in';
      blurCtx.drawImage(maskCanvasRef.current, 0, 0);
      blurCtx.globalCompositeOperation = 'source-over';
    }

    function drawCaptureFrame(lm1, lm2, progress) {
      const { W, H } = dimsRef.current;
      const frameCtx = frameCanvasRef.current.getContext('2d');
      frameCtx.clearRect(0, 0, W, H);
      const x1 = (1 - lm1[8].x) * W, y1 = lm1[8].y * H;
      const x2 = (1 - lm2[8].x) * W, y2 = lm2[8].y * H;
      const left = Math.min(x1, x2), right = Math.max(x1, x2);
      const top = Math.min(y1, y2), bottom = top + (right - left) * 0.75;
      const cLen = (right - left) * 0.18;
      frameCtx.strokeStyle = `rgba(255,255,255,${0.5 + progress * 0.5})`;
      frameCtx.lineWidth = 2 + progress * 1.5; frameCtx.lineCap = 'square';
      [[left, top + cLen, left, top, left + cLen, top],
       [right - cLen, top, right, top, right, top + cLen],
       [left, bottom - cLen, left, bottom, left + cLen, bottom],
       [right - cLen, bottom, right, bottom, right, bottom - cLen]
      ].forEach(([x1, y1, x2, y2, x3, y3]) => {
        frameCtx.beginPath();
        frameCtx.moveTo(x1, y1); frameCtx.lineTo(x2, y2); frameCtx.lineTo(x3, y3);
        frameCtx.stroke();
      });
    }

    function doCapture() {
      const { W, H } = dimsRef.current;
      setFlash(true);
      setTimeout(() => setFlash(false), 80);
      const snap = document.createElement('canvas');
      snap.width = W; snap.height = H;
      const sCtx = snap.getContext('2d');
      sCtx.drawImage(cameraCanvasRef.current, 0, 0);
      sCtx.drawImage(blurCanvasRef.current, 0, 0);
      snap.toBlob(blob => {
        onPhotoCaptured(URL.createObjectURL(blob));
        frameCanvasRef.current.getContext('2d').clearRect(0, 0, W, H);
        holdStartRef.current = null;
        onStatusChange(fogRef.current.fogReady ? 'pinch to draw' : 'blow on the screen');
      }, 'image/png');
    }

    function startCountdown() {
      countingDownRef.current = true;
      let count = 3;
      setCountdown(count);
      onStatusChange('get ready…');
      const timer = setInterval(() => {
        count--;
        if (count > 0) setCountdown(count);
        else {
          clearInterval(timer);
          setCountdown(null);
          countingDownRef.current = false;
          doCapture();
        }
      }, 1000);
    }

    function onHandsResults(results) {
      const all = results.multiHandLandmarks || [];
      const { W, H } = dimsRef.current;
      const cursor = cursorRef.current;

      if (all.length >= 1 && !countingDownRef.current) {
        const lm = all[0];
        const fx = (1 - lm[8].x) * W, fy = lm[8].y * H;
        const tx = (1 - lm[4].x) * W, ty = lm[4].y * H;
        const pinching = Math.hypot(fx - tx, fy - ty) < W * 0.055;
        cursor.style.left = fx + 'px'; cursor.style.top = fy + 'px'; cursor.style.opacity = '1';

        if (pinching && fogRef.current.fogReady) {
          holdStartRef.current = null;
          frameCanvasRef.current.getContext('2d').clearRect(0, 0, W, H);
          cursor.classList.add('drawing');
          if (!isDrawingRef.current) { fogRef.current.saveSnapshot(W, H); isDrawingRef.current = true; }
          fogRef.current.eraseAt(fx, fy);
          onStatusChange('drawing…');
          return;
        } else {
          cursor.classList.remove('drawing');
          isDrawingRef.current = false;
          fogRef.current.resetDraw();
        }
      } else if (!countingDownRef.current) {
        cursor.style.opacity = '0';
        isDrawingRef.current = false;
        fogRef.current.resetDraw();
      }

      if (!countingDownRef.current) {
        const bothL = all.length === 2 && isLShape(all[0]) && isLShape(all[1]);
        if (bothL) {
          if (!holdStartRef.current) holdStartRef.current = Date.now();
          const elapsed = Date.now() - holdStartRef.current;
          drawCaptureFrame(all[0], all[1], Math.min(elapsed / HOLD_MS, 1));
          onStatusChange('📷 hold…');
          if (elapsed >= HOLD_MS) {
            holdStartRef.current = null;
            frameCanvasRef.current.getContext('2d').clearRect(0, 0, W, H);
            startCountdown();
          }
        } else {
          if (holdStartRef.current) {
            holdStartRef.current = null;
            frameCanvasRef.current.getContext('2d').clearRect(0, 0, W, H);
          }
          if (!fogRef.current.fogReady) onStatusChange('blow on the screen');
          else if (all.length >= 1) onStatusChange('pinch to draw');
        }
      }
    }

    async function init() {
      const { Camera } = await import('@mediapipe/camera_utils');
      const { Hands } = await import('@mediapipe/hands');

      hands = new Hands({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.6, minTrackingConfidence: 0.5 });
      hands.onResults(onHandsResults);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false
        });
        video.srcObject = stream;
        await video.play();
        mpCamera = new Camera(video, {
          onFrame: async () => { await hands.send({ image: video }); },
          width: 1280, height: 720
        });
        mpCamera.start();
        onStatusChange('blow on the screen');
        render();
      } catch (e) {
        onStatusChange('camera access needed');
      }
    }

    init();
    return () => { if (rafId) cancelAnimationFrame(rafId); mpCamera?.stop?.(); };
  }, []);

  const undo = () => fogRef.current?.undo();
  const clear = () => { fogRef.current?.clear(dimsRef.current.W, dimsRef.current.H); onStatusChange('blow on the screen'); };

  return (
    <div id="container">
      <video ref={videoRef} autoPlay playsInline muted />
      <canvas ref={cameraCanvasRef} id="cameraCanvas" />
      <canvas ref={maskCanvasRef} id="maskCanvas" />
      <canvas ref={blurCanvasRef} id="blurCanvas" />
      <canvas ref={frameCanvasRef} id="frameCanvas" />
      <div ref={cursorRef} id="cursor" />
      {countdown && <div id="countdown" className="show">{countdown}</div>}
      {flash && <div id="flash" style={{ opacity: 0.9 }} />}
      <div id="btnGroup">
        <button onClick={undo}>↩ undo</button>
        <button onClick={clear}>✕ clear</button>
      </div>
    </div>
  );
}