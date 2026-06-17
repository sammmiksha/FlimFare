import React from 'react';

const CurtainWrapper = ({ isOpen, onEnter, children }) => {
  return (
    <div className={`screen-wrapper ${isOpen ? 'curtains-open' : ''}`}>
      <div className="curtain-container">
        <div className="curtain-half curtain-left">
          <div className="curtain-gold-trim"></div>
        </div>
        <div className="curtain-half curtain-right">
          <div className="curtain-gold-trim"></div>
        </div>
      </div>
      
      {!isOpen && (
        <div className="curtain-enter-overlay">
          <button className="curtain-enter-btn" onClick={onEnter}>
            ENTER BOOTH
          </button>
        </div>
      )}

      {children}
    </div>
  );
};

export default CurtainWrapper;
