import React from 'react';
import { audioManager } from '../utils/audioManager';
import { LAYOUTS } from '../utils/layoutConfig';

const LayoutPicker = ({ onSelectLayout }) => {
  const handleSelect = (layoutId) => {
    // Unlock iOS Safari Web Audio API context on first user tap
    audioManager.init();
    
    // Pass selection up
    onSelectLayout(layoutId);
  };

  const renderPreviewMock = (layoutId) => {
    switch (layoutId) {
      case 'single':
        return (
          <div className="polaroid-preview-mock">
            <div className="polaroid-preview-inner"></div>
          </div>
        );
      case 'digicam':
        return (
          <div className="digicam-preview-mock">
            <div className="digicam-preview-flash"></div>
            <div className="digicam-preview-lens"></div>
            <div className="digicam-preview-inner"></div>
          </div>
        );
      case 'strip':
        return (
          <div className="strip-preview-mock">
            <div className="strip-preview-inner"></div>
            <div className="strip-preview-inner"></div>
            <div className="strip-preview-inner"></div>
          </div>
        );
      case 'strip5':
        return (
          <div className="strip5-preview-mock">
            <div className="strip5-preview-sprockets-left">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="strip5-sprocket-hole" />)}
            </div>
            <div className="strip5-preview-inner-container">
              <div className="strip5-preview-inner"></div>
              <div className="strip5-preview-inner"></div>
              <div className="strip5-preview-inner"></div>
              <div className="strip5-preview-inner"></div>
              <div className="strip5-preview-inner"></div>
            </div>
            <div className="strip5-preview-sprockets-right">
              {Array.from({ length: 8 }).map((_, i) => <div key={i} className="strip5-sprocket-hole" />)}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="picker-container">
      <div className="picker-intro">
        <h2>Enter the Booth</h2>
        <p>Choose your retro template layout to begin. All processing happens 100% privately in your browser.</p>
      </div>

      <div className="picker-options">
        {Object.keys(LAYOUTS).map((layoutId) => {
          const cfg = LAYOUTS[layoutId];
          return (
            <div key={layoutId} className="picker-card" onClick={() => handleSelect(layoutId)}>
              <div className="picker-mock-wrapper">
                {renderPreviewMock(layoutId)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="picker-card-title">{cfg.name}</div>
                <div className="picker-card-desc">{cfg.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default LayoutPicker;
