import React, { useEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Type, Sparkles, Smile, Trash2, ArrowLeft, ArrowRight } from 'lucide-react';

const EditorStudio = ({ layout, photos, onBack, onGeneratePrint }) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [activeTab, setActiveTab] = useState('filters');
  const [activeFilter, setActiveFilter] = useState('none');
  
  // Object limits tracking
  const [stickerCount, setStickerCount] = useState(0);
  const [textCount, setTextCount] = useState(0);
  const [hasSelection, setHasSelection] = useState(false);

  const MAX_STICKERS = 20;
  const MAX_TEXTS = 10;

  // Viewport dimensions
  const canvasConfig = {
    single: { width: 340, height: 400, bg: '#ffffff' },
    strip: { width: 200, height: 500, bg: '#111111' }
  };

  useEffect(() => {
    // 1. Initialize Fabric Canvas
    const currentConfig = canvasConfig[layout];
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: currentConfig.width,
      height: currentConfig.height,
      backgroundColor: currentConfig.bg,
      allowTouchScrolling: false // Prevent page scrolling/bouncing on mobile touch
    });

    fabricCanvasRef.current = canvas;

    // Set selection handlers to toggle the delete button
    canvas.on('selection:created', () => setHasSelection(true));
    canvas.on('selection:updated', () => setHasSelection(true));
    canvas.on('selection:cleared', () => setHasSelection(false));
    canvas.on('object:added', updateObjectCounts);
    canvas.on('object:removed', updateObjectCounts);

    // 2. Render layout frames and insert photos
    setupTemplateAndPhotos(canvas);

    // Cleanup on unmount
    return () => {
      canvas.dispose();
    };
  }, []);

  const updateObjectCounts = () => {
    if (!fabricCanvasRef.current) return;
    const objs = fabricCanvasRef.current.getObjects();
    
    // Stickers are shapes/emojis that are selectable
    const stickers = objs.filter(obj => (obj.type === 'path' || obj.type === 'image' || obj.type === 'text') && obj.selectable && !obj.isTextLayer);
    const texts = objs.filter(obj => obj.selectable && obj.isTextLayer);

    setStickerCount(stickers.length);
    setTextCount(texts.length);
  };

  const setupTemplateAndPhotos = (canvas) => {
    const ImageClass = fabric.FabricImage || fabric.Image;

    if (layout === 'single') {
      // Polaroid structure
      // Draw a grey placeholder rect first
      const photoPlaceholder = new fabric.Rect({
        left: 20,
        top: 20,
        width: 300,
        height: 300,
        fill: '#f0ede9',
        selectable: false,
        evented: false,
        hoverCursor: 'default'
      });
      canvas.add(photoPlaceholder);

      // Load 1st snapped photo
      if (photos[0]) {
        const imgElement = document.createElement('img');
        imgElement.src = photos[0];
        imgElement.onload = () => {
          const photoImg = new ImageClass(imgElement, {
            left: 20,
            top: 20,
            selectable: false,
            evented: false,
            hoverCursor: 'default',
            isPhotoLayer: true // Custom tag for applying filters
          });
          // Fit photo in 300x300 slot
          photoImg.scaleX = 300 / imgElement.naturalWidth;
          photoImg.scaleY = 300 / imgElement.naturalHeight;
          canvas.add(photoImg);
          // Bring borders to front
          drawPolaroidBorders(canvas);
          canvas.renderAll();
        };
      } else {
        drawPolaroidBorders(canvas);
      }

    } else if (layout === 'strip') {
      // Film strip layout slots
      const gap = 15;
      const boxHeight = 140;
      const boxWidth = 170;

      // Draw background placeholders
      for (let i = 0; i < 3; i++) {
        const placeholder = new fabric.Rect({
          left: 15,
          top: gap + i * (boxHeight + gap),
          width: boxWidth,
          height: boxHeight,
          fill: '#1a1a1c',
          selectable: false,
          evented: false,
          hoverCursor: 'default'
        });
        canvas.add(placeholder);

        // Load photo for this index
        if (photos[i]) {
          const imgElement = document.createElement('img');
          imgElement.src = photos[i];
          const currentTop = gap + i * (boxHeight + gap);
          
          imgElement.onload = () => {
            const photoImg = new ImageClass(imgElement, {
              left: 15,
              top: currentTop,
              selectable: false,
              evented: false,
              hoverCursor: 'default',
              isPhotoLayer: true // Tag for filters
            });
            photoImg.scaleX = boxWidth / imgElement.naturalWidth;
            photoImg.scaleY = boxHeight / imgElement.naturalHeight;
            canvas.add(photoImg);
            canvas.renderAll();
          };
        }
      }
    }
  };

  const drawPolaroidBorders = (canvas) => {
    // Polaroid border is simply white border on top, but we can just draw lines to simulate the crop borders if needed,
    // or since background is white, we draw a thin divider line between photos and chin
    const line = new fabric.Line([20, 320, 320, 320], {
      stroke: '#eaeaea',
      strokeWidth: 1,
      selectable: false,
      evented: false
    });
    canvas.add(line);
  };

  // 3. Filter Applicator
  const applyFilter = (filterName) => {
    if (!fabricCanvasRef.current) return;
    setActiveFilter(filterName);

    const canvas = fabricCanvasRef.current;
    const objects = canvas.getObjects();
    const photoLayers = objects.filter(obj => obj.isPhotoLayer);

    photoLayers.forEach(photoObj => {
      photoObj.filters = []; // clear current filters

      if (filterName === 'noir') {
        photoObj.filters.push(new (fabric.filters.Grayscale || fabric.Image.filters.Grayscale)());
      } else if (filterName === 'sepia') {
        photoObj.filters.push(new (fabric.filters.Sepia || fabric.Image.filters.Sepia)());
      } else if (filterName === 'cyberpunk') {
        const ContrastClass = fabric.filters.Contrast || fabric.Image.filters.Contrast;
        const BlendColorClass = fabric.filters.BlendColor || fabric.Image.filters.BlendColor;
        photoObj.filters.push(new ContrastClass({ contrast: 0.25 }));
        photoObj.filters.push(new BlendColorClass({ color: '#00ffff', mode: 'overlay', alpha: 0.25 }));
      } else if (filterName === 'pastel') {
        const BrightnessClass = fabric.filters.Brightness || fabric.Image.filters.Brightness;
        const ContrastClass = fabric.filters.Contrast || fabric.Image.filters.Contrast;
        photoObj.filters.push(new BrightnessClass({ brightness: 0.15 }));
        photoObj.filters.push(new ContrastClass({ contrast: -0.1 }));
      }

      photoObj.applyFilters();
    });

    canvas.renderAll();
  };

  // 4. Sticker Adder
  const addVectorSticker = (pathString, fillColor) => {
    if (!fabricCanvasRef.current) return;
    if (stickerCount >= MAX_STICKERS) {
      alert(`Sticker limit reached (${MAX_STICKERS} max for mobile performance).`);
      return;
    }

    const canvas = fabricCanvasRef.current;
    const path = new fabric.Path(pathString, {
      fill: fillColor,
      stroke: '#ffffff',
      strokeWidth: 1.5,
      left: canvas.width / 2 - 25,
      top: canvas.height / 2 - 25,
      cornerColor: 'var(--color-gold)',
      cornerSize: 8,
      transparentCorners: false
    });

    // Make it touch friendly
    path.scaleToWidth(50);
    canvas.add(path);
    canvas.setActiveObject(path);
    canvas.renderAll();
  };

  const addEmojiSticker = (emoji) => {
    if (!fabricCanvasRef.current) return;
    if (stickerCount >= MAX_STICKERS) {
      alert(`Sticker limit reached (${MAX_STICKERS} max for mobile performance).`);
      return;
    }

    const canvas = fabricCanvasRef.current;
    const text = new fabric.IText(emoji, {
      left: canvas.width / 2 - 20,
      top: canvas.height / 2 - 20,
      fontSize: 40,
      cornerColor: 'var(--color-gold)',
      cornerSize: 8,
      transparentCorners: false
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  // 5. Text Layer Adder
  const addTextLayer = (fontName) => {
    if (!fabricCanvasRef.current) return;
    if (textCount >= MAX_TEXTS) {
      alert(`Text layer limit reached (${MAX_TEXTS} max for mobile performance).`);
      return;
    }

    const canvas = fabricCanvasRef.current;
    
    // Set text top/chin depending on layout
    const textTop = layout === 'single' ? 340 : 468;
    const textLeft = layout === 'single' ? 50 : 25;
    const textColor = layout === 'single' ? '#000000' : '#ffffff';

    const text = new fabric.IText('Tap to type', {
      left: textLeft,
      top: textTop,
      fontFamily: fontName,
      fontSize: 20,
      fill: textColor,
      isTextLayer: true, // Tag to count text layers
      cornerColor: 'var(--color-gold)',
      cornerSize: 8,
      transparentCorners: false
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  };

  // 6. Delete Action
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

  // Trigger download
  const handleGenerate = () => {
    if (!fabricCanvasRef.current) return;
    
    // Deselect active object so bounding boxes don't render in print
    fabricCanvasRef.current.discardActiveObject();
    fabricCanvasRef.current.renderAll();

    onGeneratePrint(fabricCanvasRef.current);
  };

  // Vector Path Constants
  const PATHS = {
    sparkle: 'M 0 -20 L 5 -5 L 20 0 L 5 5 L 0 20 L -5 5 L -20 0 L -5 -5 Z',
    flare: 'M 0 -20 Q 0 0 -20 0 Q 0 0 0 20 Q 0 0 20 0 Q 0 0 0 -20 Z',
    heart: 'M 0 -12 C -6 -18, -18 -12, -18 -4 C -18 6, 0 16, 0 20 C 0 16, 18 6, 18 -4 C 18 -12, 6 -18, 0 -12 Z',
    star: 'M 0 -15 L 4 -4 L 15 -4 L 7 3 L 10 14 L 0 8 L -10 14 L -7 3 L -15 -4 L -4 -4 Z'
  };

  return (
    <div className="studio-container">
      {/* Object count alerts */}
      <div className={`object-count-pill ${(stickerCount >= MAX_STICKERS || textCount >= MAX_TEXTS) ? 'warning' : ''}`}>
        Stickers: {stickerCount}/{MAX_STICKERS} | Texts: {textCount}/{MAX_TEXTS}
      </div>

      {/* Editor Stage */}
      <div className="studio-stage">
        <div className="canvas-box-shadow-wrapper">
          <canvas ref={canvasRef} />
        </div>
      </div>

      {/* Bottom Tool Panels */}
      <div className="studio-bottom-bar">
        {/* Tabs switcher */}
        <div className="studio-tabs">
          <button 
            className={`studio-tab-btn ${activeTab === 'filters' ? 'active' : ''}`}
            onClick={() => setActiveTab('filters')}
          >
            <Sparkles size={18} />
            <span>Filters</span>
          </button>
          
          <button 
            className={`studio-tab-btn ${activeTab === 'stickers' ? 'active' : ''}`}
            onClick={() => setActiveTab('stickers')}
          >
            <Smile size={18} />
            <span>Stickers</span>
          </button>

          <button 
            className={`studio-tab-btn ${activeTab === 'text' ? 'active' : ''}`}
            onClick={() => setActiveTab('text')}
          >
            <Type size={18} />
            <span>Text</span>
          </button>
        </div>

        {/* Tab Traies */}
        <div className="studio-tray custom-scrollbar">
          {activeTab === 'filters' && (
            <>
              <div className={`filter-card ${activeFilter === 'none' ? 'active' : ''}`} onClick={() => applyFilter('none')}>
                <div className="filter-preview-circle" style={{ background: '#555' }}></div>
                <div className="filter-name">Normal</div>
              </div>
              <div className={`filter-card ${activeFilter === 'sepia' ? 'active' : ''}`} onClick={() => applyFilter('sepia')}>
                <div className="filter-preview-circle" style={{ background: '#704214' }}></div>
                <div className="filter-name">Vintage</div>
              </div>
              <div className={`filter-card ${activeFilter === 'noir' ? 'active' : ''}`} onClick={() => applyFilter('noir')}>
                <div className="filter-preview-circle" style={{ background: '#222' }}></div>
                <div className="filter-name">Noir</div>
              </div>
              <div className={`filter-card ${activeFilter === 'cyberpunk' ? 'active' : ''}`} onClick={() => applyFilter('cyberpunk')}>
                <div className="filter-preview-circle" style={{ background: 'linear-gradient(45deg, #00ffff, #ff00ff)' }}></div>
                <div className="filter-name">Cyber</div>
              </div>
              <div className={`filter-card ${activeFilter === 'pastel' ? 'active' : ''}`} onClick={() => applyFilter('pastel')}>
                <div className="filter-preview-circle" style={{ background: '#ffe4e1' }}></div>
                <div className="filter-name">Pastel</div>
              </div>
            </>
          )}

          {activeTab === 'stickers' && (
            <>
              {/* Vector path shapes */}
              <div className="sticker-card" onClick={() => addVectorSticker(PATHS.sparkle, '#ffcc00')} style={{ color: '#ffcc00' }}>✨</div>
              <div className="sticker-card" onClick={() => addVectorSticker(PATHS.flare, '#ff4757')} style={{ color: '#ff4757' }}>💖</div>
              <div className="sticker-card" onClick={() => addVectorSticker(PATHS.star, '#00ffff')} style={{ color: '#00ffff' }}>⭐</div>
              <div className="sticker-card" onClick={() => addVectorSticker(PATHS.heart, '#ff7675')} style={{ color: '#ff7675' }}>❤️</div>
              
              {/* Emojis */}
              <div className="sticker-card" onClick={() => addEmojiSticker('🕶️')}>🕶️</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('👑')}>👑</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🎀')}>🎀</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🌸')}>🌸</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🍒')}>🍒</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🦄')}>🦄</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🎉')}>🎉</div>
              <div className="sticker-card" onClick={() => addEmojiSticker('🍀')}>🍀</div>
            </>
          )}

          {activeTab === 'text' && (
            <>
              <div className="text-font-card" onClick={() => addTextLayer('Caveat')}>
                <div className="text-font-name" style={{ fontFamily: 'Caveat', fontSize: '1.1rem' }}>Handwriting</div>
              </div>
              <div className="text-font-card" onClick={() => addTextLayer('Courier Prime')}>
                <div className="text-font-name" style={{ fontFamily: 'Courier Prime' }}>Typewriter</div>
              </div>
              <div className="text-font-card" onClick={() => addTextLayer('Outfit')}>
                <div className="text-font-name" style={{ fontFamily: 'Outfit' }}>Modern Bold</div>
              </div>
            </>
          )}
        </div>

        {/* Action bar */}
        <div className="studio-actions-bar">
          <button className="btn-outline" onClick={onBack} style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
            <ArrowLeft size={18} />
            <span>Retake</span>
          </button>
          
          {hasSelection && (
            <button className="btn-outline" onClick={deleteSelected} style={{ borderColor: '#ff4757', color: '#ff4757', display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center' }}>
              <Trash2 size={18} />
              <span>Delete</span>
            </button>
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
