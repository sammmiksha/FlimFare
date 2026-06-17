import React, { useState } from 'react';
import MarqueeHeader from './components/MarqueeHeader';
import CurtainWrapper from './components/CurtainWrapper';
import LayoutPicker from './components/LayoutPicker';
import CameraCapture from './components/CameraCapture';
import EditorStudio from './components/EditorStudio';
import LoadingExport from './components/LoadingExport';
import { audioManager } from './utils/audioManager';
import './App.css';

function App() {
  const [flowState, setFlowState] = useState('LANDING'); // LANDING, PICK_LAYOUT, CAPTURE, EDIT, EXPORT
  const [selectedLayout, setSelectedLayout] = useState('single'); // single, strip
  const [snappedPhotos, setSnappedPhotos] = useState([]);
  const [printUrl, setPrintUrl] = useState('');

  const handleEnterBooth = () => {
    // Unlock Web Audio API context on first user tap
    audioManager.init();
    audioManager.playCurtain();
    setFlowState('PICK_LAYOUT');
  };

  const handleSelectLayout = (layout) => {
    setSelectedLayout(layout);
    setFlowState('CAPTURE');
  };

  const handleCaptureComplete = (photos) => {
    setSnappedPhotos(photos);
    setFlowState('EDIT');
  };

  const handleBackToPicker = () => {
    setFlowState('PICK_LAYOUT');
  };

  const handleBackToCapture = () => {
    setFlowState('CAPTURE');
  };

  const handleGeneratePrint = (url) => {
    setPrintUrl(url);
    setFlowState('EXPORT');
  };

  const handleReset = () => {
    setSnappedPhotos([]);
    setPrintUrl('');
    audioManager.playCurtain();
    setFlowState('LANDING'); // Closes the curtains for the next session
  };

  return (
    <>
      {/* Immersive retro header sign */}
      <MarqueeHeader />

      {/* Main Studio Viewport */}
      <div style={styles.mainStage}>
        <CurtainWrapper isOpen={flowState !== 'LANDING'} onEnter={handleEnterBooth}>
          {flowState === 'PICK_LAYOUT' && (
            <LayoutPicker onSelectLayout={handleSelectLayout} />
          )}

          {flowState === 'CAPTURE' && (
            <CameraCapture
              layout={selectedLayout}
              onBack={handleBackToPicker}
              onComplete={handleCaptureComplete}
            />
          )}

          {flowState === 'EDIT' && (
            <EditorStudio
              layout={selectedLayout}
              photos={snappedPhotos}
              onBack={handleBackToCapture}
              onGeneratePrint={handleGeneratePrint}
            />
          )}

          {flowState === 'EXPORT' && (
            <LoadingExport
              printUrl={printUrl}
              onReset={handleReset}
            />
          )}
        </CurtainWrapper>
      </div>
    </>
  );
}

const styles = {
  mainStage: {
    flex: 1,
    position: 'relative',
    width: '100%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }
};

export default App;
