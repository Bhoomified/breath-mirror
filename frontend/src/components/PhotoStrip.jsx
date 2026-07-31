// frontend/src/components/PhotoStrip.jsx
export default function PhotoStrip({ photos }) {
  const save = (url) => {
    const a = document.createElement('a');
    a.href = url; a.download = `breath-mirror-${Date.now()}.png`; a.click();
  };

  return (
    <div id="photoStrip">
      {photos.map((url, i) => (
        <div className="photo-thumb" key={i}>
          <img src={url} alt="capture" />
          <div className="save-btn" onClick={() => save(url)}>↓ save</div>
        </div>
      ))}
    </div>
  );
}