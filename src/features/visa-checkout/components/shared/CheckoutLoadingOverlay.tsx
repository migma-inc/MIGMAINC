import { Loader2, Clock, ShieldCheck } from 'lucide-react';

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

                {/* The Clock/Hourglass Animation the user likes */}
                <div className="relative">
                    <div className="w-28 h-28 border-4 border-gold-light/10 border-t-gold-medium rounded-full animate-spin duration-1000"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Clock className="w-14 h-14 text-gold-medium animate-pulse" />
                    </div>
                </div>

                {/* Small overlay loader */}
                <div className="absolute -bottom-2 -right-2 bg-black rounded-full p-1 border border-gold-medium/30">
                    <Loader2 className="w-6 h-6 text-gold-light animate-spin" />
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
