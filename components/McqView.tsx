
import React, { useState, useEffect } from 'react';
import { Chapter, User, Subject, SystemSettings, MCQResult, PerformanceTag } from '../types';
import { CheckCircle, Lock, ArrowLeft, Crown, PlayCircle, HelpCircle } from 'lucide-react';
import { CustomAlert, CustomConfirm } from './CustomDialogs';
import { getChapterData, saveUserToLive } from '../firebase';
import { LessonView } from './LessonView'; 
import { MarksheetCard } from './MarksheetCard';

// we might need to invoke that or replicate the logic.
// The user wants "Free Practice" and "Premium Test".

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings; // New Prop
}

export const McqView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings
}) => {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'SELECTION' | 'PRACTICE' | 'TEST'>('SELECTION');
  const [lessonContent, setLessonContent] = useState<any>(null); // To pass to LessonView
  const [resultData, setResultData] = useState<MCQResult | null>(null);
  
  // Custom Dialog State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string, title?: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});
  
  const handleStart = async (mode: 'PRACTICE' | 'TEST') => {
      // 1. Fetch Data First (To avoid charging for empty chapters)
      setLoading(true);
      
      // STRICT KEY MATCHING WITH ADMIN
      const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
      const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
      
      let data = null;
      try {
          // Race Firebase against a 2.5s timeout to prevent hanging on slow/offline networks
          const fetchWithTimeout = (promise: Promise<any>, ms: number) => 
              Promise.race([
                  promise, 
                  new Promise((_, reject) => setTimeout(() => reject("timeout"), ms))
              ]);
          
          data = await fetchWithTimeout(getChapterData(key), 2500);
      } catch (e) {
          console.warn("Firebase fetch timed out or failed, falling back to local storage.");
      }

      if (!data) {
          const stored = localStorage.getItem(key);
          if (stored) data = JSON.parse(stored);
      }

      // Handle Empty Content
      if (!data || !data.manualMcqData || data.manualMcqData.length === 0) {
          // Show "Coming Soon" screen instead of alert
          const content = {
              id: Date.now().toString(),
              title: chapter.title,
              subtitle: 'Coming Soon',
              content: '', 
              type: 'MCQ_SIMPLE',
              isComingSoon: true, // New Flag
              dateCreated: new Date().toISOString(),
              subjectName: subject.name,
              mcqData: null
          };
          setLessonContent(content);
          setViewMode(mode);
          setLoading(false);
          return;
      }

      // 2. Cost Logic (Only if content exists)
      // DYNAMIC COST: Use settings or fallback to 2
      const cost = mode === 'TEST' ? (settings?.mcqTestCost ?? 2) : 0; 
      
      // 3. Access Check
      if (user.role !== 'ADMIN' && cost > 0) {
          const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
          const hasAccess = isSubscribed; 
          
          if (!hasAccess && user.credits < cost) {
              setAlertConfig({isOpen: true, title: "Low Balance", message: `Insufficient Credits! You need ${cost} coins.`});
              setLoading(false);
              return;
          }

          if (!hasAccess) {
              setConfirmConfig({
                  isOpen: true,
                  title: "Start Premium Test",
                  message: `Start Premium Test for ${cost} Coins?`,
                  onConfirm: () => {
                      const updatedUser = { ...user, credits: user.credits - cost };
                      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
                      saveUserToLive(updatedUser);
                      onUpdateUser(updatedUser);
                      setConfirmConfig(prev => ({...prev, isOpen: false}));
                      
                      // Continue logic - we need to refactor to allow continuation after confirm
                      // Since confirm is async here via state, we can't just 'return'.
                      // We need to move the content loading into the confirm callback or handle it differently.
                      // For simplicity, I'll just call handleStart again with a 'force' flag or set state to trigger.
                      // Actually, let's just proceed with loading inside this callback.
                      proceedWithStart(mode, data);
                  }
              });
              setLoading(false);
              return;
          }
      }
      
      proceedWithStart(mode, data);
  };

  const proceedWithStart = (mode: 'PRACTICE' | 'TEST', data: any) => {

      // Prepare LessonContent object for the existing LessonView component
      const content = {
          id: Date.now().toString(),
          title: chapter.title,
          subtitle: mode === 'TEST' ? 'Premium Test Mode' : 'Free Practice Mode',
          content: '', // Not used for MCQ
          type: mode === 'TEST' ? 'MCQ_ANALYSIS' : 'MCQ_SIMPLE',
          dateCreated: new Date().toISOString(),
          subjectName: subject.name,
          mcqData: data.manualMcqData
      };
      
      setLessonContent(content);
      setViewMode(mode);
      setLoading(false);
  };

  const handleMCQComplete = (score: number, answers: Record<number, number>, usedData: any[], timeTaken: number) => {
      // 1. Calculate Analytics
      const attemptsCount = Object.keys(answers).length;
      const averageTime = attemptsCount > 0 ? timeTaken / attemptsCount : 0;
      let performanceTag: PerformanceTag = 'VERY_BAD';
      if (averageTime <= 15) performanceTag = 'EXCELLENT';
      else if (averageTime <= 30) performanceTag = 'GOOD';
      else if (averageTime <= 45) performanceTag = 'BAD';

      // Build OMR Data
      const omrData = usedData.map((q, idx) => ({
          qIndex: idx,
          selected: answers[idx] !== undefined ? answers[idx] : -1,
          correct: q.correctAnswer
      }));

      // 2. Prepare Result Object
      const result: MCQResult = {
          id: `res-${Date.now()}`,
          userId: user.id,
          chapterId: chapter.id,
          subjectId: subject.id,
          subjectName: subject.name,
          chapterTitle: chapter.title,
          date: new Date().toISOString(),
          totalQuestions: usedData.length,
          correctCount: score,
          wrongCount: attemptsCount - score,
          score: score,
          totalTimeSeconds: timeTaken,
          averageTimePerQuestion: averageTime,
          performanceTag: performanceTag,
          classLevel: classLevel,
          omrData: omrData
      };

      // 3. Update User Data
      let updatedUser = { ...user };
      
      // 3.1 Topic Strength Tracking
      if (!updatedUser.topicStrength) updatedUser.topicStrength = {};
      const currentStrength = updatedUser.topicStrength[subject.name] || { correct: 0, total: 0 };
      updatedUser.topicStrength[subject.name] = {
          correct: currentStrength.correct + score,
          total: currentStrength.total + attemptsCount
      };

      // 3.2 Add to History
      const newHistory = [result, ...(updatedUser.mcqHistory || [])];
      updatedUser.mcqHistory = newHistory;

      // 3.3 Progress Logic (Legacy)
      if (!updatedUser.progress) updatedUser.progress = {};
      const subjectId = subject.id;
      let progress = updatedUser.progress[subjectId] || { currentChapterIndex: 0, totalMCQsSolved: 0 };
      progress.totalMCQsSolved += attemptsCount;
      let leveledUp = false;
      if (progress.totalMCQsSolved >= 100) {
          progress.currentChapterIndex += 1;
          progress.totalMCQsSolved = progress.totalMCQsSolved - 100;
          leveledUp = true;
      }
      updatedUser.progress[subjectId] = progress;

      // 4. Save & Sync
      onUpdateUser(updatedUser); 
      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser);
      
      // 5. Save detailed attempt to Legacy Local History (for Resume support etc)
      const newHistoryItem = {
          ...lessonContent,
          mcqData: usedData,
          id: `mcq-history-${Date.now()}`,
          dateCreated: new Date().toISOString(),
          score: score,
          totalQuestions: usedData.length,
          userAnswers: answers,
          analytics: result // Attach new analytics
      };
      const existingHistoryStr = localStorage.getItem('nst_user_history');
      let history = existingHistoryStr ? JSON.parse(existingHistoryStr) : [];
      history.push(newHistoryItem);
      localStorage.setItem('nst_user_history', JSON.stringify(history));

      if (leveledUp) {
          setAlertConfig({isOpen: true, title: "Level Up!", message: `🎉 Congratulations! You cleared 100 MCQs.\n\n🔓 Next Chapter Unlocked!`});
      }
      
      // Show Marksheet
      setResultData(result);
  };

  if (viewMode !== 'SELECTION' && lessonContent) {
      return (
          <LessonView 
              content={lessonContent} 
              subject={subject} 
              classLevel={classLevel as any} 
              chapter={chapter} 
              loading={false} 
              onBack={() => setViewMode('SELECTION')} 
              onMCQComplete={handleMCQComplete}
              user={user}
              onUpdateUser={onUpdateUser}
              settings={settings} // Pass settings down
          />
      );
  }

  return (
    <div className="bg-white min-h-screen pb-20 animate-in fade-in slide-in-from-right-8">
       {resultData && (
           <MarksheetCard 
               result={resultData} 
               user={user} 
               settings={settings}
               onClose={() => {
                   setResultData(null);
                   setViewMode('SELECTION');
               }} 
           />
       )}
       <CustomAlert 
           isOpen={alertConfig.isOpen} 
           title={alertConfig.title} 
           message={alertConfig.message} 
           onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
       />
       <CustomConfirm
           isOpen={confirmConfig.isOpen}
           title={confirmConfig.title}
           message={confirmConfig.message}
           onConfirm={confirmConfig.onConfirm}
           onCancel={() => setConfirmConfig({...confirmConfig, isOpen: false})}
       />
       {/* HEADER */}
       <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm p-4 flex items-center gap-3">
           <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
               <ArrowLeft size={20} />
           </button>
           <div className="flex-1">
               <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">{chapter.title}</h3>
               <p className="text-xs text-slate-500">{subject.name} • MCQ Center</p>
           </div>
           <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
               <Crown size={14} className="text-blue-600" />
               <span className="font-black text-blue-800 text-xs">{user.credits} CR</span>
           </div>
       </div>

       <div className="p-6 space-y-4">
           {/* FREE PRACTICE */}
           <button 
               onClick={() => handleStart('PRACTICE')}
               disabled={loading}
               className="w-full p-6 rounded-3xl border-2 border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-all group text-left relative overflow-hidden"
           >
               <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                   <HelpCircle size={80} className="text-blue-600" />
               </div>
               <div className="relative z-10">
                   <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mb-4">
                       <CheckCircle size={24} />
                   </div>
                   <h4 className="text-xl font-black text-slate-800 mb-1">Free Practice</h4>
                   <p className="text-sm text-slate-500 mb-4">Practice questions with instant feedback. No timer.</p>
                   <span className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-lg shadow-blue-200">START NOW</span>
               </div>
           </button>

           {/* PREMIUM TEST - REMOVED AS REQUESTED */}
           
           {loading && <div className="text-center py-4 text-slate-500 font-bold animate-pulse">Loading Questions...</div>}
       </div>
    </div>
  );
};
