import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

export const Header = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const handleScroll = () => {
            const scrollPosition = window.scrollY;
            setIsScrolled(scrollPosition > 50);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isActive = (path: string) => {
        return location.pathname === path;
    };

    return (
        <header className={`fixed top-0 left-0 right-0 backdrop-blur-sm z-50 transition-colors duration-300 ${isScrolled ? 'bg-black/95' : 'bg-transparent'}`}>
            <div className={`py-3 transition-colors duration-300 ${isScrolled ? 'bg-black/95' : 'bg-transparent'}`}>
                <div className="container">
                    <div className="flex items-center justify-between">
                        <Link to="/" className="flex items-center gap-2">
                            <img 
                                src="/logo2.png" 
                                alt="MIGMA INC" 
                                className="h-16 md:h-20 w-auto"
                            />
                        </Link>
                        
                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            className={`md:hidden transition-colors duration-300 ${isScrolled ? 'text-gold-light' : 'text-white'}`}
                            aria-label="Toggle menu"
                        >
                            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {isMobileMenuOpen ? (
                                    <path d="M6 18L18 6M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                ) : (
                                    <path d="M3 12H21M3 6H21M3 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                )}
                            </svg>
                        </button>

                        {/* Desktop Navigation */}
                        <nav className={`hidden md:flex gap-6 items-center transition-colors duration-300 ${isScrolled ? 'text-gold-light' : 'text-gold-light'}`}>
                            <Link 
                                to="/" 
                                className={`transition hover:text-gold-medium ${isActive('/') ? 'text-gold-medium font-semibold' : ''}`}
                            >
                                Home
                            </Link>
                            <Link 
                                to="/services" 
                                className={`transition hover:text-gold-medium ${isActive('/services') ? 'text-gold-medium font-semibold' : ''}`}
                            >
                                Services
                            </Link>
                            <Link 
                                to="/about" 
                                className={`transition hover:text-gold-medium ${isActive('/about') ? 'text-gold-medium font-semibold' : ''}`}
                            >
                                About
                            </Link>
                            <Link 
                                to="/contact" 
                                className={`transition hover:text-gold-medium ${isActive('/contact') ? 'text-gold-medium font-semibold' : ''}`}
                            >
                                Contact
                            </Link>
                            <Link 
                                to="/global-partner" 
                                className={`transition hover:text-gold-medium ${isActive('/global-partner') ? 'text-gold-medium font-semibold' : ''}`}
                            >
                                Global Partner
                            </Link>
                            <Link to="/book-a-call">
                                <button className="px-4 py-2 rounded-lg font-bold inline-flex items-center justify-center tracking-tight hover:opacity-90 transition shadow-lg" style={{ background: 'linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%)', color: '#000', WebkitTextFillColor: '#000', boxShadow: '0 4px 12px rgba(206, 159, 72, 0.4)' }}>
                                    Book a call
                                </button>
                            </Link>
                        </nav>
                    </div>

                    {/* Mobile Menu */}
                    {isMobileMenuOpen && (
                        <motion.nav
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden mt-4 pb-4 space-y-3"
                        >
                            <Link 
                                to="/" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2 transition hover:text-gold-medium ${isActive('/') ? 'text-gold-medium font-semibold' : 'text-gold-light'}`}
                            >
                                Home
                            </Link>
                            <Link 
                                to="/services" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2 transition hover:text-gold-medium ${isActive('/services') ? 'text-gold-medium font-semibold' : 'text-gold-light'}`}
                            >
                                Services
                            </Link>
                            <Link 
                                to="/about" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2 transition hover:text-gold-medium ${isActive('/about') ? 'text-gold-medium font-semibold' : 'text-gold-light'}`}
                            >
                                About
                            </Link>
                            <Link 
                                to="/contact" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2 transition hover:text-gold-medium ${isActive('/contact') ? 'text-gold-medium font-semibold' : 'text-gold-light'}`}
                            >
                                Contact
                            </Link>
                            <Link 
                                to="/global-partner" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={`block py-2 transition hover:text-gold-medium ${isActive('/global-partner') ? 'text-gold-medium font-semibold' : 'text-gold-light'}`}
                            >
                                Global Partner
                            </Link>
                            <Link 
                                to="/book-a-call" 
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block"
                            >
                                <button className="w-full px-4 py-2 rounded-lg font-bold inline-flex items-center justify-center tracking-tight hover:opacity-90 transition shadow-lg mt-2" style={{ background: 'linear-gradient(180deg, #F3E196 0%, #CE9F48 50%, #F3E196 100%)', color: '#000', WebkitTextFillColor: '#000', boxShadow: '0 4px 12px rgba(206, 159, 72, 0.4)' }}>
                                    Book a call
                                </button>
                            </Link>
                        </motion.nav>
                    )}
                </div>
            </div>
        </header>
    );
};


