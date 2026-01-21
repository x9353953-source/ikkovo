import React from 'react';
import { Info } from 'lucide-react';

interface Props {
    onClose: () => void;
    onPermanentClose: () => void;
}

export const NotesModal: React.FC<Props> = ({ onClose, onPermanentClose }) => {
    return (
        <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div className="bg-white w-full max-w-[320px] rounded-2xl p-6 relative shadow-2xl transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-[#007AFF]">
                        <Info size={20} />
                    </div>
                    <h3 className="text-[18px] font-bold text-gray-900">使用须知</h3>
                </div>
                <div className="text-[14px] text-gray-600 leading-relaxed mb-6 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    <p>1. 使用 <b>Edge</b> 浏览器。不同浏览器有不同问题，在edg目前我使用不会卡顿。有些浏览器不能多图导入。目前只用过edg浏览器</p>
                    <p>2. 这个版本可拼一百张以上图合成一张图 不过要设置行列。比如200图，你要合成一张长图，就要设置15*15</p>
                    
                    <p>3. ❗️❗️❗️多图一定要调一下画质，不然图片太大了❗️调30%也不影响看图❗️❗️❗️</p>
                    <p>4.禁止二传，不要什么都想着分享❗️</p>
                    
                    <p>5. 可在Edge浏览器选择 <b>添加到手机</b> 安装到主屏幕，不用再点链接打开</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <button onClick={onPermanentClose} className="text-xs text-gray-400 font-medium py-2 px-2 active:text-gray-600 transition">不再显示</button>
                    <button onClick={onClose} className="flex-1 bg-[#007AFF] text-white text-[15px] font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition">我知道了</button>
                </div>
            </div>
        </div>
    );
};
