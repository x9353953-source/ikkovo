）
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ImageItem, AppSettings, GenerationStatus } from './types';
import { ImageGrid } from './components/ImageGrid';
import { SettingsPanel } from './components/SettingsPanel';
import { NotesModal } from './components/NotesModal';
import { generateCollages, downloadZip, combineBlobs } from './utils/collageGenerator';
import { saveImagesToDB, deleteImageFromDB, clearImagesFromDB, getAllImagesFromDB, saveImageToDB } from './utils/storage';
import { Upload, Download, RefreshCw, XCircle, X, Info, ChevronDown } from 'lucide-react';

const DEFAULT_SETTINGS: AppSettings = {
    cols: 3,
    rowsPerGroup: 50,
    gap: 0,
    aspectRatio: 0.75, // 3:4
    customWidth: 1000,
    customHeight: 1500,
    showNumber: true,
    startNumber: 1,
    fontSize: 350,
    fontFamily: 'sans-serif',
    fontColor: '#FFFFFF',
    enableStroke: false,
    strokeColor: '#000000',
    shadowColor: '#000000',
    enableShadow: true,
    fontPos: 'bottom-center',
    quality: 0.8,
    overlayImage: null,
    overlayOpacity: 1,
    overlayBlendMode: 'source-over',
    maskIndices: '',
    maskMode: 'line',
    lineStyle: 'cross',
    maskColor: '#FF3B30',
    maskWidth: 10,
    stickerImage: null,
    stickerSize: 50,
    stickerX: 50,
    stickerY: 50
};

