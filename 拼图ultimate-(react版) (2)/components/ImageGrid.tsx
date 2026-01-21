
import React, { useState } from 'react';
import { ImageItem } from '../types';
import { X, RefreshCcw, Trash2, Replace, ChevronDown } from 'lucide-react';

interface Props {
    images: ImageItem[];
    onRemove: (id: string) => void;
    onClear: () => void;
    onAdd: () => void;
    onReplace: (id: string) => void;
    onRemoveDuplicates: () => void;
    duplicatesCount: number;
}

export const ImageGrid: React.FC<Props> = React.memo(({ images, onRemove, onClear, onAdd, onReplace, onRemoveDuplicates, duplicatesCount }) => {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <div className="bg-white rounded-xl overflow-hidden shadow-sm mb-5">
            <div 
                className="flex justify-between items-center p-4 bg-white border-b border-gray-100 cursor-pointer select-none active:bg-gray-50 transition"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <span className="text-[13px] text-gray-500 uppercase font-medium pl-1">
                    已导入 <span className="font-bold text-black">{images.length}</span> 张
                </span>
                <div className="flex items-center gap-3">
                    {images.length > 0 && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onClear(); }} 
                            className="text-[#FF3B30] text-[13px] active:opacity-50 transition font-medium px-2"
                        >
                            清空
                        </button>
                    )}
                    <ChevronDown size={18} className={`text-gray-400 transition-transform duration-300 ${isCollapsed ? '' : 'rotate-180'}`} />
                </div>
            </div>
            
            {!isCollapsed && (
                <>
                {/* Duplicate Alert */}
                {duplicatesCount > 0 && (
                    <div className="mx-4 mt-4 bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-700 flex items-start gap-2">
                        <span>发现 <span className="font-bold">{duplicatesCount}</span> 张重复图片：</span>
                        <button onClick={onRemoveDuplicates} className="underline text-yellow-800 font-bold ml-1">
                            一键去重
                        </button>
                    </div>
                )}
                
                <div className="p-4 bg-white max-h-[300px] overflow-y-auto no-scrollbar">
                    {images.length === 0 ? (
                        <div onClick={onAdd} className="flex flex-col items-center justify-center py-8 space-y-3 cursor-pointer hover:bg-gray-50 rounded-xl transition">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            </div>
                            <span className="text-gray-400 text-sm">点击添加图片</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                             {images.map((img, idx) => (
                                 <div 
                                    key={img.id} 
                                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 border border-gray-100 group cursor-pointer"
                                    style={{ contentVisibility: 'auto', containIntrinsicSize: '100px' }}
                                    onClick={() => setSelectedId(img.id)}
                                 >
                                    <img 
                                        src={img.url} 
                                        className="w-full h-full object-cover pointer-events-none" 
                                        loading="lazy" 
                                        alt="thumb" 
                                    />
                                    <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1.5 rounded-tl-md">
                                        {idx + 1}
                                    </div>
                                 </div>
                             ))}
                             <div onClick={onAdd} className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 cursor-pointer hover:border-[#007AFF] hover:text-[#007AFF] transition">
                                <span className="text-2xl">+</span>
                             </div>
                        </div>
                    )}
                </div>
                </>
            )}

            {/* Image Action Sheet/Modal */}
            {selectedId && (
                <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedId(null)}>
                    <div className="bg-white w-full max-w-sm rounded-2xl p-4 space-y-3 shadow-2xl mb-4 sm:mb-0" onClick={e => e.stopPropagation()}>
                        <div className="text-center text-gray-400 text-sm font-medium pb-2 border-b border-gray-100">图片操作</div>
                        <button onClick={() => { onReplace(selectedId); setSelectedId(null); }} className="w-full bg-blue-50 text-[#007AFF] font-bold text-[16px] py-3.5 rounded-xl active:bg-blue-100 transition flex items-center justify-center gap-2">
                            <Replace size={18} /> 替换图片
                        </button>
                        <button onClick={() => { onRemove(selectedId); setSelectedId(null); }} className="w-full bg-red-50 text-[#FF3B30] font-bold text-[16px] py-3.5 rounded-xl active:bg-red-100 transition flex items-center justify-center gap-2">
                            <Trash2 size={18} /> 删除图片
                        </button>
                        <button onClick={() => setSelectedId(null)} className="w-full bg-white border border-gray-200 text-black font-semibold text-[16px] py-3.5 rounded-xl mt-2 active:bg-gray-50">
                            取消
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});
