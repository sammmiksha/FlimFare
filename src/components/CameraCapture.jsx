import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, RotateCw, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { audioManager } from '../utils/audioManager';
import { LAYOUTS } from '../utils/layoutConfig';

const CameraCapture = ({ layout, onBack, onComplete }) => {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user'); // 'user' or 'environment'
  const [tempPhotos, setTempPhotos] = useState([]); // Temporary snapped photos
  const [currentSnapIndex, setCurrentSnapIndex] = useState(0);
  const [countdown, setCountdown] = useState(null); // null, 3, 2, 1, 'SNAP'
  const [isCapturing, setIsCapturing] = useState(false); // Snap chain is running
  const [showReview, setShowReview] = useState(false); // Review overlay state
  const [cameraError, setCameraError] = useState(null);
  const [captureMode, setCaptureMode] = useState(null); // null, 'camera', 'upload'

  const totalSnapsNeeded = LAYOUTS[layout]?.photoCount || 1;

  // Initialize and request camera stream
  const startCamera = async (mode) => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
      setCameraError(null);
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError('Could not access camera. Please use file upload instead.');
    }
  };

  // Start camera on mount or facingMode switch (only if captureMode is 'camera')
  useEffect(() => {
    if (captureMode === 'camera') {
      startCamera(facingMode);
    }
    
    // Stop all tracks on unmount to prevent camera LED remaining active (memory leak fix)
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, captureMode]);

  // General unmount track cleanup
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const toggleCamera = () => {
    if (isCapturing) return;
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Triggered when clicking the floating capture button
  const handleStartCaptureSequence = () => {
    if (isCapturing || !stream) return;
    setIsCapturing(true);
    setTempPhotos([]);
    setCurrentSnapIndex(0);
    
    // Start countdown for the first snap
    runCountdown(0, []);
  };

  // Countdown cycle: 3 -> 2 -> 1 -> SNAP -> capture
  const runCountdown = (snapIndex, accumulatedPhotos) => {
    setCurrentSnapIndex(snapIndex);
    setCountdown(3);

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count === 0) {
        setCountdown('SNAP');
      } else if (count < 0) {
        clearInterval(interval);
        // Take photo!
        const newPhoto = capturePhoto();
        const updatedPhotos = [...accumulatedPhotos, newPhoto];
        setTempPhotos(updatedPhotos);
        setCountdown(null);

        // Check if we need more snaps
        const nextIndex = snapIndex + 1;
        if (nextIndex < totalSnapsNeeded) {
          // Wait 1.5s, then trigger next countdown
          setTimeout(() => {
            runCountdown(nextIndex, updatedPhotos);
          }, 1500);
        } else {
          // All snaps completed! Go to review overlay.
          setIsCapturing(false);
          setShowReview(true);
          
          // Stop camera stream tracks to turn off camera light
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
      } else {
        setCountdown(count);
      }
    }, 900); // 900ms per count makes it snappier
  };

  // Offscreen precise canvas crop logic
  const capturePhoto = () => {
    if (!videoRef.current) return '';

    // Play synthesized mechanical shutter click sound instantly (iOS safe)
    audioManager.playClick();

    const video = videoRef.current;
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    const videoAspect = videoWidth / videoHeight;

    const layoutCfg = LAYOUTS[layout] || LAYOUTS.single;
    const targetAspect = layoutCfg.photoSlots[0].aspect;
    const targetWidth = layout === 'single' ? 600 : layout === 'digicam' ? 700 : 900;
    const targetHeight = Math.round(targetWidth / targetAspect);

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = targetWidth;
    offscreenCanvas.height = targetHeight;
    const ctx = offscreenCanvas.getContext('2d');

    // Calculate crop coordinates
    let sx = 0;
    let sy = 0;
    let sw = videoWidth;
    let sh = videoHeight;

    if (videoAspect > targetAspect) {
      sw = videoHeight * targetAspect;
      sx = (videoWidth - sw) / 2;
    } else if (videoAspect < targetAspect) {
      sh = videoWidth / targetAspect;
      sy = (videoHeight - sh) / 2;
    }

    ctx.save();
    // Mirror the capture if using user front-facing camera
    if (facingMode === 'user') {
      ctx.translate(targetWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
    ctx.restore();

    return offscreenCanvas.toDataURL('image/png');
  };

  const handleAcceptPhotos = () => {
    // Complete the capture session and move to editing studio
    onComplete(tempPhotos);
  };

  const handleRejectPhotos = () => {
    // Restart camera stream if using live camera
    setShowReview(false);
    setTempPhotos([]);
    setCurrentSnapIndex(0);
    if (captureMode === 'camera') {
      startCamera(facingMode);
    }
  };

  // Helper to center-crop uploaded images to the target template aspect ratio
  const cropImageToAspect = (dataUrl, aspect) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        const imgAspect = img.width / img.height;
        let sw = img.width;
        let sh = img.height;
        let sx = 0;
        let sy = 0;

        if (imgAspect > aspect) {
          sw = img.height * aspect;
          sx = (img.width - sw) / 2;
        } else if (imgAspect < aspect) {
          sh = img.width / aspect;
          sy = (img.height - sh) / 2;
        }

        // Output sizes matching standard high-res templates
        const targetWidth = layout === 'single' ? 600 : layout === 'digicam' ? 700 : 900;
        const targetHeight = Math.round(targetWidth / aspect);

        canvas.width = targetWidth;
        canvas.height = targetHeight;

        // Draw center-cropped portion onto offscreen canvas
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        resolve(dataUrl); // Fallback to raw if image failed to load/parse
      };
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files).slice(0, totalSnapsNeeded);
    const targetAspect = LAYOUTS[layout]?.photoSlots[0].aspect || 1.0;
    
    // Read and crop all files in parallel
    const readAndCropPromises = filesArray.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const cropped = await cropImageToAspect(event.target.result, targetAspect);
            resolve(cropped);
          } catch (err) {
            console.error('Cropping failed:', err);
            resolve(event.target.result); // Fallback to raw dataURL
          }
        };
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    });

    const croppedPhotos = await Promise.all(readAndCropPromises);
    const validPhotos = croppedPhotos.filter(p => p !== '');

    if (validPhotos.length === 0) {
      alert('Could not load any selected files. Please try again.');
      return;
    }

    // Pad if fewer photos uploaded than required
    const finalPhotos = [...validPhotos];
    while (finalPhotos.length < totalSnapsNeeded) {
      finalPhotos.push(validPhotos[0] || ''); // pad with first photo
    }

    setTempPhotos(finalPhotos);
    setShowReview(true);

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    e.target.value = ''; // reset file input
  };

  const triggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 1. Photo Source Picker Screen
  if (!captureMode) {
    return (
      <div className="camera-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={styles.cameraHeader}>
          <button onClick={onBack} style={styles.backBtn}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <div style={styles.headerTitle}>
            {layout === 'single' ? 'Polaroid Booth' : `Film Strip Booth`}
          </div>
        </div>

        <div style={styles.sourceSelectionBox}>
          <div style={styles.sourceSelectionTitle}>Choose Photo Source</div>
          <p style={styles.sourceSelectionSubtitle}>
            {layout === 'single' 
              ? 'Snap a fresh photo using your camera or upload a square photo from your library.' 
              : 'Snap 3 photos sequentially or upload 3 photos from your device.'}
          </p>

          <div style={styles.sourceButtonGrid}>
            <button 
              className="btn-gold" 
              onClick={() => setCaptureMode('camera')}
              style={styles.sourceBtn}
            >
              <Camera size={24} />
              <span>📸 Use Camera</span>
            </button>

            <button 
              className="btn-outline" 
              onClick={() => {
                setCaptureMode('upload');
                setTimeout(() => triggerUpload(), 100);
              }}
              style={styles.sourceBtn}
            >
              <Upload size={24} />
              <span>📤 Upload Photo(s)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Upload Prompt Screen (if 'upload' chosen but no photos selected yet)
  if (captureMode === 'upload' && tempPhotos.length === 0) {
    return (
      <div className="camera-container" style={{ justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={styles.cameraHeader}>
          <button onClick={() => setCaptureMode(null)} style={styles.backBtn}>
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <div style={styles.headerTitle}>
            Upload Photos
          </div>
        </div>

        <div style={styles.sourceSelectionBox}>
          <div style={styles.sourceSelectionTitle}>Upload Photo(s)</div>
          <p style={styles.sourceSelectionSubtitle}>
            Please select {totalSnapsNeeded} photo{totalSnapsNeeded > 1 ? 's' : ''} for your layout.
          </p>

          <div style={{ margin: '40px 0', textAlign: 'center' }}>
            <button 
              className="btn-gold" 
              onClick={triggerUpload}
              style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', margin: '0 auto' }}
            >
              <Upload size={20} />
              <span>Select Files</span>
            </button>
          </div>

          <button 
            className="btn-outline" 
            onClick={() => setCaptureMode('camera')}
            style={{ width: '100%', borderRadius: '20px' }}
          >
            <span>Or switch to live camera</span>
          </button>
        </div>

        {/* Invisible file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          multiple={totalSnapsNeeded > 1}
          style={{ display: 'none' }}
        />
      </div>
    );
  }

  // 3. Normal Camera view / Review view
  return (
    <div className="camera-container">
      {/* Top Header Bar */}
      <div style={styles.cameraHeader}>
        <button onClick={() => setCaptureMode(null)} style={styles.backBtn} disabled={isCapturing}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div style={styles.headerTitle}>
          {layout === 'single' ? 'Polaroid Booth' : `Film Strip Booth`}
        </div>
        {captureMode === 'camera' && (
          <button className="camera-btn" onClick={toggleCamera} disabled={cameraError || isCapturing} style={{ background: 'none', border: 'none', color: '#fff', opacity: (cameraError || isCapturing) ? 0.4 : 1, width: 'auto', height: 'auto' }}>
            <RotateCw size={20} />
          </button>
        )}
      </div>

      {/* Top-Right Capture Indicators [✓] [ ] [ ] */}
      <div className="capture-indicators">
        {Array.from({ length: totalSnapsNeeded }).map((_, idx) => (
          <div 
            key={idx} 
            className={`indicator-box ${tempPhotos.length > idx ? 'filled' : ''}`}
          >
            {tempPhotos.length > idx ? '✓' : idx + 1}
          </div>
        ))}
      </div>

      {/* Camera Stage Viewfinder */}
      <div className="camera-preview-wrapper">
        {!cameraError ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`camera-video ${facingMode === 'environment' ? 'back-camera' : ''}`}
          />
        ) : (
          <div style={styles.cameraErrorText}>
            <p>{cameraError}</p>
            <button className="btn-gold" style={{ marginTop: '15px' }} onClick={triggerUpload}>
              <Upload size={18} />
              <span>Upload Image</span>
            </button>
          </div>
        )}
        
        {/* Aspect ratio guide bounds */}
        {!cameraError && !showReview && !countdown && (
          <div className={`camera-overlay-frame ${layout}`} />
        )}

        {/* Countdown Overlay numbers */}
        {countdown !== null && (
          <div className="countdown-overlay">
            <div className="countdown-text">{countdown}</div>
          </div>
        )}
      </div>

      {/* Floating Capture Button (bottom center) */}
      {!showReview && (
        <button 
          className="capture-btn"
          onClick={handleStartCaptureSequence}
          disabled={isCapturing || cameraError || !stream}
        >
          {isCapturing ? '⏳' : '📸'}
        </button>
      )}

      {/* Invisible file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple={totalSnapsNeeded > 1}
        style={{ display: 'none' }}
      />

      {/* Full Session Review Overlay (Previews all captured snaps before Editor) */}
      {showReview && (
        <div className="review-overlay">
          <div className="review-title">Review Snaps</div>
          <div className="review-preview-container">
            <div className="review-preview-frame">
              {layout === 'single' && (
                // Polaroid Preview mock
                <div style={styles.reviewPolaroidFrame}>
                  <img 
                    src={tempPhotos[0]} 
                    style={styles.reviewPolaroidImg} 
                    alt="Polaroid capture" 
                  />
                </div>
              )}
              {layout === 'digicam' && (
                // Digicam Preview mock with overlay
                <div style={styles.reviewDigicamFrame}>
                  <img 
                    src={tempPhotos[0]} 
                    style={styles.reviewDigicamImg} 
                    alt="Digicam capture" 
                  />
                  <img 
                    src="/retro_camera_frame.png"
                    style={styles.reviewDigicamOverlay}
                    alt="Camera overlay"
                  />
                </div>
              )}
              {layout === 'strip' && (
                // Film Strip Preview mock (3 photos)
                <div style={styles.reviewStripFrame}>
                  {tempPhotos.slice(0, 3).map((url, i) => (
                    <div key={i} style={styles.reviewStripSlot}>
                      <img 
                        src={url} 
                        style={styles.reviewStripImg} 
                        alt={`Snap ${i+1}`} 
                      />
                    </div>
                  ))}
                </div>
              )}
              {layout === 'strip5' && (
                // Film Strip Preview mock (5 photos)
                <div style={{ ...styles.reviewStripFrame, gap: '6px', padding: '8px' }}>
                  {tempPhotos.slice(0, 5).map((url, i) => (
                    <div key={i} style={{ ...styles.reviewStripSlot, height: '70px' }}>
                      <img 
                        src={url} 
                        style={styles.reviewStripImg} 
                        alt={`Snap ${i+1}`} 
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="review-actions">
            <button className="btn-outline" onClick={handleRejectPhotos} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <RefreshCw size={18} />
              <span>Retake All</span>
            </button>
            <button className="btn-gold" onClick={handleAcceptPhotos} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <Check size={18} />
              <span>Looks Good!</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  cameraHeader: {
    height: '60px',
    backgroundColor: '#0c0502',
    borderBottom: '2px solid var(--color-gold)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 10,
    width: '100%'
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: '600',
  },
  headerTitle: {
    fontFamily: 'var(--font-main)',
    fontWeight: '700',
    fontSize: '1rem',
    color: 'var(--color-gold)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  cameraErrorText: {
    textAlign: 'center',
    padding: '20px',
    color: '#e2d9d5',
  },
  // Polaroid Preview frame in review modal
  reviewPolaroidFrame: {
    width: '280px',
    backgroundColor: '#ffffff',
    padding: '16px 16px 40px 16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column'
  },
  reviewPolaroidImg: {
    width: '100%',
    height: '248px',
    objectFit: 'cover',
    border: '1px solid #ddd'
  },
  reviewDigicamFrame: {
    width: '280px',
    height: '280px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    overflow: 'hidden',
    borderRadius: '12px',
    backgroundColor: '#fff'
  },
  reviewDigicamImg: {
    position: 'absolute',
    left: '37.7%', // Match 386 / 1024
    top: '39.2%',  // Match 402 / 1024
    width: '38.5%', // Match 394 / 1024
    height: '32.5%', // Match 333 / 1024
    objectFit: 'cover',
    zIndex: 1
  },
  reviewDigicamOverlay: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    zIndex: 2,
    pointerEvents: 'none'
  },
  // Film strip review frame (matte black style)
  reviewStripFrame: {
    width: '180px',
    backgroundColor: '#111111',
    padding: '12px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '2px solid rgba(255, 255, 255, 0.1)'
  },
  reviewStripSlot: {
    width: '100%',
    height: '128px',
    overflow: 'hidden',
    backgroundColor: '#222'
  },
  reviewStripImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  sourceSelectionBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 14, 5, 0.95)',
    border: '3px solid var(--color-gold)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8)',
    borderRadius: '16px',
    padding: '32px 24px',
    maxWidth: '360px',
    width: '90%',
    textAlign: 'center',
    margin: 'auto 0'
  },
  sourceSelectionTitle: {
    fontFamily: 'Bungee',
    fontSize: '1.4rem',
    color: 'var(--color-gold)',
    marginBottom: '12px',
    textShadow: '0 0 8px rgba(255, 204, 0, 0.4)'
  },
  sourceSelectionSubtitle: {
    fontFamily: 'Outfit',
    fontSize: '0.9rem',
    color: '#e2d9d5',
    lineHeight: '1.4',
    marginBottom: '28px'
  },
  sourceButtonGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%'
  },
  sourceBtn: {
    width: '100%',
    padding: '16px 20px',
    fontSize: '1rem',
    fontWeight: '700',
    borderRadius: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  }
};

export default CameraCapture;
