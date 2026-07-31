// frontend/src/App.jsx
import { useRef, useState } from 'react';
import MirrorCanvas from './components/MirrorCanvas';
import BreathRing from './components/BreathRing';
import PhotoStrip from './components/PhotoStrip';
import './styles/mirror.css';

export default function App() {
  const [status, setStatus] = useState('initializing…');
  const [photos, setPhotos] = useState([]);
  const breathRingRef = useRef(null);

  return (
    <>
      <MirrorCanvas
        onStatusChange={setStatus}
        onPhotoCaptured={(url) => setPhotos(prev => [...prev, url])}
        breathRingRef={breathRingRef}
      />
      <div id="status">{status}</div>
      <BreathRing ref={breathRingRef} />
      <PhotoStrip photos={photos} />
    </>
  );
}