// frontend/src/components/BreathRing.jsx
import { forwardRef, useImperativeHandle, useRef } from 'react';

const BreathRing = forwardRef((_, ref) => {
  const ringRef = useRef(null);
  const timeoutRef = useRef(null);

  useImperativeHandle(ref, () => ({
    pulse() {
      ringRef.current.classList.add('active');
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => ringRef.current.classList.remove('active'), 300);
    }
  }));

  return <div ref={ringRef} id="breathRing" />;
});

export default BreathRing;