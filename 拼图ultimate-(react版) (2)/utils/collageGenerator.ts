
import { AppSettings, ImageItem } from '../types';
import JSZip from 'jszip';

const MAX_CANVAS_DIMENSION = 8192;

export const generateCollages = async (
    images: ImageItem[],
    settings: AppSettings,
    repackMode: boolean,
    onProgress: (status: { progress: number; message: string; currentGroup: number; totalGroups: number }) => void,
    checkCancelled: () => boolean
): Promise<Blob[]> => {
    
    const { cols, gap, quality } = settings;
    // Default to 50 rows if not specified or 0
    const rowsPerGroup = settings.rowsPerGroup > 0 ? settings.rowsPerGroup : 50;
    const batchSize = cols * rowsPerGroup;

    // Parse Mask Indices
    const maskTargets = parseMaskIndices(settings.maskIndices);

    // Filter images if in Repack mode
    let processImages = images;
    if (repackMode) {
        processImages = images.filter((_, i) => {
            const currentNum = settings.startNumber + i;
            return !maskTargets.includes(currentNum);
        });
    }

    const totalGroups = Math.ceil(processImages.length / batchSize);
    const generatedBlobs: Blob[] = [];

    // Calculate Cell Dimensions
    let cellW = 1500; // Base high res width
    const ratio = settings.aspectRatio > 0 ? settings.aspectRatio : (settings.customWidth / settings.customHeight);
    
    // Adjust if canvas would be too big
    if (cols * cellW > MAX_CANVAS_DIMENSION) {
        cellW = Math.floor((MAX_CANVAS_DIMENSION - (cols * gap)) / cols);
    }
    const cellH = Math.floor(cellW / ratio);

    // Prepare Overlay Image if exists
    let overlayImgEl: HTMLImageElement | null = null;
    if (settings.overlayImage) {
        overlayImgEl = await loadImage(URL.createObjectURL(settings.overlayImage));
    }

    // Prepare Sticker Image if exists
    let stickerImgEl: HTMLImageElement | null = null;
    if (settings.stickerImage) {
        stickerImgEl = await loadImage(URL.createObjectURL(settings.stickerImage));
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimize for no transparency

    if (!ctx) throw new Error("Canvas context creation failed");

    for (let groupIndex = 0; groupIndex < totalGroups; groupIndex++) {
        if (checkCancelled()) break;

        const groupImages = processImages.slice(groupIndex * batchSize, (groupIndex + 1) * batchSize);
        const groupRows = Math.ceil(groupImages.length / cols);
        
        canvas.width = cols * cellW + (cols - 1) * gap;
        canvas.height = groupRows * cellH + (groupRows - 1) * gap;

        // Fill White Background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Images
        for (let i = 0; i < groupImages.length; i++) {
            if (checkCancelled()) break;

            // Yield to main thread every 30 images to prevent UI freeze
            if (i % 30 === 0) {
                await new Promise(r => setTimeout(r, 10));
                onProgress({
                    progress: Math.round(((groupIndex * batchSize + i) / processImages.length) * 100),
                    message: `正在处理第 ${groupIndex + 1}/${totalGroups} 组 (${i + 1}/${groupImages.length})`,
                    currentGroup: groupIndex + 1,
                    totalGroups
                });
            }

            const imgItem = groupImages[i];
            const r = Math.floor(i / cols);
            const c = i % cols;
            const x = c * (cellW + gap);
            const y = r * (cellH + gap);
            
            const globalIndex = settings.startNumber + (groupIndex * batchSize) + i;

            try {
                const img = await loadImage(imgItem.url);
                drawFitImage(ctx, img, x, y, cellW, cellH);
                
                // CRITICAL: Release memory immediately
                img.src = "";
                img.remove();
            } catch (e) {
                // Draw error placeholder
                ctx.fillStyle = "#f9f9f9";
                ctx.fillRect(x, y, cellW, cellH);
                ctx.fillStyle = "#ff3b30";
                ctx.font = `bold ${cellW/10}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText("❌图片损坏", x + cellW/2, y + cellH/2);
            }

            // Draw Number
            if (settings.showNumber) {
                drawNumber(ctx, globalIndex, x, y, cellW, cellH, settings);
            }

            // Draw Masking / Sticker
            // If Apply mode (repackMode = false), we draw masks.
            if (!repackMode && maskTargets.includes(globalIndex)) {
                drawMask(ctx, x, y, cellW, cellH, settings, stickerImgEl);
            }
        }

        // Draw Overlay (Global)
        if (overlayImgEl && settings.overlayOpacity > 0) {
             ctx.save();
             ctx.globalAlpha = settings.overlayOpacity;
             ctx.globalCompositeOperation = settings.overlayBlendMode;
             ctx.drawImage(overlayImgEl, 0, 0, canvas.width, canvas.height);
             ctx.restore();
        }

        if (checkCancelled()) break;

        // Export Blob
        const blob = await new Promise<Blob | null>(resolve => {
            canvas.toBlob(resolve, quality === 1 ? 'image/png' : 'image/jpeg', quality);
        });

        if (blob) generatedBlobs.push(blob);
        
        // Clear canvas context to help GC
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 1; 
        canvas.height = 1;
        
        // Force a pause between groups for GC
        await new Promise(r => setTimeout(r, 200));
    }

    return generatedBlobs;
};

// Helper: Parse mask indices string "1, 2-5" -> [1,2,3,4,5]
const parseMaskIndices = (input: string): number[] => {
    const targets: number[] = [];
    const parts = input.split(/[,，、\s]+/);
    parts.forEach(part => {
        part = part.trim();
        if (!part) return;
        // Handle range 1-5
        const standardPart = part.replace(/[~—–]/g, '-');
        if (standardPart.includes('-')) {
            const rangeParts = standardPart.split('-');
            if (rangeParts.length === 2) {
                const s = parseInt(rangeParts[0]);
                const e = parseInt(rangeParts[1]);
                if (!isNaN(s) && !isNaN(e)) {
                    for (let k = Math.min(s, e); k <= Math.max(s, e); k++) targets.push(k);
                }
            }
        } else {
            const num = parseInt(standardPart);
            if (!isNaN(num)) targets.push(num);
        }
    });
    return targets;
};

// Helper to load image
const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
};

// Draw image covering the cell (object-fit: cover)
const drawFitImage = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    const imgRatio = img.width / img.height;
    const targetRatio = w / h;

    if (imgRatio > targetRatio) {
        // Image is wider
        const drawH = h;
        const drawW = h * imgRatio;
        const drawX = x - (drawW - w) / 2;
        ctx.drawImage(img, drawX, y, drawW, drawH);
    } else {
        // Image is taller
        const drawW = w;
        const drawH = w / imgRatio;
        const drawY = y - (drawH - h) / 2;
        ctx.drawImage(img, x, drawY, drawW, drawH);
    }
    ctx.restore();
};

const drawNumber = (ctx: CanvasRenderingContext2D, num: number, x: number, y: number, w: number, h: number, s: AppSettings) => {
    ctx.save();
    const fontSize = s.fontSize;
    ctx.font = `bold ${fontSize}px ${s.fontFamily}`;
    
    let tx = x + w / 2;
    let ty = y + h - fontSize / 2;

    if (s.fontPos === 'center') {
        ty = y + h / 2 + fontSize / 3;
    } else if (s.fontPos.includes('top')) {
        ty = y + fontSize + 20;
    }

    if (s.fontPos.includes('left')) {
        tx = x + 20;
        ctx.textAlign = 'left';
    } else if (s.fontPos.includes('right')) {
        tx = x + w - 20;
        ctx.textAlign = 'right';
    } else {
        ctx.textAlign = 'center';
    }

    if (s.enableStroke) {
        ctx.lineWidth = fontSize / 12;
        ctx.strokeStyle = s.strokeColor;
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;
        ctx.strokeText(String(num), tx, ty);
    }

    if (s.enableShadow) {
        ctx.shadowColor = s.shadowColor;
        ctx.shadowBlur = fontSize / 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
    }
    
    ctx.fillStyle = s.fontColor;
    ctx.fillText(String(num), tx, ty);
    ctx.restore();
};

const drawMask = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: AppSettings, stickerImg: HTMLImageElement | null) => {
    ctx.save();
    if (s.maskMode === 'line') {
        ctx.beginPath();
        ctx.strokeStyle = s.maskColor;
        // Base scale on width=500 -> 5px width * scale
        ctx.lineWidth = s.maskWidth * (w / 500) * 5; 
        ctx.lineCap = 'round';
        if (s.lineStyle === 'cross') {
            ctx.moveTo(x + w * 0.2, y + h * 0.2);
            ctx.lineTo(x + w * 0.8, y + h * 0.8);
            ctx.moveTo(x + w * 0.8, y + h * 0.2);
            ctx.lineTo(x + w * 0.2, y + h * 0.8);
        } else {
            ctx.moveTo(x + w * 0.2, y + h * 0.8);
            ctx.lineTo(x + w * 0.8, y + h * 0.2);
        }
        ctx.stroke();
    } else if (s.maskMode === 'image' && stickerImg) {
        const sizePct = s.stickerSize / 100;
        const xPct = s.stickerX / 100;
        const yPct = s.stickerY / 100;
        
        const sw = w * sizePct;
        const sh = sw * (stickerImg.height / stickerImg.width);
        const dx = x + (w * xPct) - sw / 2;
        const dy = y + (h * yPct) - sh / 2;
        
        ctx.drawImage(stickerImg, dx, dy, sw, sh);
    }
    ctx.restore();
};

export const combineBlobs = async (blobs: Blob[], quality: number): Promise<Blob | null> => {
    try {
        const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
        const totalH = bitmaps.reduce((sum, bmp) => sum + bmp.height, 0);
        const maxW = bitmaps[0].width;
        
        // Safety check for mobile canvas limits (roughly 16MP to 50MP)
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const limit = isMobile ? 16777216 : 50000000;
        if (maxW * totalH > limit) {
             throw new Error("Canvas too large for device");
        }

        const canvas = document.createElement('canvas');
        canvas.width = maxW;
        canvas.height = totalH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        let y = 0;
        for (const bmp of bitmaps) {
            ctx.drawImage(bmp, 0, y);
            y += bmp.height;
        }

        return new Promise(resolve => {
            canvas.toBlob(resolve, quality === 1 ? 'image/png' : 'image/jpeg', quality);
        });
    } catch (e) {
        console.error("Combine failed", e);
        return null;
    }
};

export const downloadZip = async (blobs: Blob[], quality: number) => {
    const zip = new JSZip();
    const folder = zip.folder("拼图分组");
    const ext = quality === 1 ? 'png' : 'jpg';
    
    blobs.forEach((blob, i) => {
        if(folder) folder.file(`拼图_Part_${i + 1}.${ext}`, blob);
    });
    
    const content = await zip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(content);
    link.download = `拼图打包_${Date.now()}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
};
