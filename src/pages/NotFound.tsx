import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';

export const NotFound = () => {
    return (
        <div className="min-h-screen bg-black font-sans text-foreground flex flex-col">
            {/* Header */}
            <Header />

            {/* 404 Content */}
            <main className="flex-grow flex items-center justify-center pt-[120px] pb-20 overflow-x-clip relative">

                <div className="container relative z-10">
                    <div className="max-w-2xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <h1 className="text-8xl md:text-[150px] font-bold tracking-tighter migma-gold-text mb-4 leading-none">
                                404
                            </h1>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 tracking-tight">
                                Page Not Found
                            </h2>
                            <div className="w-20 h-1 bg-gold-medium mx-auto mb-8 rounded-full"></div>

                            <p className="text-lg md:text-xl text-gray-400 mb-10 leading-relaxed max-w-lg mx-auto">
                                The resource you are looking for might have been removed, had its name changed, or is temporarily unavailable.
                                <span className="block mt-4 text-gold-light/80 font-medium">As a firm dedicated to operational excellence, we value your time.</span>
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                <Link to="/">
                                    <Button className="btn btn-primary text-lg px-10 py-7">
                                        Return to Homepage
                                    </Button>
                                </Link>
                                <Link to="/contact">
                                    <Button className="bg-transparent border border-gold-medium/30 text-gold-light hover:bg-gold-medium/10 transition-all text-lg px-10 py-7">
                                        Contact Support
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </main>

        </div>
    );
};
