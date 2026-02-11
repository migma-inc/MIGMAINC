import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const languages = [
    { code: 'pt', name: 'Português', flag: '🇧🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  const currentLanguage = languages.find((lang) => lang.code === i18n.language) || languages[0];

  return (
    <div className="flex items-center gap-2">
      <Select value={i18n.language} onValueChange={handleLanguageChange}>
        <SelectTrigger className="w-[140px] h-9 bg-zinc-900/50 border-gold-medium/30 text-white hover:border-gold-medium transition-colors">
          <SelectValue>
            <span className="flex items-center gap-2">
              <span className="text-base">{currentLanguage.flag}</span>
              <span className="font-medium">{currentLanguage.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-gold-medium/30 text-white">
          {languages.map((lang) => (
            <SelectItem 
              key={lang.code} 
              value={lang.code}
              className="focus:bg-gold-medium/10 focus:text-gold-light cursor-pointer transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{lang.flag}</span>
                <span className="font-medium">{lang.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};
