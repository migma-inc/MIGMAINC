/**
 * Utility for client-side image compression using Canvas.
 * This helps reduce the memory footprint on Supabase Edge Functions
 * and improves upload speed.
 */

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
}

export const compressImage = async (
    file: File,
    options: CompressionOptions = { maxWidth: 2000, maxHeight: 2000, quality: 0.8 }
): Promise<{ file: File; preview: string }> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate dimensions while maintaining aspect ratio
                if (width > height) {
                    if (width > (options.maxWidth || 2000)) {
                        height *= (options.maxWidth || 2000) / width;
                        width = options.maxWidth || 2000;
                    }
                } else {
                    if (height > (options.maxHeight || 2000)) {
                        width *= (options.maxHeight || 2000) / height;
                        height = options.maxHeight || 2000;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to get canvas context'));
                    return;
                }

                // Use high image smoothing quality
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';

                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob (always JPEG for best compression)
                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            reject(new Error('Canvas toBlob failed'));
                            return;
                        }

                        // Create new file from blob
                        const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });

                        // Create preview
                        const preview = canvas.toDataURL('image/jpeg', options.quality || 0.8);

                        resolve({ file: compressedFile, preview });
                    },
                    'image/jpeg',
                    options.quality || 0.8
                );
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};
