import React, { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, X } from 'lucide-react'; // Using Lucide for some icons if needed, but sticking to SVGs for main ones

interface ZelleUploadProps {
    onFileSelect: (file: File) => void;
    currentFile: File | null;
    onClear: () => void;
}

export const ZelleUpload: React.FC<ZelleUploadProps> = ({ onFileSelect, currentFile, onClear }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragOver, setIsDragOver] = useState(false);

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
        // Basic validation (image or pdf)
        const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (validTypes.includes(file.type)) {
            onFileSelect(file);
        } else {
            alert('Please upload an image or PDF file.');
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current?.click();
    };

    // Colors: Gold #CE9F48 (rgb 206, 159, 72)
    // Light Gold Background: #FFF8E1 approx or #feedd6

    return (
        <div className="w-full max-w-[500px] mx-auto bg-white rounded-lg shadow-[0_5px_15px_rgba(0,0,0,0.2)] overflow-hidden font-sans">
            {/* Header */}
            <div className="flex items-start justify-between p-6 pb-4">
                <div className="w-14 h-14 flex justify-center items-center rounded-full bg-[#FFF4DC]">
                    {/* Folder Icon SVG */}
                    <svg xmlns="http://www.w3.org/2000/svg" width={25} height={25} viewBox="0 0 512 419.116" className="fill-[#CE9F48]">
                        <g>
                            <path d="M16.991,419.116A16.989,16.989,0,0,1,0,402.125V16.991A16.989,16.989,0,0,1,16.991,0H146.124a17,17,0,0,1,10.342,3.513L227.217,57.77H437.805A16.989,16.989,0,0,1,454.8,74.761v53.244h40.213A16.992,16.992,0,0,1,511.6,148.657L454.966,405.222a17,17,0,0,1-16.6,13.332H410.053v.562ZM63.06,384.573H424.722L473.86,161.988H112.2Z" strokeWidth={1} stroke="currentColor" />
                        </g>
                    </svg>
                </div>
                {currentFile && (
                    <button onClick={onClear} className="w-9 h-9 flex items-center justify-center rounded bg-transparent hover:bg-[#FFF4DC] text-gray-500 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                )}
            </div>

            {/* Body */}
            <div className="p-6 pt-0">
                <p className="font-bold text-xl text-gray-900">Upload Receipt</p>
                <p className="text-gray-500 mb-4 text-sm mt-1">
                    {currentFile ? 'File selected successfully' : 'Attach the Zelle payment receipt below'}
                </p>

                {currentFile ? (
                    <div className="bg-[#FFF4DC] border border-[#CE9F48] rounded-lg p-6 flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                        <CheckCircle2 className="w-12 h-12 text-[#CE9F48] mb-2" />
                        <p className="font-bold text-[#CE9F48] break-all text-center">{currentFile.name}</p>
                        <p className="text-xs text-gray-500 mt-1">{(currentFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            onClick={triggerFileSelect}
                            className="mt-4 text-sm font-bold text-[#CE9F48] hover:underline"
                        >
                            Change File
                        </button>
                    </div>
                ) : (
                    <div
                        className={cn(
                            "mt-2 w-full flex flex-col items-center p-12 border-2 border-dashed transition-all duration-300 cursor-pointer group",
                            isDragOver ? "border-[#CE9F48] bg-[#FFF4DC]/30 scale-[1.02]" : "border-gray-300 bg-transparent hover:border-[#CE9F48] hover:bg-gray-50"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={triggerFileSelect}
                    >
                        {/* Cloud Icon SVG */}
                        <div className="mb-4 transition-transform duration-300 group-hover:scale-110">
                            <svg xmlns="http://www.w3.org/2000/svg" width={35} height={35} viewBox="0 0 340.531 419.116" className="fill-[#CE9F48]">
                                <g>
                                    <path d="M-2904.708-8.885A39.292,39.292,0,0,1-2944-48.177V-388.708A39.292,39.292,0,0,1-2904.708-428h209.558a13.1,13.1,0,0,1,9.3,3.8l78.584,78.584a13.1,13.1,0,0,1,3.8,9.3V-48.177a39.292,39.292,0,0,1-39.292,39.292Zm-13.1-379.823V-48.177a13.1,13.1,0,0,0,13.1,13.1h261.947a13.1,13.1,0,0,0,13.1-13.1V-323.221h-52.39a26.2,26.2,0,0,1-26.194-26.195v-52.39h-196.46A13.1,13.1,0,0,0-2917.805-388.708Zm146.5,241.621a14.269,14.269,0,0,1-7.883-12.758v-19.113h-68.841c-7.869,0-7.87-47.619,0-47.619h68.842v-18.8a14.271,14.271,0,0,1,7.882-12.758,14.239,14.239,0,0,1,14.925,1.354l57.019,42.764c.242.185.328.485.555.671a13.9,13.9,0,0,1,2.751,3.292,14.57,14.57,0,0,1,.984,1.454,14.114,14.114,0,0,1,1.411,5.987,14.006,14.006,0,0,1-1.411,5.973,14.653,14.653,0,0,1-.984,1.468,13.9,13.9,0,0,1-2.751,3.293c-.228.2-.313.485-.555.671l-57.019,42.764a14.26,14.26,0,0,1-8.558,2.847A14.326,14.326,0,0,1-2771.3-147.087Z" transform="translate(2944 428)" />
                                </g>
                            </svg>
                        </div>
                        <span className="block font-bold text-[#0d0f21] mb-1">Drag file(s) here to upload.</span>
                        <span className="block text-gray-500 text-sm text-center">
                            Alternatively, you can select a file by <br />
                            <strong className="text-[#CE9F48] font-bold">clicking here</strong>
                        </span>
                    </div>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,.pdf" // Match existing constraint
                className="hidden"
            />

            {/* Footer space matching the card design but empty/minimal */}
            <div className="p-6 pt-2 flex justify-end">
                {/* No buttons here, main form button handles submission */}
            </div>
        </div>
    );
};
