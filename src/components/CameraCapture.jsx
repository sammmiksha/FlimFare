import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, RotateCw, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { audioManager } from '../utils/audioManager';
import { LAYOUTS } from '../utils/layoutConfig';
import { calculateCropTransform } from '../utils/cropHelper';

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
  const [adjustingIndex, setAdjustingIndex] = useState(null);
  const [workingParams, setWorkingParams] = useState({ zoom: 1.0, offsetXRatio: 0.0, offsetYRatio: 0.0 });
  const [resetKey, setResetKey] = useState(0);

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

  // Recalculate bounds and clamp/sync offsets when template layout changes
  useEffect(() => {
    if (tempPhotos.length > 0) {
      let updated = false;
      const nextPhotos = tempPhotos.map(photo => {
        if (photo.crop && photo.crop.layoutId !== layout) {
          updated = true;
          return {
            ...photo,
            crop: {
              ...photo.crop,
              layoutId: layout
            }
          };
        }
        return photo;
      });
      if (updated) {
        setTempPhotos(nextPhotos);
      }
    }
  }, [layout, tempPhotos]);

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
        const capData = capturePhoto();
        const newPhoto = {
          src: capData.src,
          width: capData.width,
          height: capData.height,
          crop: {
            zoom: 1.0,
            offsetXRatio: 0.0,
            offsetYRatio: 0.0,
            layoutId: layout,
            focalPointX: 0.5,
            focalPointY: 0.5
          }
        };
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
    if (!videoRef.current) return { src: '', width: 0, height: 0 };

    // Play synthesized mechanical shutter click sound instantly (iOS safe)
    audioManager.playClick();

    const video = videoRef.current;
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = videoWidth;
    offscreenCanvas.height = videoHeight;
    const ctx = offscreenCanvas.getContext('2d');

    ctx.save();
    // Mirror the capture if using user front-facing camera
    if (facingMode === 'user') {
      ctx.translate(videoWidth, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    ctx.restore();

    return {
      src: offscreenCanvas.toDataURL('image/jpeg', 0.85),
      width: videoWidth,
      height: videoHeight
    };
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

  const handleSaveAdjust = () => {
    setTempPhotos(prev => {
      const updated = [...prev];
      updated[adjustingIndex] = {
        ...updated[adjustingIndex],
        crop: {
          ...updated[adjustingIndex].crop,
          zoom: workingParams.zoom,
          offsetXRatio: workingParams.offsetXRatio,
          offsetYRatio: workingParams.offsetYRatio
        }
      };
      return updated;
    });
    setAdjustingIndex(null);
  };

  const handleResetSlot = (index) => {
    setTempPhotos(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        crop: {
          ...updated[index].crop,
          zoom: 1.0,
          offsetXRatio: 0.0,
          offsetYRatio: 0.0
        }
      };
      return updated;
    });
  };

  // Helper to resize uploaded images to max 1280px maintaining aspect ratio
  const processUploadedPhoto = (dataUrl) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const imgAspect = img.width / img.height;
        let width = img.width;
        let height = img.height;
        const maxDimension = 1280;

        if (width > maxDimension || height > maxDimension) {
          if (imgAspect > 1) {
            width = maxDimension;
            height = Math.round(maxDimension / imgAspect);
          } else {
            height = maxDimension;
            width = Math.round(maxDimension * imgAspect);
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve({
          src: canvas.toDataURL('image/jpeg', 0.85),
          width,
          height
        });
      };
      img.onerror = () => {
        resolve({ src: dataUrl, width: 600, height: 600 });
      };
      img.src = dataUrl;
    });
  };

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files).slice(0, totalSnapsNeeded);
    
    // Read and process all files in parallel
    const readAndProcessPromises = filesArray.map((file) => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const processed = await processUploadedPhoto(event.target.result);
            resolve(processed);
          } catch (err) {
            console.error('Processing failed:', err);
            resolve({ src: event.target.result, width: 600, height: 600 });
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      });
    });

    const processedPhotos = await Promise.all(readAndProcessPromises);
    const validPhotos = processedPhotos.filter(p => p !== null);

    if (validPhotos.length === 0) {
      alert('Could not load any selected files. Please try again.');
      return;
    }

    const mappedPhotos = validPhotos.map(photo => ({
      src: photo.src,
      width: photo.width,
      height: photo.height,
      crop: {
        zoom: 1.0,
        offsetXRatio: 0.0,
        offsetYRatio: 0.0,
        layoutId: layout,
        focalPointX: 0.5,
        focalPointY: 0.5
      }
    }));

    // Pad if fewer photos uploaded than required
    const finalPhotos = [...mappedPhotos];
    while (finalPhotos.length < totalSnapsNeeded) {
      finalPhotos.push({
        ...mappedPhotos[0],
        crop: {
          zoom: 1.0,
          offsetXRatio: 0.0,
          offsetYRatio: 0.0,
          layoutId: layout,
          focalPointX: 0.5,
          focalPointY: 0.5
        }
      });
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

  const targetAspect = LAYOUTS[layout]?.photoSlots[0].aspect || 1.0;
  let adjustW = 280;
  let adjustH = Math.round(adjustW / targetAspect);
  if (adjustH > 350) {
    adjustH = 350;
    adjustW = Math.round(adjustH * targetAspect);
  }
  const adjustModalDims = { w: adjustW, h: adjustH };

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
              <div className="review-strip-container custom-scrollbar">
                {layout === 'single' && (
                  // Polaroid Preview mock
                  <div style={styles.reviewPolaroidFrame}>
                    <ReviewPhotoSlot
                      photo={tempPhotos[0]}
                      aspect={1.0}
                      width={248}
                      onAdjustClick={() => {
                        setWorkingParams({
                          zoom: tempPhotos[0].crop?.zoom || 1.0,
                          offsetXRatio: tempPhotos[0].crop?.offsetXRatio || 0.0,
                          offsetYRatio: tempPhotos[0].crop?.offsetYRatio || 0.0
                        });
                        setAdjustingIndex(0);
                      }}
                      onResetClick={() => handleResetSlot(0)}
                    />
                  </div>
                )}
                {layout === 'digicam' && (
                  // Digicam Preview mock with overlay
                  <div style={styles.reviewDigicamFrame}>
                    <div style={{
                      position: 'absolute',
                      left: '37.7%', // Match 386 / 1024
                      top: '39.2%',  // Match 402 / 1024
                      width: '38.5%', // Match 394 / 1024
                      height: '32.5%', // Match 333 / 1024
                      zIndex: 1
                    }}>
                      <ReviewPhotoSlot
                        photo={tempPhotos[0]}
                        aspect={138 / 117}
                        width={108} // 280px container * 38.5% is approx 108px
                        onAdjustClick={() => {
                          setWorkingParams({
                            zoom: tempPhotos[0].crop?.zoom || 1.0,
                            offsetXRatio: tempPhotos[0].crop?.offsetXRatio || 0.0,
                            offsetYRatio: tempPhotos[0].crop?.offsetYRatio || 0.0
                          });
                          setAdjustingIndex(0);
                        }}
                        onResetClick={() => handleResetSlot(0)}
                      />
                    </div>
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
                    {tempPhotos.slice(0, 3).map((photo, i) => (
                      <div key={i} style={{ ...styles.reviewStripSlot, height: 'auto' }}>
                        <ReviewPhotoSlot
                          photo={photo}
                          aspect={0.75}
                          width={156} // 180px container - 24px padding = 156px
                          onAdjustClick={() => {
                            setWorkingParams({
                              zoom: photo.crop?.zoom || 1.0,
                              offsetXRatio: photo.crop?.offsetXRatio || 0.0,
                              offsetYRatio: photo.crop?.offsetYRatio || 0.0
                            });
                            setAdjustingIndex(i);
                          }}
                          onResetClick={() => handleResetSlot(i)}
                        />
                      </div>
                    ))}
                  </div>
                )}
                {layout === 'strip5' && (
                  // Film Strip Preview mock (5 photos)
                  <div style={{ ...styles.reviewStripFrame, gap: '6px', padding: '8px' }}>
                    {tempPhotos.slice(0, 5).map((photo, i) => (
                      <div key={i} style={{ ...styles.reviewStripSlot, height: 'auto' }}>
                        <ReviewPhotoSlot
                          photo={photo}
                          aspect={180 / 145}
                          width={164} // 180px container - 16px padding = 164px
                          onAdjustClick={() => {
                            setWorkingParams({
                              zoom: photo.crop?.zoom || 1.0,
                              offsetXRatio: photo.crop?.offsetXRatio || 0.0,
                              offsetYRatio: photo.crop?.offsetYRatio || 0.0
                            });
                            setAdjustingIndex(i);
                          }}
                          onResetClick={() => handleResetSlot(i)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

      {/* Adjust Modal Overlay */}
      {adjustingIndex !== null && (
        <div className="adjust-modal-overlay">
          <div className="adjust-modal-container">
            <div className="adjust-modal-header">
              <h3>Adjust Photo {adjustingIndex + 1}</h3>
            </div>
            
            <div className="adjust-modal-body">
              <InteractivePhotoAdjust
                key={`${adjustingIndex}-${resetKey}`}
                photo={tempPhotos[adjustingIndex]}
                slotW={adjustModalDims.w}
                slotH={adjustModalDims.h}
                onChange={(adjustedParams) => {
                  setWorkingParams(adjustedParams);
                }}
              />
              <p className="adjust-modal-instructions">
                Drag to pan | Scroll or Pinch to zoom | Double tap to reset
              </p>
            </div>

            <div className="adjust-modal-footer">
              <button className="btn-outline" onClick={() => setAdjustingIndex(null)}>
                Cancel
              </button>
              <button 
                className="btn-outline" 
                onClick={() => {
                  setWorkingParams({ zoom: 1.0, offsetXRatio: 0.0, offsetYRatio: 0.0 });
                  setResetKey(prev => prev + 1);
                }}
              >
                Fit
              </button>
              <button className="btn-gold" onClick={handleSaveAdjust}>
                Save
              </button>
            </div>
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

const ReviewPhotoSlot = ({ photo, aspect, width, onAdjustClick, onResetClick }) => {
  const slotW = width;
  const slotH = width / aspect;

  const { w, h, offsetXClamped, offsetYClamped } = calculateCropTransform(
    photo.width,
    photo.height,
    slotW,
    slotH,
    photo.crop
  );

  return (
    <div
      onDoubleClick={onResetClick}
      style={{
        width: `${slotW}px`,
        height: `${slotH}px`,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#222',
        border: '1px solid #ddd'
      }}
      className="review-photo-slot-container"
    >
      <img
        src={photo.src}
        alt="Slot preview"
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${offsetXClamped}px, ${offsetYClamped}px)`,
          pointerEvents: 'none'
        }}
      />
      <div className="adjust-btn-overlay">
        <button className="adjust-btn-action" onClick={(e) => { e.stopPropagation(); onAdjustClick(); }}>
          Adjust
        </button>
        <button className="adjust-btn-action reset" onClick={(e) => { e.stopPropagation(); onResetClick(); }}>
          Reset
        </button>
      </div>
    </div>
  );
};

const InteractivePhotoAdjust = ({ photo, slotW, slotH, onChange }) => {
  const [zoom, setZoom] = useState(photo.crop?.zoom || 1.0);
  const [offsetXRatio, setOffsetXRatio] = useState(photo.crop?.offsetXRatio || 0.0);
  const [offsetYRatio, setOffsetYRatio] = useState(photo.crop?.offsetYRatio || 0.0);

  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 0, y: 0 });

  const isPinching = useRef(false);
  const startPinchDist = useRef(0);
  const startPinchZoom = useRef(1.0);

  // Keep a ref to the latest values to avoid stale closures in event listeners
  const stateRef = useRef({ zoom, offsetXRatio, offsetYRatio });
  useEffect(() => {
    stateRef.current = { zoom, offsetXRatio, offsetYRatio };
  }, [zoom, offsetXRatio, offsetYRatio]);

  const { w, h, offsetXClamped, offsetYClamped } = calculateCropTransform(
    photo.width,
    photo.height,
    slotW,
    slotH,
    { zoom, offsetXRatio, offsetYRatio }
  );

  const handleMouseDown = (e) => {
    e.preventDefault();
    isDragging.current = true;
    startDragPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { x: stateRef.current.offsetXRatio * slotW, y: stateRef.current.offsetYRatio * slotH };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    const dx = e.clientX - startDragPos.current.x;
    const dy = e.clientY - startDragPos.current.y;

    const newOffsetX = startOffset.current.x + dx;
    const newOffsetY = startOffset.current.y + dy;

    // Get bounds for current zoom
    const transform = calculateCropTransform(
      photo.width,
      photo.height,
      slotW,
      slotH,
      { zoom: stateRef.current.zoom, offsetXRatio: 0, offsetYRatio: 0 }
    );

    const clampedRatioX = Math.max(transform.minRatioX, Math.min(transform.maxRatioX, newOffsetX / slotW));
    const clampedRatioY = Math.max(transform.minRatioY, Math.min(transform.maxRatioY, newOffsetY / slotH));

    setOffsetXRatio(clampedRatioX);
    setOffsetYRatio(clampedRatioY);
    onChange({ zoom: stateRef.current.zoom, offsetXRatio: clampedRatioX, offsetYRatio: clampedRatioY });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomSpeed = 0.005;
    const delta = -e.deltaY * zoomSpeed;
    const newZoom = Math.max(1.0, Math.min(4.0, stateRef.current.zoom + delta));

    // Get bounds for new zoom
    const transform = calculateCropTransform(
      photo.width,
      photo.height,
      slotW,
      slotH,
      { zoom: newZoom, offsetXRatio: 0, offsetYRatio: 0 }
    );

    const clampedRatioX = Math.max(transform.minRatioX, Math.min(transform.maxRatioX, stateRef.current.offsetXRatio));
    const clampedRatioY = Math.max(transform.minRatioY, Math.min(transform.maxRatioY, stateRef.current.offsetYRatio));

    setZoom(newZoom);
    setOffsetXRatio(clampedRatioX);
    setOffsetYRatio(clampedRatioY);
    onChange({ zoom: newZoom, offsetXRatio: clampedRatioX, offsetYRatio: clampedRatioY });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      isDragging.current = true;
      isPinching.current = false;
      const touch = e.touches[0];
      startDragPos.current = { x: touch.clientX, y: touch.clientY };
      startOffset.current = { x: stateRef.current.offsetXRatio * slotW, y: stateRef.current.offsetYRatio * slotH };
    } else if (e.touches.length === 2) {
      isDragging.current = false;
      isPinching.current = true;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      startPinchDist.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      startPinchZoom.current = stateRef.current.zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging.current && e.touches.length === 1) {
      const touch = e.touches[0];
      const dx = touch.clientX - startDragPos.current.x;
      const dy = touch.clientY - startDragPos.current.y;

      const newOffsetX = startOffset.current.x + dx;
      const newOffsetY = startOffset.current.y + dy;

      const transform = calculateCropTransform(
        photo.width,
        photo.height,
        slotW,
        slotH,
        { zoom: stateRef.current.zoom, offsetXRatio: 0, offsetYRatio: 0 }
      );

      const clampedRatioX = Math.max(transform.minRatioX, Math.min(transform.maxRatioX, newOffsetX / slotW));
      const clampedRatioY = Math.max(transform.minRatioY, Math.min(transform.maxRatioY, newOffsetY / slotH));

      setOffsetXRatio(clampedRatioX);
      setOffsetYRatio(clampedRatioY);
      onChange({ zoom: stateRef.current.zoom, offsetXRatio: clampedRatioX, offsetYRatio: clampedRatioY });
    } else if (isPinching.current && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const factor = currentDist / startPinchDist.current;
      const newZoom = Math.max(1.0, Math.min(4.0, startPinchZoom.current * factor));

      const transform = calculateCropTransform(
        photo.width,
        photo.height,
        slotW,
        slotH,
        { zoom: newZoom, offsetXRatio: 0, offsetYRatio: 0 }
      );

      const clampedRatioX = Math.max(transform.minRatioX, Math.min(transform.maxRatioX, stateRef.current.offsetXRatio));
      const clampedRatioY = Math.max(transform.minRatioY, Math.min(transform.maxRatioY, stateRef.current.offsetYRatio));

      setZoom(newZoom);
      setOffsetXRatio(clampedRatioX);
      setOffsetYRatio(clampedRatioY);
      onChange({ zoom: newZoom, offsetXRatio: clampedRatioX, offsetYRatio: clampedRatioY });
    }
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    isPinching.current = false;
  };

  const handleDoubleClick = () => {
    setZoom(1.0);
    setOffsetXRatio(0.0);
    setOffsetYRatio(0.0);
    onChange({ zoom: 1.0, offsetXRatio: 0.0, offsetYRatio: 0.0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onDoubleClick={handleDoubleClick}
      style={{
        width: `${slotW}px`,
        height: `${slotH}px`,
        overflow: 'hidden',
        position: 'relative',
        cursor: isDragging.current ? 'grabbing' : 'grab',
        backgroundColor: '#000',
        borderRadius: '8px',
        border: '2px solid var(--color-gold)',
        touchAction: 'none'
      }}
    >
      <img
        src={photo.src}
        alt="Adjust crop"
        draggable={false}
        style={{
          width: `${w}px`,
          height: `${h}px`,
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: `translate(-50%, -50%) translate(${offsetXClamped}px, ${offsetYClamped}px)`,
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
    </div>
  );
};

export default CameraCapture;

