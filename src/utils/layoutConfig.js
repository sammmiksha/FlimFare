export const LAYOUTS = {
  single: {
    name: 'Polaroid Box',
    desc: '1:1 Classic Polaroid Frame with a bottom chin',
    canvasWidth: 340,
    canvasHeight: 440,
    photoCount: 1,
    maxStickers: 20,
    maxTexts: 10,
    defaultBg: '#ffffff',
    photoSlots: [
      { left: 30, top: 30, width: 280, height: 280, aspect: 1.0 }
    ],
    showCaption: true,
    captionTop: 365
  },
  digicam: {
    name: 'Retro Digicam',
    desc: 'Landscape photo inside a retro silver compact camera',
    canvasWidth: 360,
    canvasHeight: 360,
    photoCount: 1,
    maxStickers: 20,
    maxTexts: 10,
    defaultBg: '#ffffff',
    photoSlots: [
      { left: 136, top: 141, width: 138, height: 117, aspect: 138 / 117 }
    ],
    overlayImage: '/retro_camera_frame.png',
    showCaption: false
  },
  strip: {
    name: '3-Photo Strip',
    desc: '1:3 Traditional vertical film strip template',
    canvasWidth: 260,
    canvasHeight: 1000,
    photoCount: 3,
    maxStickers: 15,
    maxTexts: 10,
    defaultBg: '#ffffff',
    photoSlots: [
      { left: 25, top: 20, width: 210, height: 280, aspect: 0.75 },
      { left: 25, top: 320, width: 210, height: 280, aspect: 0.75 },
      { left: 25, top: 620, width: 210, height: 280, aspect: 0.75 }
    ],
    showCaption: true,
    captionTop: 940
  },
  strip5: {
    name: '5-Photo Strip',
    desc: 'Y2K style vertical strip with sprocket hole borders',
    canvasWidth: 260,
    canvasHeight: 880,
    photoCount: 5,
    maxStickers: 10,
    maxTexts: 10,
    defaultBg: '#111111',
    photoSlots: [
      { left: 40, top: 30, width: 180, height: 145, aspect: 180 / 145 },
      { left: 40, top: 193, width: 180, height: 145, aspect: 180 / 145 },
      { left: 40, top: 356, width: 180, height: 145, aspect: 180 / 145 },
      { left: 40, top: 519, width: 180, height: 145, aspect: 180 / 145 },
      { left: 40, top: 682, width: 180, height: 145, aspect: 180 / 145 }
    ],
    drawSprocketHoles: true,
    showCaption: true,
    captionTop: 850
  }
};
