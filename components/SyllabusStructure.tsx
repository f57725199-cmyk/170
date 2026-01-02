
import React, { useState, useEffect } from 'react';
import { User, ClassLevel } from '../types';
import { DEFAULT_SYLLABUS, MonthlySyllabus } from '../syllabus_data';
import { Lock, CheckCircle, Circle, ChevronDown, ChevronUp, ZoomIn, ZoomOut, Calendar, Star, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import { STATIC_SYLLABUS } from '../constants';
import { CustomAlert } from './CustomDialogs';

interface Props {
  user: User;
  onTopicClick?: (topic: string, subject: string) => void;
  isAdmin?: boolean;
  onEdit?: () => void;
  startDate?: string; // ISO Date String
}

export const SyllabusStructure: React.FC<Props> = ({ user, onTopicClick, isAdmin, onEdit, startDate }) => {
  const [currentMonth, setCurrentMonth] = useState(1);
  const [zoomedMonth, setZoomedMonth] = useState<number | null>(null);
  const [syllabus, setSyllabus] = useState<Record<string, MonthlySyllabus[]>>(DEFAULT_SYLLABUS);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  useEffect(() => {
    // Load syllabus from local storage if edited by admin (simulated)
    const storedSyllabus = localStorage.getItem('nst_syllabus_data');
    if (storedSyllabus) {
        setSyllabus(JSON.parse(storedSyllabus));
    }
    
    // Calculate current month
    const now = new Date();
    let effectiveStartDate: Date;

    if (startDate) {
        effectiveStartDate = new Date(startDate);
    } else {
        // Default: April 1st of current academic year
        const currentYear = now.getFullYear();
        const startYear = now.getMonth() < 3 ? currentYear - 1 : currentYear; 
        effectiveStartDate = new Date(startYear, 3, 1);
    }
    
    // If start date is in future, it's Month 1 (Locked? No, usually Month 1 is open)
    if (now < effectiveStartDate) {
        setCurrentMonth(1);
    } else {
        const diffTime = Math.abs(now.getTime() - effectiveStartDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        const calculatedMonth = Math.min(Math.max(Math.ceil(diffDays / 30), 1), 12);
        setCurrentMonth(calculatedMonth);
    }
    
    // Auto zoom to current month
    // If we just calculated it, set zoomed to it.
    // However, setCurrentMonth is async-ish in React logic (but here calculatedMonth is local var)
    // We can't use 'currentMonth' state variable immediately.
    // We will use a separate effect or just logic here.
    // But since this is inside useEffect [], it runs once.
    // We need to re-run if startDate changes.
  }, [startDate]);

  // Sync zoomed month
  useEffect(() => {
      setZoomedMonth(currentMonth);
  }, [currentMonth]);

  const classLevel = user.classLevel || '10';
  const currentSyllabus = syllabus[classLevel] || syllabus['10']; // Default to 10 if missing

  const isMonthLocked = (monthIndex: number) => {
    if (isAdmin) return false;
    // Lock future months
    return monthIndex > currentMonth;
  };

  const getStatusColor = (monthIndex: number) => {
      if (monthIndex === currentMonth) return "ring-4 ring-green-500 border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)]";
      if (monthIndex < currentMonth) return "border-slate-300 opacity-80";
      return "border-slate-200 opacity-50 grayscale";
  };

  const handleMonthClick = (m: MonthlySyllabus) => {
      if (isMonthLocked(m.month)) {
          setAlertConfig({isOpen: true, message: `Month ${m.month} is locked! Complete previous months first.`});
          return;
      }
      setZoomedMonth(zoomedMonth === m.month ? null : m.month);
  };

  // --- PROGRESS TRACKING HELPER ---
  const checkTopicStatus = (subjectName: string, topicName: string): 'DONE' | 'PENDING' | 'LOCKED' => {
      if (isAdmin) return 'PENDING';
      
      // 1. Map Subject Name to ID
      const subMap: Record<string, string> = {
          'Maths': 'math', 'Mathematics': 'math',
          'Physics': 'physics', 'Chemistry': 'chemistry', 'Biology': 'biology',
          'Science': 'science', 'Social Science': 'sst',
          'History': 'history', 'Geography': 'geography', 'Civics': 'polity', 'Economics': 'economics',
          'English': 'english', 'Hindi': 'hindi'
      };
      // Simple fuzzy match or lookup
      const subKey = Object.keys(subMap).find(k => subjectName.includes(k)) || subjectName.toLowerCase();
      const subId = subMap[subKey] || subKey;

      // 2. Check User Progress
      const userProgress = user.progress?.[subId];
      if (!userProgress) return 'PENDING';

      // 3. Find Topic Index in STATIC_SYLLABUS (Best Effort)
      const board = user.board || 'CBSE';
      const key = `${board}-${user.classLevel}-${subjectName === 'Maths' ? 'Mathematics' : subjectName}`;
      // Fallback for Science/SST if exact key fails
      const staticList = STATIC_SYLLABUS[key] || [];

      if (staticList.length === 0) return 'PENDING'; // Can't track if not in static list

      // Fuzzy find topic index
      const topicIndex = staticList.findIndex(t => t.toLowerCase().includes(topicName.split('(')[0].trim().toLowerCase()));
      
      if (topicIndex === -1) return 'PENDING'; // Topic mismatch

      if (userProgress.currentChapterIndex > topicIndex) {
          return 'DONE';
      }

      return 'PENDING';
  };

  return (
    <div className="w-full h-full bg-slate-50 relative overflow-hidden flex flex-col">
        <CustomAlert 
            isOpen={alertConfig.isOpen} 
            message={alertConfig.message} 
            onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
        />
        {/* HEADER */}
        <div className="bg-white p-4 shadow-sm border-b border-slate-200 z-10 flex justify-between items-center sticky top-0">
            <div>
                <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <Calendar className="text-blue-600" /> 
                    ACADEMIC SESSION <span className="text-slate-400 font-normal text-sm ml-2">Class {classLevel}</span>
                </h2>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                    Month {currentMonth} of 12 • FOUNDATION PHASE
                </p>
            </div>
            <div className="flex gap-2">
                <button onClick={() => setZoomedMonth(null)} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600">
                    <ZoomOut size={20} />
                </button>
                {isAdmin && (
                    <button onClick={onEdit} className="px-4 py-2 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-900">
                        EDIT STRUCTURE
                    </button>
                )}
            </div>
        </div>

        {/* TIMELINE VISUALIZER */}
        <div className="flex-1 overflow-y-auto p-6 pb-24 custom-scrollbar">
            <div className="max-w-4xl mx-auto space-y-8 relative">
                {/* CONNECTING LINE */}
                <div className="absolute left-8 top-8 bottom-8 w-1 bg-slate-200 z-0"></div>

                {currentSyllabus.map((monthData, index) => {
                    const isLocked = isMonthLocked(monthData.month);
                    const isCurrent = monthData.month === currentMonth;
                    const isZoomed = zoomedMonth === monthData.month;
                    const isPast = monthData.month < currentMonth;

                    return (
                        <div 
                            key={monthData.month} 
                            className={`relative z-10 transition-all duration-500 ease-in-out ${isZoomed ? 'scale-100 my-8' : 'scale-95 hover:scale-100'}`}
                        >
                            <div className="flex items-start gap-6">
                                {/* MONTH INDICATOR CIRCLE */}
                                <div 
                                    className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-xl shadow-xl shrink-0 border-4 bg-white cursor-pointer transition-colors
                                        ${isCurrent ? 'border-green-500 text-green-600 animate-pulse' : 
                                          isLocked ? 'border-slate-300 text-slate-300' : 'border-blue-500 text-blue-600'}
                                    `}
                                    onClick={() => handleMonthClick(monthData)}
                                >
                                    {isLocked ? <Lock size={24} /> : monthData.month}
                                </div>

                                {/* CONTENT CARD */}
                                <div 
                                    className={`flex-1 bg-white rounded-2xl border-2 transition-all duration-300 overflow-hidden shadow-sm
                                        ${getStatusColor(monthData.month)}
                                        ${isZoomed ? 'shadow-2xl ring-2 ring-blue-100' : ''}
                                    `}
                                >
                                    {/* Month Header */}
                                    <div 
                                        className={`p-4 flex justify-between items-center cursor-pointer ${isCurrent ? 'bg-green-50' : 'bg-slate-50'}`}
                                        onClick={() => handleMonthClick(monthData)}
                                    >
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className={`font-black text-lg uppercase ${isCurrent ? 'text-green-700' : 'text-slate-700'}`}>
                                                    {monthData.title}
                                                </h3>
                                                {isCurrent && <span className="px-2 py-0.5 bg-green-200 text-green-800 text-[10px] font-bold rounded-full animate-bounce">ACTIVE</span>}
                                            </div>
                                            {monthData.description && <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{monthData.description}</p>}
                                        </div>
                                        {isLocked ? <Lock size={20} className="text-slate-300" /> : (isZoomed ? <ChevronUp className="text-slate-400" /> : <ChevronDown className="text-slate-400" />)}
                                    </div>

                                    {/* Month Details (Collapsible) */}
                                    <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isZoomed ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                        <div className="p-4 pt-0 border-t border-slate-100">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                                {monthData.subjects.map((subj, idx) => (
                                                    <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                        <h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                            {subj.subject}
                                                        </h4>
                                                        <ul className="space-y-2">
                                                            {subj.topics.map((topic, tIdx) => {
                                                                const status = checkTopicStatus(subj.subject, topic);
                                                                const isCompleted = status === 'DONE';
                                                                
                                                                return (
                                                                    <li 
                                                                        key={tIdx} 
                                                                        onClick={() => !isLocked && onTopicClick && onTopicClick(topic, subj.subject)}
                                                                        className={`text-xs p-2 rounded-lg border flex items-center justify-between group cursor-pointer transition-colors
                                                                            ${isCompleted 
                                                                                ? 'bg-green-100 border-green-200 text-green-800' 
                                                                                : 'bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:shadow-sm'
                                                                            }
                                                                        `}
                                                                    >
                                                                        <span className="font-medium">{topic}</span>
                                                                        {isCompleted 
                                                                            ? <CheckCircle size={14} className="text-green-600" /> 
                                                                            : <XCircle size={14} className="text-red-300 group-hover:text-red-500" />
                                                                        }
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* ACTION BUTTON */}
                                            {!isLocked && (
                                                <div className="mt-6 flex justify-end">
                                                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full font-bold text-sm shadow-lg transition-transform active:scale-95">
                                                        Start Learning <ArrowRight size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* SIGNATURE REMOVED AS REQUESTED */}
                <div className="pb-8"></div>
            </div>
        </div>
    </div>
  );
};
