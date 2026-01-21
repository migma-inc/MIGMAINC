import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, X, Info, Mail, AlertTriangle, Lightbulb, Copy, Check } from 'lucide-react';

interface ZelleUploadProps {
    onFileSelect: (file: File) => void;
    currentFile: File | null;
    onClear: () => void;
}

export const ZelleUpload: React.FC<ZelleUploadProps> = ({ onFileSelect, currentFile, onClear }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText('adm@migmainc.com');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragOver(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            validateAndSelect(files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateAndSelect(e.target.files[0]);
        }
    };

    const validateAndSelect = (file: File) => {
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (validTypes.includes(file.type)) {
            onFileSelect(file);
        } else {
            alert('Please upload an image (PNG/JPG) or PDF file.');
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="w-full max-w-[650px] mx-auto space-y-6 font-sans">
            {/* 1. Recipient Information Card */}
            <div className="bg-gradient-to-br from-gold-light/20 to-gold-dark/10 border border-gold-medium/30 rounded-xl overflow-hidden shadow-xl">
                <div className="bg-gold-medium/10 p-4 border-b border-gold-medium/20 flex items-center gap-3">
                    <Mail className="w-5 h-5 text-gold-medium" />
                    <h3 className="font-bold text-white uppercase tracking-wider text-sm">Zelle Payment Details</h3>
                </div>
                <div className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-black/40 p-4 rounded-lg border border-white/5">
                        <div>
                            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Recipient Email</p>
                            <p className="text-xl font-mono font-bold text-gold-light select-all">adm@migmainc.com</p>
                        </div>
                        <button
                            onClick={handleCopyEmail}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-300 font-bold text-xs uppercase tracking-wider",
                                copied
                                    ? "bg-green-500/20 border-green-500/50 text-green-400"
                                    : "bg-gold-medium/20 border-gold-medium/30 text-gold-light hover:bg-gold-medium/30"
                            )}
                        >
                            {copied ? (
                                <>
                                    <Check className="w-3.5 h-3.5" />
                                    Copied
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3.5 h-3.5" />
                                    Copy
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* 2. Instructions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Steps Section */}
                <div className="bg-black/30 border border-white/10 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-gold-medium">
                        <Info className="w-4 h-4" />
                        <h4 className="font-bold text-sm uppercase">Instructions</h4>
                    </div>
                    <ul className="space-y-3">
                        <li className="flex gap-3 text-sm text-gray-300">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-medium/20 text-gold-medium flex items-center justify-center text-xs font-bold border border-gold-medium/30">1</span>
                            <span>Complete the Zelle transfer with the exact amount in your banking app.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-gray-300">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-medium/20 text-gold-medium flex items-center justify-center text-xs font-bold border border-gold-medium/30">2</span>
                            <span>Take a print/screenshot of the <strong>confirmation screen</strong> immediately after sending.</span>
                        </li>
                        <li className="flex gap-3 text-sm text-gray-300">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gold-medium/20 text-gold-medium flex items-center justify-center text-xs font-bold border border-gold-medium/30">3</span>
                            <span>Upload the image below for automatic processing.</span>
                        </li>
                    </ul>
                </div>

                {/* Tips Section */}
                <div className="bg-gold-medium/5 border border-gold-medium/20 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-gold-medium">
                        <Lightbulb className="w-4 h-4" />
                        <h4 className="font-bold text-sm uppercase">Important Tips</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <p className="text-xs text-red-200 leading-relaxed font-medium">
                                <AlertTriangle className="w-3 h-3 inline-block mr-1 text-red-400" />
                                <strong>DO NOT send the bank's PDF receipt</strong>. Use only app screenshots to speed up verification.
                            </p>
                        </div>
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            The image must show: Confirmation Code, Date, Exact Amount, and Recipient (adm@migmainc.com).
                        </p>
                    </div>
                </div>
            </div>

            {/* 3. Upload Area Card */}
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
                <div className="flex items-start justify-between p-6 pb-2">
                    <div className="w-12 h-12 flex justify-center items-center rounded-xl bg-gold-medium/10 text-gold-medium">
                        <svg xmlns="http://www.w3.org/2000/svg" width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    {currentFile && (
                        <button onClick={onClear} className="p-2 rounded-full hover:bg-red-50 text-red-400 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                <div className="p-6 pt-0">
                    <h3 className="font-bold text-xl text-gray-900">Attach Receipt</h3>
                    <p className="text-gray-500 mb-6 text-sm">
                        {currentFile ? 'Document selected successfully!' : 'Select or drag the payment screenshot.'}
                    </p>

                    {currentFile ? (
                        <div className="bg-gold-medium/5 border-2 border-dashed border-gold-medium/40 rounded-xl p-8 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                            <div className="bg-gold-medium text-white p-3 rounded-full mb-4 shadow-lg shadow-gold-medium/30">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <p className="font-bold text-gray-900 break-all text-center max-w-full">{currentFile.name}</p>
                            <p className="text-xs text-gray-500 mt-1 uppercase font-bold tracking-widest">{(currentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                            <button
                                onClick={triggerFileSelect}
                                className="mt-6 px-6 py-2 rounded-full border border-gold-medium text-gold-medium font-bold text-sm hover:bg-gold-medium hover:text-white transition-all"
                            >
                                Change File
                            </button>
                        </div>
                    ) : (
                        <div
                            className={cn(
                                "relative w-full flex flex-col items-center p-12 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer group",
                                isDragOver
                                    ? "border-gold-medium bg-gold-medium/5 scale-[1.01]"
                                    : "border-gray-200 bg-gray-50/50 hover:border-gold-medium/50 hover:bg-gold-medium/[0.02]"
                            )}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={triggerFileSelect}
                        >
                            <div className="mb-4 p-4 rounded-full bg-white shadow-md group-hover:scale-110 transition-transform duration-300">
                                <svg xmlns="http://www.w3.org/2000/svg" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#CE9F48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                    <polyline points="21 15 16 10 5 21" />
                                </svg>
                            </div>
                            <span className="block font-bold text-gray-900 mb-1 text-center">Drag receipt here</span>
                            <span className="block text-gray-500 text-sm text-center">
                                Or click to <strong className="text-gold-medium font-bold">select a file</strong>
                            </span>
                            <p className="mt-4 text-[10px] text-gray-400 uppercase font-bold tracking-widest">Accepted formats: JPG, PNG, PDF</p>
                        </div>
                    )}
                </div>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
            />
        </div >
    );
};
