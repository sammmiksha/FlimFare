import React, { useEffect, useState } from 'react';
import { RefreshCw, Download } from 'lucide-react';

const LoadingExport = ({ canvasInstance, onReset }) => {
  const [exportUrl, setExportUrl] = useState('');
  const [isDeveloping, setIsDeveloping] = useState(true);

  // Helper to convert base64 data URL to Blob
  const dataURLtoBlob = (dataurl) => {
    try {
      const arr = dataurl.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new Blob([u8arr], { type: mime });
    } catch (e) {
      console.error('Failed to convert DataURL to Blob:', e);
      return null;
    }
  };

  useEffect(() => {
    if (!canvasInstance) return;

    // 1. Calculate device pixel ratio multiplier (max 3 for printing quality)
    const multiplier = Math.min(window.devicePixelRatio || 2, 3);

    // 2. Export canvas to high-res data URL
    const highResDataUrl = canvasInstance.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: multiplier
    });

    // 3. Convert to Blob for memory efficiency and modern downloads
    const blob = dataURLtoBlob(highResDataUrl);
    let blobUrl = '';
    if (blob) {
      blobUrl = URL.createObjectURL(blob);
      setExportUrl(blobUrl);
    } else {
      // Fallback to dataURL
      setExportUrl(highResDataUrl);
    }

    // 4. Mimic retro Polaroid developing animation (3.5 seconds)
    const timer = setTimeout(() => {
      setIsDeveloping(false);
      
      // Auto trigger download for frictionless UX
      triggerDownload(blobUrl || highResDataUrl);
    }, 3500);

    return () => {
      clearTimeout(timer);
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl); // Prevent memory leaks
      }
    };
  }, [canvasInstance]);

  const triggerDownload = (url) => {
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `aurabooth-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="export-container">
      {isDeveloping ? (
        <>
          <div className="developing-label">Shaking the photo...</div>
          <div className="developing-stage">
            {exportUrl && (
              <img src={exportUrl} className="developing-photo" alt="Developing Print" />
            )}
          </div>
          <div className="developing-hint">
            (Pro tip: Don't actually shake your phone! It's developing digitally...)
          </div>
        </>
      ) : (
        <>
          <div className="developing-label" style={{ color: '#2ecc71' }}>Print Ready!</div>
          <div className="developing-stage">
            {exportUrl && (
              <img 
                src={exportUrl} 
                className="developing-photo" 
                style={{ animation: 'none', filter: 'none', opacity: 1 }}
                alt="Final Print" 
              />
            )}
          </div>
          
          <div style={{ marginTop: '24px', display: 'flex', gap: '16px', width: '100%', maxWidth: '300px' }}>
            <button className="btn-outline" onClick={() => triggerDownload(exportUrl)} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <Download size={18} />
              <span>Save File</span>
            </button>
            <button className="btn-gold" onClick={onReset} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', flex: 1 }}>
              <RefreshCw size={18} />
              <span>Retake</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default LoadingExport;
