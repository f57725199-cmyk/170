import React, { useState, useEffect } from 'react';
import { LessonContent, User, SystemSettings } from '../types';
import { BookOpen, Calendar, ChevronDown, ChevronUp, Trash2, Search, FileText, CheckCircle2, Lock } from 'lucide-react';
import { LessonView } from './LessonView';
import { saveUserToLive } from '../firebase';
import { CustomAlert, CustomConfirm } from './CustomDialogs';

interface Props {
    user: User;
    onUpdateUser: (u: User) => void;
    settings?: SystemSettings;
}

export const HistoryPage: React.FC<Props> = ({ user, onUpdateUser, settings }) => {
  const [history, setHistory] = useState<LessonContent[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedLesson, setSelectedLesson] = useState<LessonContent | null>(null);
  
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, message: string, onConfirm: () => void}>({
      isOpen: false, 
      message: '', 
      onConfirm: () => {}
  });

  useEffect(() => {
    // Load history from local storage
    const stored = localStorage.getItem('nst_user_history');
    if (stored) {
        try {
            setHistory(JSON.parse(stored).reverse()); // Newest first
        } catch (e) { console.error("History parse error", e); }
    }
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setConfirmConfig({
        isOpen: true,
        message: "Delete this note?",
        onConfirm: () => {
            const updated = history.filter(h => h.id !== id);
            setHistory(updated);
            localStorage.setItem('nst_user_history', JSON.stringify(updated.reverse())); // Re-reverse for storage
            if (selectedLesson?.id === id) setSelectedLesson(null);
        }
    });
  };

  const executeOpenItem = (item: LessonContent, cost: number) => {
      if (cost > 0) {
          const updatedUser = { ...user, credits: user.credits - cost };
          onUpdateUser(updatedUser);
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser);
      }
      setSelectedLesson(item);
  };

  const handleOpenItem = (item: LessonContent) => {
      // 1. Check Cost
      // If it's an MCQ type and there is a cost configured
      if (item.type.includes('MCQ')) {
          const cost = settings?.mcqHistoryCost ?? 1;
          
          if (cost > 0) {
              // 2. Check Exemption (Admin or Premium)
              const isExempt = user.role === 'ADMIN' || 
                              (user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date());
              
              if (!isExempt) {
                  if (user.credits < cost) {
                      setAlertConfig({isOpen: true, message: `Insufficient Credits! Viewing history costs ${cost} coins.`});
                      return;
                  }
                  
                  setConfirmConfig({
                      isOpen: true,
                      message: `View Result for ${cost} Credits?`,
                      onConfirm: () => executeOpenItem(item, cost)
                  });
                  return;
              }
          }
      }
      
      executeOpenItem(item, 0);
  };

  const filteredHistory = history.filter(h => 
    h.title.toLowerCase().includes(search.toLowerCase()) || 
    h.subjectName.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedLesson) {
      return (
          <div className="animate-in slide-in-from-right duration-300">
              <button 
                onClick={() => setSelectedLesson(null)}
                className="mb-4 text-blue-600 font-bold hover:underline flex items-center gap-1"
              >
                  &larr; Back to History
              </button>
              {/* Reuse LessonView but mock props usually passed from API */}
              <LessonView 
                 content={selectedLesson}
                 subject={{id: 'hist', name: selectedLesson.subjectName, icon: 'book', color: 'bg-slate-100'}} 
                 classLevel={'10'} // Display only
                 chapter={{id: 'hist', title: selectedLesson.title}}
                 loading={false}
                 onBack={() => setSelectedLesson(null)}
              />
          </div>
      )
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        <CustomAlert 
            isOpen={alertConfig.isOpen} 
            message={alertConfig.message} 
            onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
        />
        <CustomConfirm
            isOpen={confirmConfig.isOpen}
            message={confirmConfig.message}
            onConfirm={() => {
                confirmConfig.onConfirm();
                setConfirmConfig({...confirmConfig, isOpen: false});
            }}
            onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
        />
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                 <FileText className="text-blue-600" /> Saved Notes (365 Days)
            </h3>
        </div>

        <div className="relative mb-6">
            <Search className="absolute left-3 top-3 text-slate-400" size={18} />
            <input 
                type="text" 
                placeholder="Search your notes..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
        </div>

        {filteredHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-slate-200">
                <BookOpen size={48} className="mx-auto mb-3 opacity-30" />
                <p>No saved notes yet. Start learning to build your library!</p>
            </div>
        ) : (
            <div className="space-y-4">
                {filteredHistory.map((item) => (
                    <div 
                        key={item.id} 
                        onClick={() => handleOpenItem(item)}
                        className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all cursor-pointer group relative"
                    >
                        {/* COST BADGE */}
                        {!user.isPremium && item.type.includes('MCQ') && (settings?.mcqHistoryCost ?? 1) > 0 && (
                            <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 text-[9px] font-bold px-2 py-1 rounded-full flex items-center gap-1 z-10 border border-yellow-200">
                                <Lock size={8} /> Pay {settings?.mcqHistoryCost ?? 1} CR
                            </div>
                        )}

                        <div className="p-4 flex justify-between items-start">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                                        {item.subjectName}
                                    </span>
                                    {item.type === 'NOTES_PREMIUM' && (
                                        <span className="text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-yellow-300 to-orange-400 text-white px-2 py-0.5 rounded flex items-center gap-1">
                                            Premium
                                        </span>
                                    )}
                                </div>
                                <h4 className="font-bold text-lg text-slate-800 group-hover:text-blue-600 transition-colors">
                                    {item.title}
                                </h4>
                                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                    <Calendar size={12} />
                                    {new Date(item.dateCreated).toLocaleDateString()}
                                </div>
                            </div>
                            {/* Delete disabled for Students */}
                        </div>
                        
                        {/* Preview Footer */}
                        <div className="bg-slate-50 px-4 py-2 border-t border-slate-100 flex justify-between items-center">
                             <span className="text-xs text-slate-500 font-medium">Click to read full note</span>
                             <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <ChevronDown size={16} className="-rotate-90" />
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};