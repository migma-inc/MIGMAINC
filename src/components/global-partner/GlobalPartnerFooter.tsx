import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface GlobalPartnerFooterProps {
    scrollToForm: () => void;
}

export const GlobalPartnerFooter = ({ scrollToForm }: GlobalPartnerFooterProps) => {
    const { t } = useTranslation();
    return (
        <footer className="bg-black text-gold-light/70 text-sm py-10">
            <div className="container">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
                    {/* Logo and Copyright */}
                    <div className="flex flex-col items-center md:items-start">
                        <Link to="/" className="inline-flex mb-4">
                            <img src="/logo2.png" alt="MIGMA INC" className="h-16 md:h-20 w-auto" />
                        </Link>
                        <p className="text-gray-400">&copy; MIGMA INC. {t('global_partner.footer.all_rights_reserved', 'All rights reserved.')}</p>
                    </div>

                    {/* Navigation Links */}
                    <nav className="flex flex-col md:flex-row gap-6 md:gap-8">
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                            <Link to="/" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.home', 'Home')}
                            </Link>
                            <Link to="/services" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.services', 'Services')}
                            </Link>
                            <Link to="/about" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.about', 'About')}
                            </Link>
                            <Link to="/contact" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.contact', 'Contact')}
                            </Link>
                            <a href="#benefits" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.nav.benefits', 'Benefits')}
                            </a>
                            <a href="#how-it-works" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.nav.how_it_works', 'How it works')}
                            </a>
                            <button
                                onClick={scrollToForm}
                                className="transition hover:text-gold-medium text-center md:text-left bg-transparent border-none p-0 cursor-pointer"
                            >
                                {t('global_partner.footer.apply', 'Apply')}
                            </button>
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 md:gap-6 border-t md:border-t-0 md:border-l border-gold-medium/30 pt-4 md:pt-0 md:pl-6">
                            <Link to="/legal/privacy-policy" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.privacy_policy', 'Privacy Policy')}
                            </Link>
                            <Link to="/legal/website-terms" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.website_terms', 'Website Terms')}
                            </Link>
                            <Link to="/legal/cookies" className="transition hover:text-gold-medium text-center md:text-left">
                                {t('global_partner.footer.cookies', 'Cookies')}
                            </Link>
                        </div>
                    </nav>
                </div>
            </div>
        </footer>
    );
};
