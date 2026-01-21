
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings } from '../types';
import { ChevronDown, Settings as SettingsIcon, Type, Layers, Grid, ShieldAlert, Maximize2 } from 'lucide-react';

interface Props {
    settings: AppSettings;
    onChange: (s: AppSettings) => void;
    onGenerateMasked: (mode: 'apply' | 'repack') => void;
    previewImage?: string;
    onEnlargePreview: () => void;
}

const Accordion: React.FC<{ title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, subtitle, icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-4">
            <div 
                className="flex items-center justify-between p-4 bg-white cursor-pointer select-none active:bg-gray-50 transition"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-3">
                    <div className="text-gray-400">{icon}</div>
                    <div>
                        <div className="text-[16px] font-bold text-gray-900">{title}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">{subtitle}</div>
                    </div>
                </div>
                <ChevronDown size={18} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && <div className="border-t border-gray-100">{children}</div>}
        </div>
    );
};

export const SettingsPanel: React.FC<Props> = ({ settings, onChange, onGenerateMasked, previewImage, onEnlargePreview }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [bgImgObj, setBgImgObj] = useState<HTMLImageElement | null>(null);
    const [stickerImgObj, setStickerImgObj] = useState<HTMLImageElement | null>(null);

    const update = (key: keyof AppSettings, value: any) => {
        onChange({ ...settings, [key]: value });
    };

    // Preload Background Image
    useEffect(() => {
        if (!previewImage) {
            setBgImgObj(null);
            return;
        }
        const img = new Image();
        img.src = previewImage;
        img.onload = () => setBgImgObj(img);
    }, [previewImage]);

    // Preload Sticker Image
    useEffect(() => {
        if (!settings.stickerImage) {
            setStickerImgObj(null);
            return;
        }
        const img = new Image();
        img.src = URL.createObjectURL(settings.stickerImage);
        img.onload = () => setStickerImgObj(img);
        return () => {
             // Optional: Revoke object URL if we were managing it here
        };
    }, [settings.stickerImage]);

    // Sticker Preview Render Loop
    useEffect(() => {
        if (settings.maskMode !== 'image' || !canvasRef.current) return;
        
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        // Draw Background
        if (bgImgObj) {
            const imgRatio = bgImgObj.width / bgImgObj.height;
            const canvasRatio = w / h;
            
            if (imgRatio > canvasRatio) {
                 const dh = w / imgRatio;
                 ctx.drawImage(bgImgObj, 0, (h - dh)/2, w, dh);
            } else {
                 const dw = h * imgRatio;
                 ctx.drawImage(bgImgObj, (w - dw)/2, 0, dw, h);
            }
        } else {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0,0,w,h);
            ctx.fillStyle = '#999';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('无预览图', w/2, h/2);
        }

        // Draw Sticker
        if (stickerImgObj) {
            const sizePct = settings.stickerSize / 100;
            const xPct = settings.stickerX / 100;
            const yPct = settings.stickerY / 100;

            const sw = w * sizePct;
            const sh = sw * (stickerImgObj.height / stickerImgObj.width);
            const dx = (w * xPct) - sw / 2;
            const dy = (h * yPct) - sh / 2;

            ctx.drawImage(stickerImgObj, dx, dy, sw, sh);
        }
    }, [settings.maskMode, bgImgObj, stickerImgObj, settings.stickerSize, settings.stickerX, settings.stickerY]);

    const handleQualityPreset = (val: string) => {
        if (val === 'custom') return;
        update('quality', parseFloat(val));
    };

    return (
        <>
            <Accordion title="单元格与间距" subtitle="设置画布比例、留白间隙" icon={<Grid size={20} />}>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between bg-white active:bg-gray-50 transition">
                        <span className="text-[15px]">画布比例</span>
                        <select 
                            value={settings.aspectRatio === 0 ? 'custom' : settings.aspectRatio}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'custom') update('aspectRatio', 0);
                                else update('aspectRatio', parseFloat(val));
                            }}
                            className="text-[#007AFF] text-[15px] bg-transparent outline-none text-right font-medium dir-rtl"
                        >
                            <option value="0.5625">9:16 手机全屏</option>
                            <option value="0.75">3:4 海报</option>
                            <option value="1">1:1 正方形</option>
                            <option value="1.333">4:3 照片</option>
                            <option value="custom">自定义...</option>
                        </select>
                    </div>
                    {settings.aspectRatio === 0 && (
                        <div className="flex justify-end gap-2 items-center bg-gray-50 p-2 rounded">
                            <input type="number" className="w-16 p-1 text-center border rounded text-sm" placeholder="宽" value={settings.customWidth} onChange={e=>update('customWidth', parseInt(e.target.value))} />
                            <span>:</span>
                            <input type="number" className="w-16 p-1 text-center border rounded text-sm" placeholder="高" value={settings.customHeight} onChange={e=>update('customHeight', parseInt(e.target.value))} />
                        </div>
                    )}
                    <div className="space-y-2">
                         <div className="flex justify-between items-center">
                            <span className="text-[15px]">图片间隙</span>
                            <span className="text-[#007AFF] font-bold text-[15px]">{settings.gap}px</span>
                         </div>
                         <input 
                            type="range" min="0" max="100" value={settings.gap} 
                            onChange={(e) => update('gap', parseInt(e.target.value))} 
                         />
                    </div>
                </div>
            </Accordion>

            <Accordion title="序号标注" subtitle="字体、颜色、位置设置" icon={<Type size={20} />}>
                <div className="divide-y divide-gray-100">
                    <div className="flex items-center justify-between p-4">
                        <span className="text-[15px]">显示序号</span>
                        <input 
                            type="checkbox" 
                            checked={settings.showNumber} 
                            onChange={(e) => update('showNumber', e.target.checked)}
                            className="w-5 h-5 accent-[#34C759]"
                        />
                    </div>
                    
                    {settings.showNumber && (
                        <>
                             <div className="flex items-center justify-between p-4">
                                <span className="text-[15px]">起始数值</span>
                                <input type="number" className="text-right text-[#007AFF] text-[15px] focus:outline-none w-20 bg-transparent" value={settings.startNumber} onChange={e => update('startNumber', parseInt(e.target.value))} />
                             </div>
                             <div className="flex items-center justify-between p-4">
                                <span className="text-[15px]">字号大小</span>
                                <input type="number" className="text-right text-[#007AFF] text-[15px] focus:outline-none w-20 bg-transparent" value={settings.fontSize} onChange={e => update('fontSize', parseInt(e.target.value))} />
                             </div>
                             <div className="flex items-center justify-between p-4">
                                <span className="text-[15px]">字体颜色</span>
                                <div className="flex gap-2">
                                     <input type="color" className="w-8 h-8 rounded-full overflow-hidden border border-gray-200" value={settings.fontColor} onChange={e => update('fontColor', e.target.value)} />
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-[15px]">描边颜色</span>
                                    <label className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 flex items-center gap-1 cursor-pointer">
                                         <input type="checkbox" checked={settings.enableStroke} onChange={e => update('enableStroke', e.target.checked)} className="accent-[#007AFF]"/> 启用
                                     </label>
                                </div>
                                <div className="flex gap-2">
                                     <input type="color" className="w-8 h-8 rounded-full overflow-hidden border border-gray-200" value={settings.strokeColor} onChange={e => update('strokeColor', e.target.value)} />
                                </div>
                             </div>
                             <div className="flex items-center justify-between p-4">
                                 <div className="flex items-center gap-2">
                                     <span className="text-[15px]">阴影颜色</span>
                                     <label className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 flex items-center gap-1 cursor-pointer">
                                         <input type="checkbox" checked={settings.enableShadow} onChange={e => update('enableShadow', e.target.checked)} className="accent-[#007AFF]"/> 启用
                                     </label>
                                 </div>
                                 <input type="color" className="w-8 h-8 rounded-full overflow-hidden border border-gray-200" value={settings.shadowColor} onChange={e => update('shadowColor', e.target.value)} />
                             </div>
                             <div className="flex items-center justify-between p-4">
                                <span className="text-[15px]">字体类型</span>
                                <select 
                                    value={settings.fontFamily} 
                                    onChange={e => update('fontFamily', e.target.value)}
                                    className="text-[#007AFF] text-[15px] bg-transparent outline-none text-right font-medium w-40"
                                >
                                    <option value="sans-serif">默认 (无衬线)</option>
                                    <option value="'Heiti SC', 'Microsoft YaHei', sans-serif">黑体 (Bold)</option>
                                    <option value="'Songti SC', 'SimSun', serif">宋体 (Serif)</option>
                                    <option value="'KaiTi', '楷体', serif">楷体 (Calligraphy)</option>
                                    <option value="'Times New Roman', serif">Times New Roman</option>
                                    <option value="cursive">手写风 (Cursive)</option>
                                </select>
                             </div>
                             <div className="flex items-center justify-between p-4">
                                <span className="text-[15px]">位置</span>
                                <select 
                                    value={settings.fontPos} 
                                    onChange={e => update('fontPos', e.target.value)}
                                    className="text-[#007AFF] text-[15px] bg-transparent outline-none text-right font-medium"
                                >
                                    <option value="bottom-center">底部居中</option>
                                    <option value="bottom-left">底部左侧</option>
                                    <option value="bottom-right">底部右侧</option>
                                    <option value="center">正中间</option>
                                    <option value="top-left">左上角</option>
                                    <option value="top-right">右上角</option>
                                </select>
                             </div>
                        </>
                    )}
                </div>
            </Accordion>
            
            <Accordion title="导出与布局策略" subtitle="设置排列列数、分组方式、画质" icon={<SettingsIcon size={20} />}>
                 <div className="p-4 space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                             <label className="text-[11px] text-gray-500 block mb-1">列数 (横向)</label>
                             <input type="number" value={settings.cols} onChange={e => update('cols', parseInt(e.target.value))} className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-[#007AFF] outline-none" />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                             <label className="text-[11px] text-gray-500 block mb-1">每组行数 (自动)</label>
                             <input 
                                type="number" 
                                placeholder="默认:50"
                                value={settings.rowsPerGroup || ''} 
                                onChange={e => update('rowsPerGroup', parseInt(e.target.value) || 0)} 
                                className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-center text-sm font-bold text-[#007AFF] outline-none" 
                             />
                        </div>
                    </div>
                    
                    <div className="bg-white pt-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[15px] font-bold text-gray-800">导出画质</span>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    min="1" max="100" 
                                    value={Math.round(settings.quality * 100)} 
                                    onChange={e => update('quality', parseInt(e.target.value)/100)}
                                    className="bg-gray-100 rounded px-1 py-1 text-center w-12 text-[15px] font-bold text-[#007AFF] outline-none" 
                                />
                                <span className="text-xs text-gray-500 mr-1">%</span>
                                <select 
                                    onChange={e => handleQualityPreset(e.target.value)}
                                    value="none" 
                                    className="text-[#007AFF] text-[15px] bg-transparent outline-none text-right font-medium dir-rtl max-w-[120px]"
                                >
                                    <option value="none" disabled>快速选择...</option>
                                    <option value="1.0">原图 (PNG)</option>
                                    <option value="0.95">高清 (95%)</option>
                                    <option value="0.80">标准压缩 (80%)</option>
                                    <option value="custom">自定义</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-[10px] text-[#FF3B30] font-bold mb-1">⚠️ 更改画质后请重新生成拼图，否则图片可能过大</p>
                        <p className="text-[10px] text-gray-400">真实文件大小将在生成后准确计算并显示。建议50%，（30%也不会影响太大画质查看图片）。</p>
                    </div>
                 </div>
            </Accordion>
            
            <Accordion title="全局纹理 / 覆盖层" subtitle="水印/底纹 (无需求可忽略)" icon={<Layers size={20} />}>
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                         <span className="text-[15px]">选择图片</span>
                         <label className="text-[#007AFF] text-[13px] font-bold bg-[#007AFF]/10 px-3 py-1.5 rounded-full active:bg-[#007AFF]/20 transition cursor-pointer">
                            + 图片
                            <input 
                                type="file" 
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        update('overlayImage', e.target.files[0]);
                                    }
                                }}
                            />
                         </label>
                    </div>
                    
                    {settings.overlayImage && (
                        <div className="bg-gray-50 rounded-lg p-2 flex items-center justify-between border border-gray-100">
                             <div className="flex items-center gap-2 overflow-hidden">
                                <img src={URL.createObjectURL(settings.overlayImage)} className="w-8 h-8 rounded object-cover border border-gray-200 bg-white" alt="overlay" />
                                <span className="text-xs text-gray-500 truncate max-w-[150px]">{settings.overlayImage.name}</span>
                             </div>
                             <button onClick={() => update('overlayImage', null)} className="text-gray-400 hover:text-[#FF3B30] px-2">✕</button>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="text-[11px] text-gray-500 block mb-1">混合模式</label>
                             <select value={settings.overlayBlendMode} onChange={e => update('overlayBlendMode', e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-bold text-gray-700 outline-none">
                                 <option value="source-over">标准 (正常)</option>
                                 <option value="multiply">正片叠底 (变暗)</option>
                                 <option value="screen">滤色 (变亮)</option>
                                 <option value="overlay">覆盖 (叠加)</option>
                                 <option value="soft-light">柔光</option>
                                 <option value="difference">差值</option>
                             </select>
                         </div>
                         <div>
                             <label className="text-[11px] text-gray-500 block mb-1">不透明度 ({Math.round(settings.overlayOpacity*100)}%)</label>
                             <input type="range" min="0" max="1" step="0.05" value={settings.overlayOpacity} onChange={e => update('overlayOpacity', parseFloat(e.target.value))} className="w-full" />
                         </div>
                    </div>
                </div>
            </Accordion>

            <Accordion title="打码与贴纸" subtitle="遮挡特定图片或序号、添加贴纸" icon={<ShieldAlert size={20} />}>
                <div className="divide-y divide-gray-200 border-t border-gray-100">
                    <div className="p-4 bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex flex-col">
                                <span className="text-[17px] font-bold text-gray-800">目标序号</span>
                                <span className="text-[10px] text-gray-400">输入数字 (如: 5, 12, 1-3)</span>
                            </div>
                            <input 
                                type="text" 
                                placeholder="如: 5, 12" 
                                className="text-right text-[#007AFF] text-[17px] focus:outline-none w-40 placeholder-gray-300 bg-gray-50 rounded px-2 py-1"
                                value={settings.maskIndices}
                                onChange={(e) => update('maskIndices', e.target.value)}
                            />
                        </div>

                        <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
                            <button 
                                onClick={() => update('maskMode', 'line')} 
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.maskMode === 'line' ? 'bg-white shadow text-black' : 'text-gray-500'}`}
                            >
                                画线打码
                            </button>
                            <button 
                                onClick={() => update('maskMode', 'image')} 
                                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${settings.maskMode === 'image' ? 'bg-white shadow text-black' : 'text-gray-500'}`}
                            >
                                图片/贴纸
                            </button>
                        </div>

                        <div className={settings.maskMode === 'line' ? 'animate-fade-in' : 'hidden'}>
                            <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-3">
                                <span className="text-sm text-gray-500">形状样式</span>
                                <div className="flex items-center gap-4 text-sm">
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="lineStyle"
                                            checked={settings.lineStyle === 'cross'} 
                                            onChange={() => update('lineStyle', 'cross')} 
                                            className="accent-[#FF3B30]" 
                                        /> 
                                        <span>❌ 交叉</span>
                                    </label>
                                    <label className="flex items-center gap-1 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="lineStyle"
                                            checked={settings.lineStyle === 'slash'} 
                                            onChange={() => update('lineStyle', 'slash')} 
                                            className="accent-[#FF3B30]" 
                                        /> 
                                        <span>╱ 斜线</span>
                                    </label>
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-2">
                                 <span className="text-sm text-gray-500 w-20">颜色/粗细</span>
                                 <div className="flex items-center flex-1 gap-3">
                                     <input type="color" value={settings.maskColor} onChange={e => update('maskColor', e.target.value)} className="w-8 h-8 rounded-full border border-gray-200 shrink-0" />
                                     <div className="flex-1 h-8 flex items-center">
                                         <input type="range" min="1" max="20" value={settings.maskWidth} onChange={e => update('maskWidth', parseInt(e.target.value))} className="w-full" />
                                     </div>
                                 </div>
                            </div>
                        </div>

                        <div className={settings.maskMode === 'image' ? 'animate-fade-in' : 'hidden'}>
                            <button className="w-full py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 text-sm mb-3 active:bg-gray-50 relative">
                                {settings.stickerImage ? settings.stickerImage.name : '+ 上传遮挡图 (Logo/贴纸)'}
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) update('stickerImage', e.target.files[0]);
                                    }}
                                />
                            </button>
                            
                            <div className="flex gap-4 mb-1">
                                <div 
                                    className="w-24 h-24 checkered-bg rounded-lg overflow-hidden border border-gray-200 shrink-0 relative cursor-pointer active:scale-95 transition shadow-sm"
                                    onClick={onEnlargePreview}
                                >
                                    <canvas 
                                        ref={canvasRef} 
                                        width={300} 
                                        height={300} 
                                        className="w-full h-full object-contain"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 hover:opacity-100 transition">
                                        <Maximize2 className="text-white drop-shadow-md" size={24} />
                                    </div>
                                </div>
                                <div className="flex-1 flex flex-col justify-center space-y-4">
                                    <div className="flex items-center text-xs text-gray-500">
                                        <span className="w-8 text-right mr-3">大小</span> 
                                        <input type="range" min="10" max="200" value={settings.stickerSize} onChange={e=>update('stickerSize', parseInt(e.target.value))} className="flex-1" />
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500">
                                        <span className="w-8 text-right mr-3">左右</span> 
                                        <input type="range" min="0" max="100" value={settings.stickerX} onChange={e=>update('stickerX', parseInt(e.target.value))} className="flex-1" />
                                    </div>
                                    <div className="flex items-center text-xs text-gray-500">
                                        <span className="w-8 text-right mr-3">上下</span> 
                                        <input type="range" min="0" max="100" value={settings.stickerY} onChange={e=>update('stickerY', parseInt(e.target.value))} className="flex-1" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 pt-0 grid grid-cols-2 gap-3 bg-white pb-4">
                        <button onClick={() => onGenerateMasked('apply')} className="py-3 rounded-xl bg-[#007AFF]/10 active:bg-[#007AFF]/20 text-[#007AFF] font-bold text-[15px] transition-all flex items-center justify-center gap-1">✨ 生成/更新</button>
                        <button onClick={() => onGenerateMasked('repack')} className="py-3 rounded-xl bg-[#FF3B30]/10 active:bg-[#FF3B30]/20 text-[#FF3B30] font-bold text-[15px] transition-all flex items-center justify-center gap-1">🔄 剔除并重排</button>
                    </div>
                </div>
            </Accordion>
        </>
    );
};
