import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, FileImage, Image as ImageIcon } from 'lucide-react';

const LoadingExport = ({ printUrl, onReset }) => {
  const [isDeveloping, setIsDeveloping] = useState(true);

  useEffect(() => {
    // Polaroid-style developing overlay duration
    const timer = setTimeout(() => {
      setIsDeveloping(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const handleDownload = (format) => {
    if (!printUrl) return;

    if (format === 'png') {
      triggerFileDownload(printUrl, `aurabooth-${Date.now()}.png`);
      return;
    }

    // Convert PNG data to JPEG or WEBP using an offscreen canvas
    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/webp';
    const ext = format === 'jpeg' ? 'jpg' : 'webp';

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');

      // JPEG does not support transparency, so we paint a white background canvas base
      if (format === 'jpeg') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerFileDownload(url, `aurabooth-${Date.now()}.${ext}`);
          URL.revokeObjectURL(url); // release memory
        } else {
          // Fallback if toBlob fails
          triggerFileDownload(printUrl, `aurabooth-${Date.now()}.${ext}`);
        }
      }, mimeType, 0.95);
    };
    img.src = printUrl;
  };

  const triggerFileDownload = (url, filename) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="export-container">
      {isDeveloping ? (
        <>
          <div className="developing-label">Shaking the Polaroid...</div>
          <div className="developing-stage">
            {printUrl && (
              <img src={printUrl} className="developing-photo" alt="Developing Print" />
            )}
          </div>
          <div className="developing-hint">
            (Don't actually shake your phone! It's developing digitally...)
          </div>
        </>
      ) : (
        <>
          <div className="developing-label" style={{ color: '#ffcc00' }}>Preview Print</div>
          
          <div className="developing-stage">
            {printUrl && (
              <img 
                src={printUrl} 
                className="developing-photo" 
                style={{ animation: 'none', filter: 'none', opacity: 1, maxHeight: '50vh' }}
                alt="Final Print" 
              />
            )}
          </div>

          <div style={styles.downloadSection}>
            <div style={styles.buttonLabel}>Save Print To Device:</div>
            
            <div style={styles.buttonGrid}>
              <button 
                className="btn-gold" 
                onClick={() => handleDownload('png')} 
                style={styles.actionBtn}
              >
                <FileImage size={16} />
                <span>PNG (Crisp)</span>
              </button>
              
              <button 
                className="btn-gold" 
                onClick={() => handleDownload('jpeg')} 
                style={{ ...styles.actionBtn, backgroundColor: '#ffe4e1' }}
              >
                <ImageIcon size={16} />
                <span>JPEG (Share)</span>
              </button>
              
              <button 
                className="btn-gold" 
                onClick={() => handleDownload('webp')} 
                style={{ ...styles.actionBtn, backgroundColor: '#a6e3e9' }}
              >
                <Download size={16} />
                <span>WEBP (Small)</span>
              </button>
            </div>

            <button 
              className="btn-outline" 
              onClick={onReset} 
              style={{ ...styles.resetBtn, marginTop: '20px' }}
            >
              <RefreshCw size={18} />
              <span>Take Another Photo</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const styles = {
  downloadSection: {
    marginTop: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    maxWidth: '320px'
  },
  buttonLabel: {
    fontFamily: 'var(--font-main)',
    fontSize: '0.85rem',
    color: '#aaaaaa',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  },
  buttonGrid: {
    display: 'flex',
    gap: '8px',
    width: '100%'
  },
  actionBtn: {
    flex: 1,
    padding: '10px 0',
    fontSize: '0.75rem',
    fontWeight: '700',
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  resetBtn: {
    width: '100%',
    padding: '12px 0',
    borderRadius: '25px',
    fontSize: '0.9rem',
    fontWeight: '700',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px'
  }
};

export default LoadingExport;
