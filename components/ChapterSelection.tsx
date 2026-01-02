import React from 'react';
import { Chapter, Subject, ClassLevel, User, SystemSettings } from '../types';
import { BookOpen, ChevronRight, Lock, CheckCircle, PlayCircle, Clock } from 'lucide-react';

interface Props {
  chapters: Chapter[];
  subject: Subject;
  classLevel: ClassLevel;
  loading: boolean;
  user: User | null;
  onSelect: (chapter: Chapter) => void;
  onBack: () => void;
}

export const ChapterSelection: React.FC<Props> = ({ 
  chapters, 
  subject, 
  classLevel, 
  loading, 
  user,
  onSelect, 
  onBack 
}) => {
  
  // Get settings from local storage directly if not passed prop, or assume App passes settings in real app structure
  // Ideally this component should receive settings as prop, but I'll read from localStorage for consistency with other deep components if prop isn't available
  // Or better, let's just read from localStorage here as a fallback since App.tsx might not be passing it down yet
  let settings: SystemSettings | null = null;
  try {
      const s = localStorage.getItem('nst_system_settings');
      if (s) settings = JSON.parse(s);
  } catch(e){}

  const restrictionEnabled = settings?.enableMcqUnlockRestriction !== false; // Default TRUE

  // Get current progress for this subject
  const userProgress = user?.progress?.[subject.id] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="animate-in fade-in slide-in-from-right-8 duration-500 max-w-4xl mx-auto">
       <div className="flex items-center mb-8 sticky top-0 bg-slate-50 py-4 z-10">
        <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4 font-medium flex items-center gap-1">
           Back
        </button>
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
             <span>Class {classLevel}</span>
             <span>/</span>
             <span className="font-medium text-slate-700">{subject.name}</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Syllabus & Chapters</h2>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
             <div key={i} className="h-24 bg-white rounded-xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {chapters.map((chapter, index) => {
            // Logic for Lock/Unlock
            // If restriction is disabled, everything is unlocked (unless explicitly locked by admin)
            const isCompleted = restrictionEnabled ? index < userProgress.currentChapterIndex : false;
            const isCurrent = restrictionEnabled ? index === userProgress.currentChapterIndex : true; // All act as current/open if disabled
            
            // @ts-ignore
            const isExplicitlyLocked = chapter.isLocked === true;
            
            // Final Lock Logic
            const isLocked = !isAdmin && (
                isExplicitlyLocked || 
                (restrictionEnabled && index > userProgress.currentChapterIndex)
            );
            
            return (
              <button
                key={chapter.id}
                onClick={() => onSelect(chapter)}
                disabled={isLocked}
                className={`w-full p-5 rounded-xl border transition-all text-left flex items-center group relative overflow-hidden ${
                    isLocked 
                    ? 'bg-slate-100 border-slate-200 opacity-70 cursor-not-allowed' 
                    : isCurrent 
                        ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500' 
                        : 'bg-white border-slate-200 hover:border-blue-300'
                }`}
              >
                {/* Status Indicator Bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    isLocked ? 'bg-slate-300' : isCurrent ? 'bg-blue-600' : 'bg-green-500'
                }`}></div>

                <div className="mr-5 ml-2 min-w-[3.5rem] flex flex-col items-center">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">CH</span>
                   <span className={`text-2xl font-bold ${isCurrent ? 'text-blue-600' : isLocked ? 'text-slate-400' : 'text-green-600'}`}>
                       {(index + 1).toString().padStart(2, '0')}
                   </span>
                </div>
                
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                      <h3 className={`font-bold text-lg ${isLocked ? 'text-slate-500' : 'text-slate-800'}`}>
                          {chapter.title}
                      </h3>
                      {isCurrent && <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold animate-pulse">ROUTINE ACTIVE</span>}
                  </div>
                  
                  {isLocked ? (
                      <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
                          <Lock size={12} />
                          <span>
                              {isExplicitlyLocked 
                                ? "This content is currently locked by Admin." 
                                : "Complete previous chapter MCQs (100) to unlock"}
                          </span>
                      </div>
                  ) : isCurrent ? (
                      <div className="flex items-center gap-3 text-xs">
                          <span className={`font-bold ${userProgress.totalMCQsSolved < 100 ? 'text-orange-500' : 'text-green-600'}`}>
                             Target: {userProgress.totalMCQsSolved}/100 MCQs
                          </span>
                          <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${Math.min(userProgress.totalMCQsSolved, 100)}%` }}></div>
                          </div>
                      </div>
                  ) : (
                      <div className="text-xs text-green-600 font-bold flex items-center gap-1">
                          <CheckCircle size={12} /> Completed
                      </div>
                  )}
                </div>

                <div className="ml-2">
                  {isLocked ? (
                      <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center">
                          <Lock size={18} />
                      </div>
                  ) : isCurrent ? (
                      <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <PlayCircle size={20} />
                      </div>
                  ) : (
                      <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                          <BookOpen size={18} />
                      </div>
                  )}
                </div>
              </button>
            );
          })}
          
          {chapters.length === 0 && !loading && (
             <div className="text-center py-20 text-slate-400">
                <BookOpen size={48} className="mx-auto mb-4 opacity-50"/>
                <p>No chapters found. Please try refreshing.</p>
             </div>
          )}
        </div>
      )}
    </div>
  );
};