const App: React.FC = () => {
    const [images, setImages] = useState<ImageItem[]>([]);
    // 定义存储的 Key
const SETTINGS_STORAGE_KEY = 'puzzle_settings_v2';

const [settings, setSettings] = useState<AppSettings>(() => {
        try {
            const saved = localStorage.getItem(SETTINGS_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                // ⚠️ 关键修复：强制重置图片文件为 null
                // 因为 LocalStorage 存不了文件，读取回来的空对象会导致生成器崩溃
                return { 
                    ...DEFAULT_SETTINGS, 
                    ...parsed, 
                    stickerImage: null, 
                    overlayImage: null 
                };
            }
            return DEFAULT_SETTINGS;
        } catch (e) {
            console.error("加载设置失败", e);
            return DEFAULT_SETTINGS;
        }
    });// Auto-save settings when they change
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        }, 500); // 延迟 500ms 保存，避免频繁读写

        return () => clearTimeout(timeoutId);
    }, [settings]);

    const [status, setStatus] = useState<GenerationStatus>({ isGenerating: false, progress: 0, message: '', currentGroup: 0, totalGroups: 0 });
    const [resultBlobs, setResultBlobs] = useState<Blob[]>([]);
    const [showSizes, setShowSizes] = useState(false);
    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [showNotes, setShowNotes] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [isResultCollapsed, setIsResultCollapsed] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const replaceInputRef = useRef<HTMLInputElement>(null);
    const replaceTargetId = useRef<string | null>(null);
    const cancelRef = useRef(false);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);

    // Initial Load & Service Worker
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js')
                .then(reg => console.log('Service Worker registered', reg))
                .catch(err => console.error('Service Worker registration failed', err));
        }

        // Restore images from DB
        const restoreSession = async () => {
            try {
                const saved = await getAllImagesFromDB();
                if (saved && saved.length > 0) {
                     setStatus({ isGenerating: true, progress: 0, message: '恢复上次会话...', currentGroup: 0, totalGroups: 0 });
                     
                     const chunkSize = 50;
                     for (let i = 0; i < saved.length; i += chunkSize) {
                         const chunk = saved.slice(i, i + chunkSize);
                         const restoredImages: ImageItem[] = chunk.map(item => ({
                             id: item.id,
                             name: item.name,
                             file: item.file,
                             url: URL.createObjectURL(item.file),
                             timestamp: item.timestamp
                         }));
                         setImages(prev => [...prev, ...restoredImages]);
                         await new Promise(r => setTimeout(r, 10));
                     }
                     setStatus(prev => ({ ...prev, isGenerating: false }));
                }
            } catch (e) {
                console.error("Session restore failed", e);
            }
        };
        restoreSession();
    }, []);

    // Simple ID generator
    const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;
        
        // Critical buffer: Wait 300ms for device to return from album and recover memory
        await new Promise(r => setTimeout(r, 300));

        const files = Array.from(e.target.files);
        const chunkSize = 50;
        
        // Show status for large batches
        if (files.length > 50) {
            setStatus(prev => ({ ...prev, isGenerating: true, message: '正在导入图片...', progress: 0 }));
        }

        const now = Date.now();

        for (let i = 0; i < files.length; i += chunkSize) {
            const chunk = files.slice(i, i + chunkSize);
            const newImages: ImageItem[] = chunk.map((file, idx) => ({
                id: generateId() + idx, // Ensure unique
                url: URL.createObjectURL(file),
                file,
                name: file.name,
                timestamp: now + i + idx
            }));
            
            // Persist to DB
            await saveImagesToDB(newImages.map(img => ({
                id: img.id,
                name: img.name,
                file: img.file,
                timestamp: img.timestamp
            })));

            setImages(prev => [...prev, ...newImages]);
            
            // Give UI a moment to breathe and render the grid updates
            await new Promise(r => setTimeout(r, 20));
        }
        
        setStatus(prev => ({ ...prev, isGenerating: false }));
        
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !replaceTargetId.current) return;
        const file = e.target.files[0];
        
        // Find existing to keep timestamp if possible
        const existing = images.find(img => img.id === replaceTargetId.current);
        const timestamp = existing ? existing.timestamp : Date.now();

        setImages(prev => prev.map(img => {
            if (img.id === replaceTargetId.current) {
                URL.revokeObjectURL(img.url);
                return {
                    id: img.id,
                    url: URL.createObjectURL(file),
                    file,
                    name: file.name,
                    timestamp: timestamp
                };
            }
            return img;
        }));
        
        if (replaceTargetId.current) {
            await saveImageToDB({
                id: replaceTargetId.current,
                name: file.name,
                file: file,
                timestamp: timestamp
            });
        }
        
        replaceTargetId.current = null;
        if (replaceInputRef.current) replaceInputRef.current.value = '';
    };

    const triggerReplace = (id: string) => {
        replaceTargetId.current = id;
        replaceInputRef.current?.click();
    };

    const removeImage = (id: string) => {
        setImages(prev => {
            const target = prev.find(i => i.id === id);
            if (target) URL.revokeObjectURL(target.url);
            return prev.filter(i => i.id !== id);
        });
        deleteImageFromDB(id);
    };

    const clearImages = () => {
        if (confirm("确定要清空所有图片吗？")) {
            images.forEach(i => URL.revokeObjectURL(i.url));
            setImages([]);
            setResultBlobs([]);
            clearImagesFromDB();
        }
    };

    const handleReset = () => {
        setShowResetModal(true);
    };

    const confirmReset = async () => {
        // Revoke URLs to free memory
        images.forEach(i => URL.revokeObjectURL(i.url));
        setImages([]);
        setResultBlobs([]);
        setSettings(DEFAULT_SETTINGS);
        
        await clearImagesFromDB();
        
        // Hard reset local storage and reload to ensure clean state
        localStorage.clear();
        window.location.reload();
    };

    // Duplicate Logic
    const duplicates = useMemo(() => {
        const seen = new Set();
        const dups: ImageItem[] = [];
        images.forEach(img => {
            const key = `${img.name}-${img.file.size}`;
            if (seen.has(key)) dups.push(img);
            else seen.add(key);
        });
        return dups;
    }, [images]);

    const removeDuplicates = () => {
        const seen = new Set();
        const idsToRemove: string[] = [];
        
        setImages(prev => prev.filter(img => {
            const key = `${img.name}-${img.file.size}`;
            const isDup = seen.has(key);
            seen.add(key);
            if (isDup) {
                URL.revokeObjectURL(img.url);
                idsToRemove.push(img.id);
            }
            return !isDup;
        }));
        
        idsToRemove.forEach(id => deleteImageFromDB(id));
    };

    const runGeneration = async (repack: boolean) => {
        if (images.length === 0) return alert("请先添加图片");
        
        cancelRef.current = false;
        setStatus({ isGenerating: true, progress: 0, message: '准备中...', currentGroup: 0, totalGroups: 0 });
        setResultBlobs([]);
        setIsResultCollapsed(false); // Reset collapse state on new generation

        try {
            const blobs = await generateCollages(
                images,
                settings,
                repack,
                (s) => setStatus(prev => ({ ...prev, ...s })),
                () => cancelRef.current
            );
            if (!cancelRef.current) {
                setResultBlobs(blobs);
                setStatus(prev => ({ ...prev, isGenerating: false, message: '生成完成', progress: 100 }));
                setTimeout(() => document.getElementById('result-section')?.scrollIntoView({ behavior: 'smooth' }), 500);
            } else {
                setStatus(prev => ({ ...prev, isGenerating: false, message: '已取消' }));
            }
        } catch (error: any) {
            console.error(error);
            alert(`生成出错: ${error.message}`);
            setStatus(prev => ({ ...prev, isGenerating: false }));
        }
    };

    const handleCancel = () => {
        cancelRef.current = true;
    };

    const downloadCombined = async () => {
        if (resultBlobs.length === 0) return;
        if (images.length > 100) return alert('⚠️ 图片数量超过100张，禁止合并导出。\n\n请使用 "打包下载 (ZIP)"。');
        
        setStatus(prev => ({ ...prev, isGenerating: true, message: '合并图片中...' }));
        const combined = await combineBlobs(resultBlobs, settings.quality);
        setStatus(prev => ({ ...prev, isGenerating: false }));

        if (combined) {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(combined);
            link.download = `拼图_合并版_${Date.now()}.${settings.quality === 1 ? 'png' : 'jpg'}`;
            link.click();
        } else {
            alert('合并失败，图片过大');
        }
    };

    const downloadIndividual = async () => {
        if (resultBlobs.length === 0) return;
        const confirmMsg = `即将开始逐张下载 ${resultBlobs.length} 张图片。\n\n⚠️ 为防止浏览器拦截，每张图片之间将有 1.5 秒的间隔。\n\n请保持页面在前台，不要关闭。`;
        if (!confirm(confirmMsg)) return;

        for (let i = 0; i < resultBlobs.length; i++) {
            const blob = resultBlobs[i];
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `拼图_Part_${i + 1}.${settings.quality === 1 ? 'png' : 'jpg'}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            await new Promise(r => setTimeout(r, 1500));
        }
        alert('下载队列已完成');
    }

    // Effect for the large preview modal drawing
    useEffect(() => {
        if (!previewModalOpen || !previewCanvasRef.current || images.length === 0) return;

        const canvas = previewCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set high resolution for preview
        canvas.width = 1000;
        canvas.height = 1000;
        
        const loadAndDraw = async () => {
             try {
                // Clear
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(0,0, canvas.width, canvas.height);

                // Load First Image as BG
                const bgImg = new Image();
                bgImg.src = images[0].url;
                await new Promise((resolve) => { bgImg.onload = resolve; });

                const w = canvas.width;
                const h = canvas.height;
                
                // Draw BG fitted
                const imgRatio = bgImg.width / bgImg.height;
                const canvasRatio = w / h;
                
                if (imgRatio > canvasRatio) {
                     const dh = w / imgRatio;
                     ctx.drawImage(bgImg, 0, (h - dh)/2, w, dh);
                } else {
                     const dw = h * imgRatio;
                     ctx.drawImage(bgImg, (w - dw)/2, 0, dw, h);
                }

                // Draw Sticker if exists
                if (settings.maskMode === 'image' && settings.stickerImage) {
                    const stickerImg = new Image();
                    stickerImg.src = URL.createObjectURL(settings.stickerImage);
                    await new Promise((resolve) => { stickerImg.onload = resolve; });

                    const sizePct = settings.stickerSize / 100;
                    const xPct = settings.stickerX / 100;
                    const yPct = settings.stickerY / 100;

                    const sw = w * sizePct;
                    const sh = sw * (stickerImg.height / stickerImg.width);
                    const dx = (w * xPct) - sw / 2;
                    const dy = (h * yPct) - sh / 2;

                    ctx.drawImage(stickerImg, dx, dy, sw, sh);
                }
             } catch (e) {
                 console.error("Preview render failed", e);
             }
        };

        loadAndDraw();

    }, [previewModalOpen, settings.maskMode, settings.stickerImage, settings.stickerSize, settings.stickerX, settings.stickerY, images]);

    const totalSize = resultBlobs.reduce((acc, b) => acc + b.size, 0);

    return (
        <div className="min-h-screen pb-32 max-w-2xl mx-auto bg-[#F2F2F7]">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-[#F2F2F7]/90 backdrop-blur-xl border-b border-gray-200/50 px-5 py-3 flex justify-between items-center h-[52px]">
                <h1 className="text-[20px] font-bold text-black flex items-center gap-2">
                    拼图<span className="text-xs font-normal text-white bg-black px-1.5 py-0.5 rounded ml-1">Ultimate</span>
                </h1>
                <div className="flex gap-2">
                    <button 
                        onClick={handleReset}
                        className="bg-gray-100 text-gray-500 text-[13px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1 active:bg-gray-200 transition"
                    >
                        <RefreshCw size={14} /> 重置
                    </button>
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-white text-[#007AFF] text-[15px] font-bold px-4 py-1.5 rounded-full shadow-sm flex items-center gap-1 active:scale-95 transition"
                    >
                        <Upload size={14} strokeWidth={3} /> 添加
                    </button>
                </div>
                <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFiles} 
                />
                <input 
                    type="file"
                    accept="image/*"
                    ref={replaceInputRef}
                    className="hidden"
                    onChange={handleReplaceFile}
                />
            </header>

            {/* Main Content */}
            <main className="p-4 pt-4 space-y-4">
                
                {/* Images */}
                <ImageGrid 
                    images={images} 
                    onRemove={removeImage} 
                    onClear={clearImages} 
                    onAdd={() => fileInputRef.current?.click()}
                    onReplace={triggerReplace}
                    onRemoveDuplicates={removeDuplicates}
                    duplicatesCount={duplicates.length}
                />

                {/* Settings */}
                <SettingsPanel 
                    settings={settings} 
                    onChange={setSettings} 
                    onGenerateMasked={(mode) => runGeneration(mode === 'repack')}
                    previewImage={images[0]?.url}
                    onEnlargePreview={() => {
                        if(images.length === 0) return alert('请先添加图片');
                        setPreviewModalOpen(true);
                    }}
                />

                {/* Progress Toast */}
                <div 
                    className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${status.isGenerating ? 'translate-y-0 opacity-100' : '-translate-y-[200%] opacity-0 pointer-events-none'}`}
                >
                     <div className="bg-white/95 backdrop-blur-xl text-gray-900 rounded-full shadow-2xl flex items-center py-3 pl-6 pr-4 gap-3 border border-gray-200/50 min-w-[200px]">
                         <div className="flex-1 flex flex-col justify-center min-w-0">
                             <div className="flex items-center justify-center gap-2">
                                 <span className="text-[15px] font-bold leading-tight truncate text-[#007AFF]">
                                    {status.message}
                                 </span>
                             </div>
                         </div>
                         <button onClick={handleCancel} className="pointer-events-auto w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 active:scale-90 transition text-gray-500 hover:text-[#FF3B30] shrink-0">
                             <X size={16} />
                         </button>
                     </div>
                </div>

                {/* Result Section */}
                {resultBlobs.length > 0 && !status.isGenerating && (
                    <div id="result-section" className="ios-card bg-white rounded-xl shadow-sm animate-fade-in overflow-hidden">
                        <div 
                            className="flex items-center justify-between p-4 bg-white border-b border-gray-100 cursor-pointer select-none active:bg-gray-50 transition"
                            onClick={() => setIsResultCollapsed(!isResultCollapsed)}
                        >
                             <div>
                                <div className="text-[17px] font-bold text-[#34C759]">生成结果</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">预览与下载拼图</div>
                             </div>
                             <ChevronDown size={20} className={`text-gray-400 transition-transform duration-300 ${isResultCollapsed ? '' : 'rotate-180'}`} />
                        </div>

                        {!isResultCollapsed && (
                            <div className="p-4">
                                {/* Size Info */}
                                <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                                    <div className="flex justify-between items-center font-bold border-b border-green-200/50 pb-2 mb-2">
                                        <span>分卷总计</span>
                                        <span>{(totalSize / 1024 / 1024).toFixed(2)} MB</span>
                                    </div>
                                    <button onClick={() => setShowSizes(!showSizes)} className="text-[10px] underline w-full text-left text-green-600">
                                        {showSizes ? '收起详情 ▲' : `展开 ${resultBlobs.length} 个分组详情 ▼`}
                                    </button>
                                    {showSizes && (
                                        <div className="grid grid-cols-2 gap-y-1 mt-2 text-xs opacity-80">
                                            {resultBlobs.map((b, i) => (
                                                <div key={i}>组 {i+1}: {(b.size / 1024 / 1024).toFixed(2)} MB</div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Previews */}
                                <div className="bg-gray-50 p-2 rounded-lg max-h-[400px] overflow-y-auto space-y-2 mb-4">
                                    {resultBlobs.map((blob, i) => (
                                        <img 
                                            key={i} 
                                            src={URL.createObjectURL(blob)} 
                                            className="w-full h-auto object-contain bg-white border rounded shadow-sm" 
                                            loading="lazy"
                                        />
                                    ))}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={downloadIndividual}
                                        className="col-span-2 bg-[#34C759] text-white text-[16px] font-bold py-3.5 rounded-xl shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2"
                                    >
                                        <Download size={20} />
                                        <span>逐张下载 (防漏图版)</span>
                                    </button>

                                    <button 
                                        onClick={downloadCombined}
                                        className="bg-white text-black border border-gray-200 text-[14px] font-medium py-3 rounded-xl active:scale-95 transition"
                                    >
                                        合并为长图
                                    </button>

                                    <button 
                                        onClick={() => downloadZip(resultBlobs, settings.quality)}
                                        className="bg-white text-[#007AFF] border border-gray-200 text-[14px] font-medium py-3 rounded-xl active:scale-95 transition"
                                    >
                                        打包下载 (ZIP)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* Floating Action Button */}
            {!status.isGenerating && (
                <div className="fixed bottom-8 left-0 right-0 px-4 pointer-events-none z-40">
                    <button 
                        onClick={() => runGeneration(false)}
                        className="pointer-events-auto w-full max-w-2xl mx-auto bg-white/80 backdrop-blur-md text-black border border-white/40 font-semibold text-[17px] py-3.5 rounded-full shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        ✨ 开始生成拼图
                    </button>
                </div>
            )}

            {/* Floating Notes Button */}
            {!localStorage.getItem('puzzle_hide_notes_v1') && (
                <div className="fixed right-5 bottom-28 z-40 transition-all duration-300 hover:scale-105">
                    <button 
                        onClick={() => setShowNotes(true)} 
                        className="bg-white/90 backdrop-blur-md text-[#007AFF] shadow-[0_4px_12px_rgba(0,0,0,0.15)] border border-white/50 font-bold text-[13px] px-4 py-2.5 rounded-full flex items-center gap-1.5 active:scale-95 transition"
                    >
                        <Info size={16} />
                        <span>注意事项</span>
                    </button>
                </div>
            )}

            {/* Notes Modal */}
            {showNotes && (
                <NotesModal 
                    onClose={() => setShowNotes(false)} 
                    onPermanentClose={() => {
                        if(confirm('确定不再显示此悬浮球吗？\n(您可以通过清除浏览器缓存来恢复)')) {
                            localStorage.setItem('puzzle_hide_notes_v1', 'true');
                            setShowNotes(false);
                        }
                    }} 
                />
            )}

            {/* Preview Modal */}
            {previewModalOpen && (
                <div 
                    className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setPreviewModalOpen(false)}
                >
                    <div 
                        className="bg-white rounded-xl shadow-2xl relative w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]"
                        onClick={e => e.stopPropagation()}
                    >
                         <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-white">
                             <span className="font-bold text-gray-800 text-lg">贴纸/打码 放大预览</span>
                             <button onClick={() => setPreviewModalOpen(false)} className="bg-gray-100 p-1.5 rounded-full text-gray-500 hover:bg-gray-200 transition">
                                 <X size={20} />
                             </button>
                         </div>
                         <div className="flex-1 bg-[#F2F2F7] overflow-auto flex items-center justify-center p-4">
                             <canvas ref={previewCanvasRef} className="max-w-full h-auto object-contain shadow-sm border border-gray-200 bg-white" />
                         </div>
                         <div className="p-3 bg-white text-center text-xs text-gray-400 border-t border-gray-100">
                             此预览仅展示首张图片的遮挡效果
                         </div>
                    </div>
                </div>
            )}

            {/* Reset Modal */}
            {showResetModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={() => setShowResetModal(false)} />
                    <div className="relative bg-[#F2F2F2]/85 backdrop-blur-xl rounded-[14px] w-[270px] text-center shadow-2xl overflow-hidden transform transition-all scale-100 animate-fade-in">
                        <div className="pt-5 px-4 pb-4">
                            <h3 className="text-[17px] font-bold text-black mb-1">⚠️ 警告</h3>
                            <p className="text-[13px] text-black leading-snug">确定要重置吗？<br />这将清空所有内容。</p>
                        </div>
                        <div className="flex border-t border-[#3C3C43]/30 h-[44px]">
                            <button onClick={() => setShowResetModal(false)} className="flex-1 text-[17px] text-[#007AFF] font-normal border-r border-[#3C3C43]/30 active:bg-gray-200/50 transition">取消</button>
                            <button onClick={confirmReset} className="flex-1 text-[17px] text-[#FF3B30] font-bold active:bg-gray-200/50 transition">重置</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
