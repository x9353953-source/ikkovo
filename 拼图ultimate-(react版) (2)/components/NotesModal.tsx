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
                    <p>1. 建议使用 <b>Edge</b> 浏览器以获得最佳体验。</p>
                    <p>2. 如果图片超过 100 张，生成过程可能会有短暂卡顿。甚至第一组拼图是全黑色，如果遇到重新拼图。</p>
                    <p>3. 多组图片导出，受浏览器影响，可能不会全部下载完图片。请尝试使用“打包下载(ZIP)”功能。</p>
                    <p>4. ❗️❗️❗️多图一定要调一下画质，不然图片太大了❗️调30%也不影响看图❗️❗️❗️</p>
                    <p>5. 老师们有时间可以找平替一些原因我可能会删链接，，，:0❗️</p>
                    <p>6. ❗️超过一百张图不会合并生成一张拼图， 请自行填写行列，分多张图导出❗️</p>
                    <p>7. 可在Edge浏览器选择 <b>添加到手机</b> 安装到主屏幕，不用再点链接打开</p>
                </div>
                <div className="flex items-center gap-3 mt-2">
                    <button onClick={onPermanentClose} className="text-xs text-gray-400 font-medium py-2 px-2 active:text-gray-600 transition">不再显示</button>
                    <button onClick={onClose} className="flex-1 bg-[#007AFF] text-white text-[15px] font-bold py-3 rounded-xl shadow-lg shadow-blue-500/30 active:scale-95 transition">我知道了</button>
                </div>
            </div>
        </div>
    );
};