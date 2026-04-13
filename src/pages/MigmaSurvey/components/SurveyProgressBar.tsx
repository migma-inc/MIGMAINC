import React from 'react';
import { Check } from 'lucide-react';
import type { SurveySection } from '../../../data/migmaSurveyQuestions';

interface Props {
  sections: SurveySection[];
  currentSectionIdx: number;
}

export const SurveyProgressBar: React.FC<Props> = ({ sections, currentSectionIdx }) => {
  return (
    <div className="bg-black/80 backdrop-blur-sm border-b border-white/5 sticky top-14 z-40">
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between relative">
          <div className="absolute left-0 right-0 top-4 h-px bg-white/10 z-0" />
          {sections.map((section, idx) => {
            const completed = idx < currentSectionIdx;
            const active = idx === currentSectionIdx;
            return (
              <div key={section.key} className="flex flex-col items-center gap-1.5 z-10 flex-1">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all
                  ${completed
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : active
                    ? 'bg-gold-medium border-gold-medium text-black'
                    : 'bg-[#111] border-white/20 text-gray-500'
                  }
                `}>
                  {completed ? <Check className="w-3.5 h-3.5" /> : section.key}
                </div>
                <span className={`text-[10px] font-semibold hidden sm:block text-center transition-colors leading-tight ${
                  active ? 'text-gold-medium' : completed ? 'text-emerald-400' : 'text-gray-600'
                }`}>
                  {section.title.split(' ').slice(0, 2).join(' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
