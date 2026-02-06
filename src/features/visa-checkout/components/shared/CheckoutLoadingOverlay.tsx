import { ShieldCheck } from 'lucide-react';

interface CheckoutLoadingOverlayProps {
    message?: string;
    subMessage?: string;
}

export const CheckoutLoadingOverlay: React.FC<CheckoutLoadingOverlayProps> = ({
    message = 'Preparing Your Checkout...',
    subMessage = 'Please wait while we set up your secure payment session. You will be redirected shortly.'
}) => {
    return (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col items-center justify-center text-center p-4 backdrop-blur-sm animate-in fade-in duration-500">
            <div className="relative inline-block mb-10">
                {/* Visual pulse glow */}
                <div className="absolute inset-0 bg-gold-medium/20 blur-3xl rounded-full scale-150 animate-pulse"></div>

                {/* The Loader Gold (Hourglass) Animation */}
                <div className="relative flex items-center justify-center">
                    <div className="loader-gold"></div>
                </div>
            </div>

            <div className="max-w-md space-y-4">
                <h1 className="text-3xl font-bold migma-gold-text mb-2 tracking-tight">
                    {message}
                </h1>

                <p className="text-gray-300 text-lg leading-relaxed">
                    {subMessage}
                </p>

                <div className="mt-12 space-y-6">
                    <div className="flex items-center justify-center gap-3 text-gold-light/80 bg-gold-medium/5 border border-gold-medium/20 px-6 py-3 rounded-full">
                        <ShieldCheck className="w-5 h-5" />
                        <span className="text-sm font-semibold uppercase tracking-widest">Secure Connection Active</span>
                    </div>

                    <div className="flex flex-col items-center gap-3">
                        <p className="text-zinc-500 text-xs font-medium uppercase tracking-tighter">
                            Do not refresh or close this window
                        </p>
                        <div className="flex gap-2">
                            <div className="w-2 h-2 bg-gold-medium rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-gold-medium rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-gold-medium rounded-full animate-bounce"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
