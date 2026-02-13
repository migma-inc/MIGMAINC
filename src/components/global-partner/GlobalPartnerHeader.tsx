import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';

interface GlobalPartnerHeaderProps {
    isScrolled: boolean;
}

export const GlobalPartnerHeader = ({ isScrolled }: GlobalPartnerHeaderProps) => {
    const { t } = useTranslation();

    return (
        <header className={`fixed top-0 left-0 right-0 backdrop-blur-sm z-50 transition-colors duration-300 ${isScrolled ? 'bg-black/95' : 'bg-transparent'}`}>
            <div className="container">
                <div className="flex justify-between items-center h-20 md:h-24">
                    {/* Logo Section */}
                    <Link to="/" className="inline-flex">
                        <img src="/logo2.png" alt="MIGMA INC" className="h-14 md:h-18 w-auto py-1" />
                    </Link>

                    {/* Navigation Section */}
                    <div className="flex items-center gap-4 md:gap-8">
                        <nav className="hidden md:flex gap-6 items-center text-white/80 text-sm">
                            <a href="#benefits" className="hover:text-gold-light transition-colors">{t('global_partner.nav.benefits', 'Benefits')}</a>
                            <a href="#how-it-works" className="hover:text-gold-light transition-colors">{t('global_partner.nav.how_it_works', 'How it works')}</a>
                            <a href="#application-form" className="btn btn-primary py-2 px-4 text-xs">{t('global_partner.nav.apply_now', 'Apply Now')}</a>
                        </nav>

                        {/* Language Selector */}
                        <div className="flex items-center">
                            <LanguageSelector />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};
