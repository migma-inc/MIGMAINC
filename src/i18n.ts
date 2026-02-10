import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import ptTranslations from './locales/pt.json';
import esTranslations from './locales/es.json';
import frTranslations from './locales/fr.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            en: { translation: enTranslations },
            pt: { translation: ptTranslations },
            es: { translation: esTranslations },
            fr: { translation: frTranslations },
        },
        fallbackLng: 'pt',
        interpolation: {
            escapeValue: false,
        },
        detection: {
            order: ['querystring', 'localStorage', 'navigator'],
            caches: ['localStorage'],
        },
    });

export default i18n;
