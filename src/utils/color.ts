export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface RGBA extends RGB {
  a: number;
}

export const PRESET_COLORS = {
  highlighterYellow: '#ffeb3b',
  highlighterGreen: '#69f0ae',
  highlighterBlue: '#40c4ff',
  highlighterPink: '#ff80ab',
  highlighterPurple: '#ea80fc',
  highlighterOrange: '#ffd180',
  inkBlue: '#1565c0',
  inkBlack: '#212121',
  inkRed: '#d32f2f',
  inkGreen: '#2e7d32',
  stampRed: '#c62828',
  stampGreen: '#2e7d32',
  stampBlue: '#1565c0',
  noteYellow: '#fff9c4'
};

export function hexToRgb(hex: string): RGB {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

export function hexToPdfRgb(hex: string): { r: number; g: number; b: number } {
  const { r, g, b } = hexToRgb(hex);
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255
  };
}

export function rgbaToCss(rgb: RGB, alpha: number = 1): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function hexToRgbaCss(hex: string, alpha: number = 1): string {
  const rgb = hexToRgb(hex);
  return rgbaToCss(rgb, alpha);
}
