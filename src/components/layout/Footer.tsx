import { Link } from 'react-router-dom';

export const Footer = () => {
    return (
        <footer className="bg-black text-gold-light/70 text-sm py-10">
            <div className="container">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                    {/* Logo and Copyright */}
                    <div className="flex flex-col items-center md:items-start">
                        <Link to="/" className="inline-flex mb-4">
                            <img src="/logo2.png" alt="MIGMA INC" className="h-16 md:h-20 w-auto" />
                        </Link>
                        <p className="text-gray-400">&copy; 2025 MIGMA INC. All rights reserved.</p>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex flex-col md:flex-row gap-6 md:gap-8">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                            <Link to="/" className="transition hover:text-gold-medium text-center md:text-left">
                                Home
                            </Link>
                            <Link to="/services" className="transition hover:text-gold-medium text-center md:text-left">
                                Services
                            </Link>
                            <Link to="/about" className="transition hover:text-gold-medium text-center md:text-left">
                                About
                            </Link>
                            <Link to="/contact" className="transition hover:text-gold-medium text-center md:text-left">
                                Contact
                            </Link>
                            <Link to="/global-partner" className="transition hover:text-gold-medium text-center md:text-left">
                                Global Partner
                            </Link>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 border-t md:border-t-0 md:border-l border-gold-medium/30 pt-4 md:pt-0 md:pl-6">
                            <Link to="/legal/privacy-policy" className="transition hover:text-gold-medium text-center md:text-left">
                                Privacy Policy
                            </Link>
                            <Link to="/legal/website-terms" className="transition hover:text-gold-medium text-center md:text-left">
                                Website Terms
                            </Link>
                            <Link to="/legal/cookies" className="transition hover:text-gold-medium text-center md:text-left">
                                Cookies
                            </Link>
                            <Link to="/legal/global-partner-terms" className="transition hover:text-gold-medium text-center md:text-left">
                                Partner Terms
                            </Link>
                        </div>
                    </nav>
                </div>
            </div>
        </footer>
    );
};


