import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Type, Sparkles, Smile, Palette, Trash2, ArrowLeft, ArrowRight, Plus, X, RotateCw } from 'lucide-react';
import { getCustomStickers, addCustomSticker, deleteCustomSticker } from '../utils/stickerStore';
import { LAYOUTS } from '../utils/layoutConfig';
import { calculateCropTransform } from '../utils/cropHelper';

// Vite dynamic glob import of all stickers inside src/assets/
const stickerModules = import.meta.glob('../assets/*.png', { eager: true });
const EXCLUDED_IMAGES = ['hero', 'tornpaper'];
const ASSET_STICKERS = Object.keys(stickerModules)
  .filter((key) => {
    const filename = key.split('/').pop().toLowerCase();
    return !EXCLUDED_IMAGES.some(ex => filename.includes(ex));
  })
  .map((key) => {
    return stickerModules[key].default || stickerModules[key];
  });

const generateRetroDateSticker = () => {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const stampString = `'${yy}  ${mm}  ${dd}`;

  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 24px "Courier Prime", "Courier New", Courier, monospace';
  ctx.fillStyle = '#ff6600'; // retro orange
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(stampString, canvas.width / 2, canvas.height / 2);

  return canvas.toDataURL('image/png');
};

const EditorStudio = ({ layout, photos, onBack, onGeneratePrint }) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [activeTab, setActiveTab] = useState(layout === 'digicam' ? 'filters' : 'themes');
  const [activeFilter, setActiveFilter] = useState('none');
  
  // Dynamic layout configuration
  const layoutCfg = LAYOUTS[layout] || LAYOUTS.single;

  const [zoomLevel, setZoomLevel] = useState(1.0);

  const handleResetZoom = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
    canvas.setZoom(1.0);
    setZoomLevel(1.0);
    canvas.requestRenderAll();
  };

  // Custom stickers state
  const [customStickers, setCustomStickers] = useState([]);
  const customStickerInputRef = useRef(null);
  const [retroDateSticker, setRetroDateSticker] = useState('');

  useEffect(() => {
    setRetroDateSticker(generateRetroDateSticker());
  }, []);

  // Load custom stickers from IndexedDB on mount
  useEffect(() => {
    const loadCustomStickers = async () => {
      const stickers = await getCustomStickers();
      setCustomStickers(stickers);
    };
    loadCustomStickers();
  }, []);

  const handleCustomStickerUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (.png, .jpg, etc).');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const dataUrl = event.target.result;
        const newSticker = await addCustomSticker(dataUrl, file.name);
        setCustomStickers(prev => [newSticker, ...prev]);
        
        // Auto-enter placement mode for the new custom sticker upon upload
        setPlacementMode({ type: 'sticker', stickerUrl: dataUrl });
      } catch (err) {
        console.error('Error saving sticker:', err);
        alert('Failed to save sticker in database.');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleDeleteCustomSticker = async (e, id) => {
    e.stopPropagation(); // Stop click from placing the sticker
    if (!confirm('Are you sure you want to delete this custom sticker?')) return;
    try {
      await deleteCustomSticker(id);
      setCustomStickers(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Error deleting sticker:', err);
      alert('Failed to delete sticker.');
    }
  };
  
  // Custom caption state
  const defaultCaption = () => {
    const d = new Date();
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };
  const [caption, setCaption] = useState(defaultCaption());

  // Simplified Frame themes list
  const FRAME_THEMES = [
    { id: 'white', name: 'Classic White', bg: '#ffffff', text: '#111111' },
    { id: 'cream', name: 'Vintage Cream', bg: '#fcfbe3', text: '#3d1c02' },
    { id: 'pink', name: 'Pink Kawaii', bg: '#ffd6ea', text: '#d81b60' },
    { id: 'black', name: 'Black Film Roll', bg: '#111111', text: '#ffffff' }
  ];

  // Default to Black theme if the template background is black (like strip5)
  const defaultTheme = () => {
    if (layoutCfg.defaultBg === '#111111') {
      return FRAME_THEMES.find(t => t.id === 'black') || FRAME_THEMES[3];
    }
    return FRAME_THEMES[0];
  };

  const [activeTheme, setActiveTheme] = useState(defaultTheme());

  // Object limits tracking
  const [stickerCount, setStickerCount] = useState(0);
  const [textCount, setTextCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);

  // Active object adjustments states
  const [activeTextObj, setActiveTextObj] = useState(null);
  const [textEditorVal, setTextEditorVal] = useState('');

  const MAX_STICKERS = layoutCfg.maxStickers;
  const MAX_TEXTS = layoutCfg.maxTexts;

  const [placementMode, setPlacementMode] = useState(null);
  const placementModeRef = useRef(null);

  useEffect(() => {
    placementModeRef.current = placementMode;
  }, [placementMode]);

  const layoutCfgRef = useRef(layoutCfg);
  useEffect(() => {
    layoutCfgRef.current = layoutCfg;
  }, [layoutCfg]);

  const activeThemeRef = useRef(activeTheme);
  useEffect(() => {
    activeThemeRef.current = activeTheme;
  }, [activeTheme]);

  const refreshCanvasZOrder = (canvas) => {
    if (!canvas) return;
    const allObjects = canvas.getObjects();
    
    const photos = [];
    const overlays = [];
    const stickers = [];
    const texts = [];
    const others = [];

    allObjects.forEach(obj => {
      if (obj.isPhotoLayer) {
        photos.push(obj);
      } else if (
        obj.isOverlayLayer || 
        obj.tag === 'brandingCaption' || 
        obj.stroke === 'rgba(0,0,0,0.06)' || 
        obj.rx === 2
      ) {
        overlays.push(obj);
      } else if (obj.isTextLayer) {
        texts.push(obj);
      } else if (obj.selectable) {
        stickers.push(obj);
      } else {
        others.push(obj);
      }
    });

    const sorted = [...photos, ...overlays, ...stickers, ...texts, ...others];
    
    sorted.forEach((obj, idx) => {
      canvas.moveObjectTo(obj, idx);
    });
  };

  const insertStickerAt = (canvas, url, x, y) => {
    const objs = canvas.getObjects();
    const currentStickers = objs.filter(obj => obj.selectable && !obj.isTextLayer);
    if (currentStickers.length >= layoutCfgRef.current.maxStickers) {
      alert(`Sticker limit reached (${layoutCfgRef.current.maxStickers} max).`);
      return;
    }

    const imgEl = new Image();
    imgEl.src = url;
    imgEl.onload = () => {
      const ImageClass = fabric.FabricImage || fabric.Image;
      const fabricImg = new ImageClass(imgEl, {
        left: x - 40,
        top: y - 40,
        cornerColor: 'var(--color-gold)',
        cornerSize: 14,
        transparentCorners: false,
        rotatingPointOffset: 25,
        isUserSticker: true
      });
      fabricImg.scaleToWidth(80);
      canvas.add(fabricImg);
      
      refreshCanvasZOrder(canvas);
      canvas.setActiveObject(fabricImg);
      canvas.renderAll();
      
      updateObjectCounts();
    };
  };

  const insertTextAt = (canvas, fontFamily, x, y) => {
    const objs = canvas.getObjects();
    const currentTexts = objs.filter(obj => obj.selectable && obj.isTextLayer);
    if (currentTexts.length >= layoutCfgRef.current.maxTexts) {
      alert(`Text layer limit reached (${layoutCfgRef.current.maxTexts} max).`);
      return;
    }

    const textColor = activeThemeRef.current.id === 'black' ? '#ffffff' : '#000000';

    const text = new fabric.IText('Tap to type', {
      left: x - 50,
      top: y - 15,
      fontFamily: fontFamily,
      fontSize: 24,
      fill: textColor,
      isTextLayer: true,
      isUserText: true,
      padding: 12,
      cornerColor: 'var(--color-gold)',
      cornerSize: 14,
      transparentCorners: false,
      rotatingPointOffset: 25
    });

    canvas.add(text);
    
    refreshCanvasZOrder(canvas);
    canvas.setActiveObject(text);
    canvas.renderAll();
    
    updateObjectCounts();
  };



  const handleTextEditorChange = (e) => {
    const val = e.target.value;
    setTextEditorVal(val);
    if (!fabricCanvasRef.current || !activeTextObj) return;
    const canvas = fabricCanvasRef.current;
    
    activeTextObj.set({ text: val });
    canvas.renderAll();
  };

  useEffect(() => {
    // 1. Initialize Fabric Canvas dynamically based on layout config
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: layoutCfg.canvasWidth,
      height: layoutCfg.canvasHeight,
      backgroundColor: layout === 'digicam' ? null : activeTheme.bg,
      allowTouchScrolling: true,
      preserveObjectStacking: true, // Keep object layering order during selection
      enableRetinaScaling: false // Prevent device pixel ratio/Retina clipping and offset issues
    });

    fabricCanvasRef.current = canvas;

    // Selection handlers
    const handleSelection = () => {
      const activeObj = canvas.getActiveObject();
      setHasSelection(!!activeObj);
      
      if (activeObj && activeObj.isTextLayer) {
        setActiveTextObj(activeObj);
        setTextEditorVal(activeObj.text);
      } else {
        setActiveTextObj(null);
        setTextEditorVal('');
      }
    };

    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleSelection);
    canvas.on('object:added', updateObjectCounts);
    canvas.on('object:removed', updateObjectCounts);

    canvas.on('text:changed', (opt) => {
      const target = opt.target;
      if (target && target.isTextLayer) {
        setTextEditorVal(target.text);
      }
    });

    // 2. Render layout frames, photos, date stamps, and captions
    setupWorkspace(canvas);

    // 3. PC Keyboard Spacebar Panning & Mouse Wheel Zoom
    let spacePressed = false;
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        spacePressed = true;
        canvas.defaultCursor = 'grab';
        canvas.hoverCursor = 'grab';
        e.preventDefault();
      }
      if (e.key === 'Escape') {
        setPlacementMode(null);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space') {
        spacePressed = false;
        canvas.defaultCursor = placementModeRef.current ? 'crosshair' : 'default';
        canvas.hoverCursor = placementModeRef.current ? 'crosshair' : 'move';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    canvas.on('mouse:down', (opt) => {
      if (placementModeRef.current) {
        const mode = placementModeRef.current;
        const pointer = opt.scenePoint;
        
        // Bounds checking
        if (
          pointer.x >= 0 &&
          pointer.x <= canvas.width &&
          pointer.y >= 0 &&
          pointer.y <= canvas.height
        ) {
          opt.e.preventDefault();
          opt.e.stopPropagation();

          // synchronous reset of placement state/ref to prevent touch duplication
          setPlacementMode(null);
          placementModeRef.current = null;

          if (mode.type === 'sticker') {
            insertStickerAt(canvas, mode.stickerUrl, pointer.x, pointer.y);
          } else if (mode.type === 'text') {
            insertTextAt(canvas, mode.fontFamily, pointer.x, pointer.y);
          }
        }
        return;
      }

      const evt = opt.e;
      // Allow panning with space pressed, middle mouse button
      if (spacePressed || evt.button === 1) {
        isPanning = true;
        canvas.defaultCursor = 'grabbing';
        canvas.hoverCursor = 'grabbing';
        lastX = evt.clientX || (evt.touches && evt.touches[0].clientX);
        lastY = evt.clientY || (evt.touches && evt.touches[0].clientY);
      }
    });

    canvas.on('mouse:move', (opt) => {
      if (isPanning) {
        const evt = opt.e;
        const clientX = evt.clientX || (evt.touches && evt.touches[0].clientX);
        const clientY = evt.clientY || (evt.touches && evt.touches[0].clientY);
        const vpt = canvas.viewportTransform;
        
        vpt[4] += clientX - lastX;
        vpt[5] += clientY - lastY;
        
        canvas.requestRenderAll();
        lastX = clientX;
        lastY = clientY;
      }
    });

    canvas.on('mouse:up', () => {
      if (isPanning) {
        isPanning = false;
        canvas.defaultCursor = spacePressed ? 'grab' : 'default';
        canvas.hoverCursor = 'move';
      }
    });

    canvas.on('mouse:wheel', (opt) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 4) zoom = 4;
      if (zoom < 1) {
        zoom = 1;
        canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
      } else {
        canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
      }
      setZoomLevel(zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // 4. Mobile Two-Finger Pinch-to-Zoom & Drag-to-Pan
    let lastPinchDist = 0;
    let isPinching = false;
    let touchStartZoom = 1;
    let touchStartCenter = { x: 0, y: 0 };
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isTouchPanning = false;

    const getDistance = (t1, t2) => {
      return Math.sqrt((t1.clientX - t2.clientX) ** 2 + (t1.clientY - t2.clientY) ** 2);
    };

    const getCenter = (t1, t2) => {
      return {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2
      };
    };

    const nativeCanvas = canvasRef.current;

    const handleTouchStart = (e) => {
      if (e.touches.length === 2) {
        isPinching = true;
        isTouchPanning = false;
        lastPinchDist = getDistance(e.touches[0], e.touches[1]);
        touchStartZoom = canvas.getZoom();
        const center = getCenter(e.touches[0], e.touches[1]);
        
        const rect = nativeCanvas.getBoundingClientRect();
        touchStartCenter = {
          x: center.x - rect.left,
          y: center.y - rect.top
        };
        e.preventDefault();
      } else if (e.touches.length === 1 && canvas.getZoom() > 1.0) {
        isTouchPanning = true;
        isPinching = false;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e) => {
      if (isPinching && e.touches.length === 2) {
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scale = dist / lastPinchDist;
        let zoom = touchStartZoom * scale;
        
        if (zoom > 4) zoom = 4;
        if (zoom < 1) {
          zoom = 1;
          canvas.setViewportTransform([1, 0, 0, 1, 0, 0]);
        } else {
          canvas.zoomToPoint(new fabric.Point(touchStartCenter.x, touchStartCenter.y), zoom);
        }
        
        setZoomLevel(zoom);
        canvas.requestRenderAll();
        e.preventDefault();
      } else if (isTouchPanning && e.touches.length === 1) {
        const touch = e.touches[0];
        const dx = touch.clientX - lastTouchX;
        const dy = touch.clientY - lastTouchY;
        const vpt = canvas.viewportTransform;
        
        vpt[4] += dx;
        vpt[5] += dy;
        
        canvas.requestRenderAll();
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
      if (e.touches.length === 0) {
        isTouchPanning = false;
      }
    };

    nativeCanvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    nativeCanvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    nativeCanvas.addEventListener('touchend', handleTouchEnd);

    // Cleanup on unmount
    return () => {
      nativeCanvas.removeEventListener('touchstart', handleTouchStart);
      nativeCanvas.removeEventListener('touchmove', handleTouchMove);
      nativeCanvas.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    if (placementMode) {
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }
    canvas.requestRenderAll();
  }, [placementMode]);

  const updateObjectCounts = () => {
    if (!fabricCanvasRef.current) return;
    const objs = fabricCanvasRef.current.getObjects();
    const stickers = objs.filter(obj => obj.selectable && !obj.isTextLayer);
    const texts = objs.filter(obj => obj.selectable && obj.isTextLayer);
    setStickerCount(stickers.length);
    setTextCount(texts.length);
  };

  const setupWorkspace = (canvas) => {
    const ImageClass = fabric.FabricImage || fabric.Image;

    // Helper function to load captured photo directly into Fabric workspace via static fromURL
    const addImageToSlot = (photo, slotX, slotY, slotWidth, slotHeight, callback) => {
      const ImageClass = fabric.FabricImage || fabric.Image;

      const src = typeof photo === 'string' ? photo : photo.src;
      const crop = typeof photo === 'object' && photo.crop ? photo.crop : { zoom: 1.0, offsetXRatio: 0.0, offsetYRatio: 0.0 };

      // Use Fabric's standard fromURL Promise loader (standard for Fabric v7)
      ImageClass.fromURL(src).then((photoImg) => {
        if (!fabricCanvasRef.current) return;

        const imgW = photoImg.width || 1;
        const imgH = photoImg.height || 1;

        const transform = calculateCropTransform(imgW, imgH, slotWidth, slotHeight, crop);

        photoImg.set({
          left: slotX,
          top: slotY,
          originX: 'left',
          originY: 'top',
          cropX: (transform.maxOffsetX - transform.offsetXClamped) / transform.s,
          cropY: (transform.maxOffsetY - transform.offsetYClamped) / transform.s,
          width: slotWidth / transform.s,
          height: slotHeight / transform.s,
          scaleX: transform.s,
          scaleY: transform.s,
          selectable: false, // Static layout photo
          evented: false,    // No selection/pan/zoom
          hoverCursor: 'default',
          isPhotoLayer: true
        });

        canvas.add(photoImg);
        if (callback) callback();
      }).catch((err) => {
        console.error('Error loading image in Fabric:', err);
        if (callback) callback();
      });
    };

    // Load photo slots dynamically from layoutConfig
    let completedSlots = 0;
    const totalExpected = layoutCfg.photoSlots.length;

    // Check if we need to draw a background camera overlay
    const loadOverlay = () => {
      if (layoutCfg.overlayImage) {
        ImageClass.fromURL(layoutCfg.overlayImage).then((overlayImg) => {
          if (!fabricCanvasRef.current) return;
          overlayImg.set({
            left: 0,
            top: 0,
            originX: 'left',
            originY: 'top',
            width: overlayImg.width || 1024,
            height: overlayImg.height || 1024,
            scaleX: layoutCfg.canvasWidth / (overlayImg.width || 1024),
            scaleY: layoutCfg.canvasHeight / (overlayImg.height || 1024),
            selectable: false,
            evented: false,
            hoverCursor: 'default',
            isOverlayLayer: true
          });
          canvas.add(overlayImg);
          
          if (layoutCfg.showCaption) {
            createCaptionText(canvas);
          }
          canvas.renderAll();
        }).catch((err) => {
          console.error('Failed to load layout overlay image:', err);
          if (layoutCfg.showCaption) {
            createCaptionText(canvas);
          }
          canvas.renderAll();
        });
      } else {
        if (layoutCfg.showCaption) {
          createCaptionText(canvas);
        }
        canvas.renderAll();
      }
    };

    // Draw layout specific decorations
    if (layout === 'single') {
      // Draw thin frame line between photo and chin
      const line = new fabric.Line([30, 310, 310, 310], {
        stroke: 'rgba(0,0,0,0.06)',
        strokeWidth: 1,
        selectable: false,
        evented: false
      });
      canvas.add(line);
    } else if (layoutCfg.drawSprocketHoles) {
      // Draw film strip sprocket holes dynamically down left and right borders!
      const sprocketWidth = 12;
      const sprocketHeight = 16;
      const gap = 30; // space sprocket holes every 30px
      const cornerRadius = 2;

      for (let y = 15; y < layoutCfg.canvasHeight - 15; y += gap) {
        // Left sprocket hole
        const leftHole = new fabric.Rect({
          left: 14,
          top: y,
          width: sprocketWidth,
          height: sprocketHeight,
          rx: cornerRadius,
          ry: cornerRadius,
          fill: '#ffffff',
          selectable: false,
          evented: false
        });
        // Right sprocket hole
        const rightHole = new fabric.Rect({
          left: layoutCfg.canvasWidth - 14 - sprocketWidth,
          top: y,
          width: sprocketWidth,
          height: sprocketHeight,
          rx: cornerRadius,
          ry: cornerRadius,
          fill: '#ffffff',
          selectable: false,
          evented: false
        });

        canvas.add(leftHole);
        canvas.add(rightHole);
      }
    }

    // Add captured/uploaded photos
    layoutCfg.photoSlots.forEach((slot, index) => {
      const photo = photos[index];
      if (photo) {
        addImageToSlot(photo, slot.left, slot.top, slot.width, slot.height, () => {
          if (!fabricCanvasRef.current) return;

          completedSlots += 1;
          if (completedSlots === totalExpected) {
            loadOverlay();
          }
        });
      } else {
        completedSlots += 1;
        if (completedSlots === totalExpected) {
          loadOverlay();
        }
      }
    });
  };

  // Create caption at the bottom chin
  const createCaptionText = (canvas) => {
    const topPos = layoutCfg.captionTop || 365;

    const capText = new fabric.Text(caption, {
      left: layoutCfg.canvasWidth / 2,
      top: topPos,
      fontFamily: 'Courier Prime',
      fontSize: 16,
      fontWeight: 'bold',
      fill: activeTheme.text,
      originX: 'center',
      selectable: false,
      evented: false,
      tag: 'brandingCaption'
    });

    canvas.add(capText);
  };

  // Theme selector
  const selectTheme = (theme) => {
    if (!fabricCanvasRef.current) return;
    setActiveTheme(theme);
    
    const canvas = fabricCanvasRef.current;
    canvas.backgroundColor = theme.bg;
    
    // Update caption text color
    const objs = canvas.getObjects();
    const captionObj = objs.find(obj => obj.tag === 'brandingCaption');
    if (captionObj) {
      captionObj.set({ fill: theme.text });
    }

    canvas.renderAll();
  };

  // Update caption text dynamically as user types
  const handleCaptionChange = (e) => {
    const val = e.target.value;
    setCaption(val);
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const captionObj = canvas.getObjects().find(obj => obj.tag === 'brandingCaption');
    if (captionObj) {
      captionObj.set({ text: val });
      canvas.renderAll();
    }
  };

  // Simplified Filters: Normal (Color) vs Vintage
  const applyFilter = (filterName) => {
    if (!fabricCanvasRef.current) return;
    setActiveFilter(filterName);

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    const photoLayers = objects.filter(obj => obj.isPhotoLayer);
    

    photoLayers.forEach(photoObj => {
      photoObj.filters = []; // clear current filters

      const SepiaClass = fabric.filters.Sepia || fabric.Image.filters.Sepia;
      const ContrastClass = fabric.filters.Contrast || fabric.Image.filters.Contrast;
      const BlendColorClass = fabric.filters.BlendColor || fabric.Image.filters.BlendColor;
      const GrayscaleClass = fabric.filters.Grayscale || fabric.Image.filters.Grayscale;

      if (filterName === 'vintage') {
        photoObj.filters.push(new SepiaClass());
        photoObj.filters.push(new ContrastClass({ contrast: -0.05 }));
        // Warm retro filter overlay
        photoObj.filters.push(new BlendColorClass({ color: '#ffcc00', mode: 'overlay', alpha: 0.12 }));
      } else if (filterName === 'mono') {
        if (GrayscaleClass) {
          photoObj.filters.push(new GrayscaleClass());
        }
      }

      photoObj.applyFilters();
    });

    canvas.renderAll();
  };



  // Delete selection
  const deleteSelected = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      canvas.remove(activeObj);
      canvas.discardActiveObject();
      canvas.renderAll();
    }
  };

  // Rotate selection by 15 degrees clockwise
  const rotateSelected = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;
    const activeObj = canvas.getActiveObject();
    if (activeObj) {
      const currentAngle = activeObj.angle || 0;
      activeObj.set({ angle: (currentAngle + 15) % 360 });
      canvas.renderAll();
    }
  };

  // Export high-DPI data URL (WYSIWYG - matches editor exactly)
  const handleGenerate = () => {
    if (!fabricCanvasRef.current) return;
    const canvas = fabricCanvasRef.current;

    // Deselect active object to clear guides
    canvas.discardActiveObject();
    canvas.renderAll();

    const multiplier = Math.min(window.devicePixelRatio || 2, 3);
    const highResDataUrl = canvas.toDataURL({
      format: 'png',
      quality: 1.0,
      multiplier: multiplier
    });

    onGeneratePrint(highResDataUrl);
  };

  return (
    <div className="studio-container">
      {/* Object limit tracker */}
      <div className={`object-count-pill ${(stickerCount >= MAX_STICKERS || textCount >= MAX_TEXTS) ? 'warning' : ''}`}>
        Stickers: {stickerCount}/{MAX_STICKERS} | Texts: {textCount}/{MAX_TEXTS}
      </div>

      {/* Editor Stage */}
      <div 
        className="studio-stage" 
        style={{ 
          position: 'relative',
          overflowY: (layout === 'strip' || layout === 'strip5') ? 'auto' : 'hidden',
          alignItems: (layout === 'strip' || layout === 'strip5') ? 'flex-start' : 'center',
          padding: (layout === 'strip' || layout === 'strip5') ? '24px 12px 60px 12px' : '12px'
        }}
      >
        {placementMode && (
          <div className="placement-banner">
            <span className="placement-banner-text">
              {placementMode.type === 'sticker' 
                ? '✨ Tap anywhere on the template to place sticker' 
                : '⌨️ Tap anywhere on the template to place text'}
            </span>
            <button className="placement-banner-close" onClick={() => setPlacementMode(null)}>
              <X size={16} />
            </button>
          </div>
        )}

        <div 
          className={`canvas-box-shadow-wrapper ${placementMode ? 'canvas-highlight-placement' : ''}`}
          style={{ 
            maxHeight: (layout === 'strip' || layout === 'strip5') ? 'none' : '72vh',
            backgroundColor: layout === 'digicam' ? 'transparent' : '#ffffff',
            boxShadow: layout === 'digicam' ? 'none' : (placementMode ? undefined : '0 12px 36px rgba(0, 0, 0, 0.6)')
          }}
        >
          <canvas ref={canvasRef} />
        </div>

        {/* Floating Reset Zoom Button overlay */}
        {zoomLevel > 1.02 && (
          <button 
            className="btn-outline"
            onClick={handleResetZoom}
            style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              padding: '6px 12px',
              fontSize: '0.75rem',
              borderRadius: '20px',
              backgroundColor: 'rgba(0,0,0,0.8)',
              color: 'var(--color-gold)',
              border: '1px solid var(--color-gold)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
              cursor: 'pointer',
              zIndex: 100,
              fontFamily: 'Outfit',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span>🔍 Reset Zoom</span>
          </button>
        )}
      </div>

      {/* Premium Bottom Sheet */}
      <div className="studio-bottom-bar">
        <div className="bottom-sheet-handle"></div>

        {/* Floating Active Selection Controls (Text Input) */}
        {activeTextObj && (
          <div className="selection-adjust-panel" style={{
            padding: '10px 16px',
            backgroundColor: 'rgba(28, 14, 5, 0.95)',
            borderBottom: '1px solid rgba(255, 204, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            width: '100%',
            boxSizing: 'border-box',
            justifyContent: 'space-between',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
              <span style={{ color: 'var(--color-gold)', fontWeight: 'bold', fontSize: '0.8rem', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: '0.5px' }}>✏️ Edit Text:</span>
              <input
                type="text"
                value={textEditorVal}
                onChange={handleTextEditorChange}
                placeholder="Type text..."
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,204,0,0.3)',
                  borderRadius: '16px',
                  padding: '6px 12px',
                  color: '#fff',
                  fontFamily: activeTextObj.fontFamily || 'Courier Prime',
                  fontSize: '0.85rem',
                  outline: 'none'
                }}
              />
            </div>
          </div>
        )}

        {/* Tab contents tray */}
        <div className="studio-tray custom-scrollbar" style={{ height: '85px' }}>
          {activeTab === 'themes' && (
            <>
              {FRAME_THEMES.map(theme => (
                <div 
                  key={theme.id}
                  className={`text-font-card ${activeTheme.id === theme.id ? 'active' : ''}`}
                  onClick={() => selectTheme(theme)}
                >
                  <div style={{ width: '20px', height: '20px', borderRadius: '50%', backgroundColor: theme.bg, border: '1px solid #ddd', marginBottom: '4px' }}></div>
                  <div className="text-font-name">{theme.name}</div>
                </div>
              ))}
            </>
          )}

          {activeTab === 'filters' && (
            <>
              <div className={`filter-card ${activeFilter === 'none' ? 'active' : ''}`} onClick={() => applyFilter('none')}>
                <div className="filter-preview-circle" style={{ background: '#555' }}></div>
                <div className="filter-name">Color (Normal)</div>
              </div>
              <div className={`filter-card ${activeFilter === 'vintage' ? 'active' : ''}`} onClick={() => applyFilter('vintage')}>
                <div className="filter-preview-circle" style={{ background: 'linear-gradient(45deg, #ff8800, #704214)' }}></div>
                <div className="filter-name">Vintage (Retro)</div>
              </div>
              <div className={`filter-card ${activeFilter === 'mono' ? 'active' : ''}`} onClick={() => applyFilter('mono')}>
                <div className="filter-preview-circle" style={{ background: 'linear-gradient(135deg, #000 0%, #888 50%, #fff 100%)' }}></div>
                <div className="filter-name">B&W (Noir)</div>
              </div>
            </>
          )}

          {activeTab === 'stickers' && (
            <>
              {/* Hidden file input for uploading custom PNG stickers */}
              <input
                type="file"
                ref={customStickerInputRef}
                onChange={handleCustomStickerUpload}
                accept="image/png, image/*.png"
                style={{ display: 'none' }}
              />

              {/* Add custom sticker picker button */}
              <div 
                className="sticker-card add-sticker-btn"
                onClick={() => customStickerInputRef.current?.click()}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px dashed var(--color-gold)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  minWidth: '55px',
                  height: '55px',
                  backgroundColor: 'rgba(255, 204, 0, 0.05)',
                  color: 'var(--color-gold)',
                  gap: '2px',
                  padding: '4px'
                }}
                title="Upload custom PNG sticker"
              >
                <Plus size={18} />
                <span style={{ fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Add</span>
              </div>

              {/* Render custom stickers loaded from IndexedDB */}
              {customStickers.map((sticker) => (
                <div 
                  key={sticker.id} 
                  className={`sticker-card ${placementMode?.type === 'sticker' && placementMode.stickerUrl === sticker.dataUrl ? 'active-placement' : ''}`}
                  onClick={() => setPlacementMode({ type: 'sticker', stickerUrl: sticker.dataUrl })}
                  style={{ overflow: 'hidden', padding: '2px', position: 'relative' }}
                  title={sticker.name}
                >
                  <img 
                    src={sticker.dataUrl} 
                    alt={sticker.name} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  <button
                    onClick={(e) => handleDeleteCustomSticker(e, sticker.id)}
                    style={{
                      position: 'absolute',
                      top: '1px',
                      right: '1px',
                      background: '#ff4757',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '50%',
                      width: '14px',
                      height: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                      padding: 0,
                      zIndex: 10
                    }}
                    title="Delete sticker"
                  >
                    <X size={9} />
                  </button>
                </div>
              ))}

              {/* Render optional retro date stamp sticker */}
              {retroDateSticker && (
                <div 
                  className={`sticker-card ${placementMode?.type === 'sticker' && placementMode.stickerUrl === retroDateSticker ? 'active-placement' : ''}`}
                  onClick={() => setPlacementMode({ type: 'sticker', stickerUrl: retroDateSticker })}
                  style={{ overflow: 'hidden', padding: '2px' }}
                  title="Retro Date Stamp"
                >
                  <img 
                    src={retroDateSticker} 
                    alt="Retro Date" 
                    style={{ width: '100%', height: '100%', objectFit: 'contain', background: 'rgba(255,255,255,0.05)' }}
                  />
                </div>
              )}

              {/* Render default premium stickers */}
              {ASSET_STICKERS.map((url, index) => {
                const filename = url.split('/').pop().split('.')[0] || `sticker-${index}`;
                return (
                  <div 
                    key={url} 
                    className={`sticker-card ${placementMode?.type === 'sticker' && placementMode.stickerUrl === url ? 'active-placement' : ''}`}
                    onClick={() => setPlacementMode({ type: 'sticker', stickerUrl: url })}
                    style={{ overflow: 'hidden', padding: '2px' }}
                    title={filename}
                  >
                    <img 
                      src={url} 
                      alt={filename} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>
                );
              })}
            </>
          )}

          {activeTab === 'text' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '0 8px' }}>
                <input
                  type="text"
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="Caption..."
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,204,0,0.3)',
                    borderRadius: '20px',
                    padding: '8px 16px',
                    color: '#fff',
                    fontFamily: 'Courier Prime',
                    fontSize: '0.85rem',
                    flex: 1,
                    outline: 'none'
                  }}
                />
                
                <div className={`text-font-card ${placementMode?.type === 'text' && placementMode.fontFamily === 'Pacifico' ? 'active-placement' : ''}`} onClick={() => setPlacementMode({ type: 'text', fontFamily: 'Pacifico' })} style={{ padding: '8px 16px' }}>
                  <span style={{ fontFamily: 'Pacifico', fontSize: '0.9rem' }}>✍️ Handwriting</span>
                </div>
                <div className={`text-font-card ${placementMode?.type === 'text' && placementMode.fontFamily === 'Courier Prime' ? 'active-placement' : ''}`} onClick={() => setPlacementMode({ type: 'text', fontFamily: 'Courier Prime' })} style={{ padding: '8px 16px' }}>
                  <span style={{ fontFamily: 'Courier Prime', fontSize: '0.9rem' }}>⌨️ Typewriter</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tab menu switcher */}
        <div className="studio-tabs">
          {layout !== 'digicam' && (
            <button className={`studio-tab-btn ${activeTab === 'themes' ? 'active' : ''}`} onClick={() => { setActiveTab('themes'); setPlacementMode(null); }}>
              <Palette size={18} />
              <span>Themes</span>
            </button>
          )}

          <button className={`studio-tab-btn ${activeTab === 'filters' ? 'active' : ''}`} onClick={() => { setActiveTab('filters'); setPlacementMode(null); }}>
            <Sparkles size={18} />
            <span>Filters</span>
          </button>
          
          <button className={`studio-tab-btn ${activeTab === 'stickers' ? 'active' : ''}`} onClick={() => { setActiveTab('stickers'); setPlacementMode(null); }}>
            <Smile size={18} />
            <span>Stickers</span>
          </button>

          <button className={`studio-tab-btn ${activeTab === 'text' ? 'active' : ''}`} onClick={() => { setActiveTab('text'); setPlacementMode(null); }}>
            <Type size={18} />
            <span>Text</span>
          </button>
        </div>

        {/* Studio bottom actions */}
        <div className="studio-actions-bar">
          <button className="btn-outline" onClick={onBack} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <ArrowLeft size={18} />
            <span>Retake</span>
          </button>
          
          {hasSelection && (
            <>
              <button className="btn-outline" onClick={rotateSelected} style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                <RotateCw size={18} />
                <span>Rotate</span>
              </button>
              <button className="btn-outline" onClick={deleteSelected} style={{ borderColor: '#ff4757', color: '#ff4757', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
            </>
          )}

          <button className="btn-gold" onClick={handleGenerate} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <span>Print</span>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditorStudio;
