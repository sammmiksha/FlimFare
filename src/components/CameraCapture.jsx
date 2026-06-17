import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, RotateCw, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { audioManager } from '../utils/audioManager';

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

  const totalSnapsNeeded = layout === 'single' ? 1 : 3;

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

  // Start camera on mount or facingMode switch
  useEffect(() => {
    startCamera(facingMode);
    
    // Stop all tracks on unmount to prevent camera LED remaining active (memory leak fix)
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode]);

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

    // Aspect ratios: 1:1 for Polaroid, 170:140 for Strip Box
    const targetAspect = layout === 'single' ? 1.0 : 170 / 140;
    const targetWidth = layout === 'single' ? 600 : 510;
    const targetHeight = layout === 'single' ? 600 : 420;

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
    // Restart camera stream
    setShowReview(false);
    setTempPhotos([]);
    setCurrentSnapIndex(0);
    startCamera(facingMode);
  };

  const handleFileUpload = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // If they choose film strip, they can upload multiple files or we guide them one by one.
    // To make it super simple, we let them upload files and add them to tempPhotos
    const newPhotos = [];
    const filesArray = Array.from(files).slice(0, totalSnapsNeeded);
    
    let loadedCount = 0;
    filesArray.forEach((file, index) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        newPhotos[index] = event.target.result;
        loadedCount += 1;
        if (loadedCount === filesArray.length) {
          // If they uploaded fewer than needed, fill the rest with duplicate or leave empty?
          // Let's require them to upload the total needed, or just pad it
          const finalPhotos = [...newPhotos];
          while (finalPhotos.length < totalSnapsNeeded) {
            finalPhotos.push(newPhotos[0] || ''); // pad with first photo
          }
          setTempPhotos(finalPhotos);
          setShowReview(true);

          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = ''; // reset file input
  };

  const triggerUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="camera-container">
      {/* Top Header Bar */}
      <div style={styles.cameraHeader}>
        <button onClick={onBack} style={styles.backBtn} disabled={isCapturing}>
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <div style={styles.headerTitle}>
          {layout === 'single' ? 'Polaroid Booth' : `Film Strip Booth`}
        </div>
        <button className="camera-btn" onClick={toggleCamera} disabled={cameraError || isCapturing} style={{ background: 'none', border: 'none', color: '#fff', opacity: (cameraError || isCapturing) ? 0.4 : 1, width: 'auto', height: 'auto' }}>
          <RotateCw size={20} />
        </button>
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
              {layout === 'single' ? (
                // Polaroid Preview mock
                <div style={styles.reviewPolaroidFrame}>
                  <img 
                    src={tempPhotos[0]} 
                    style={styles.reviewPolaroidImg} 
                    alt="Polaroid capture" 
                  />
                </div>
              ) : (
                // Film Strip Preview mock (stack of 3 photos)
                <div style={styles.reviewStripFrame}>
                  {tempPhotos.map((url, i) => (
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
  }
};

export default CameraCapture;
