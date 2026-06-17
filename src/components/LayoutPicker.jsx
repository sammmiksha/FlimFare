import React from 'react';
import { audioManager } from '../utils/audioManager';

const LayoutPicker = ({ onSelectLayout }) => {
  const handleSelect = (layout) => {
    // Unlock iOS Safari Web Audio API context on first user tap
    audioManager.init();
    
    // Pass selection up
    onSelectLayout(layout);
  };

  return (
    <div className="picker-container">
      <div className="picker-intro">
        <h2>Enter the Booth</h2>
        <p>Choose your retro template layout to begin. All processing happens 100% privately in your browser.</p>
      </div>

      <div className="picker-options">
        <div className="picker-card" onClick={() => handleSelect('single')}>
          <div className="polaroid-preview-mock">
            <div className="polaroid-preview-inner"></div>
          </div>
          <div className="picker-card-title">Polaroid Box</div>
          <div className="picker-card-desc">1:1 Classic Polaroid Frame with a bottom chin</div>
        </div>

        <div className="picker-card" onClick={() => handleSelect('strip')}>
          <div className="strip-preview-mock">
            <div className="strip-preview-inner"></div>
            <div className="strip-preview-inner"></div>
            <div className="strip-preview-inner"></div>
          </div>
          <div className="picker-card-title">3-Photo Strip</div>
          <div className="picker-card-desc">1:3 Traditional vertical film strip template</div>
        </div>
      </div>
    </div>
  );
};

export default LayoutPicker;
