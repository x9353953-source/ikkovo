
export interface ImageItem {
    id: string;
    url: string;
    file: File;
    name: string;
    timestamp: number;
}

export interface AppSettings {
    // Grid
    cols: number;
    rowsPerGroup: number;
    gap: number;
    aspectRatio: number; // width / height
    customWidth: number;
    customHeight: number;
    
    // Text
    showNumber: boolean;
    startNumber: number;
    fontSize: number;
    fontFamily: string;
    fontColor: string;
    enableStroke: boolean;
    strokeColor: string;
    shadowColor: string;
    enableShadow: boolean;
    fontPos: string; // 'center' | 'top-left' ...

    // Output
    quality: number; // 0.1 to 1.0
    
    // Overlay
    overlayImage: File | null;
    overlayOpacity: number;
    overlayBlendMode: GlobalCompositeOperation;

    // Masking & Stickers
    maskIndices: string;
    maskMode: 'line' | 'image';
    lineStyle: 'cross' | 'slash';
    maskColor: string;
    maskWidth: number;
    stickerImage: File | null;
    stickerSize: number; // percentage 10-200
    stickerX: number; // percentage 0-100
    stickerY: number; // percentage 0-100
}

export interface GenerationStatus {
    isGenerating: boolean;
    progress: number; // 0-100
    message: string;
    currentGroup: number;
    totalGroups: number;
}
