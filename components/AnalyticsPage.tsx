
import React, { useState } from 'react';
import { User, MCQResult, PerformanceTag, SystemSettings } from '../types';
import { BarChart, Clock, Calendar, BookOpen, TrendingUp, AlertTriangle, CheckCircle, XCircle, FileText } from 'lucide-react';
import { MarksheetCard } from './MarksheetCard';

interface Props {
  user: User;
  onBack: () => void;
  settings?: SystemSettings;
}

export const AnalyticsPage: React.FC<Props> = ({ user, onBack, settings }) => {
  const [selectedResult, setSelectedResult] = useState<MCQResult | null>(null);
  const history = user.mcqHistory || [];
  
  // Calculate Totals
  const totalTests = history.length;
  const totalQuestions = history.reduce((acc, curr) => acc + curr.totalQuestions, 0);
  const totalCorrect = history.reduce((acc, curr) => acc + curr.correctCount, 0);
  const accuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  const totalTime = history.reduce((acc, curr) => acc + curr.totalTimeSeconds, 0);
  const avgTimePerQ = totalQuestions > 0 ? (totalTime / totalQuestions).toFixed(1) : '0';

  // Topic Analysis
  const topicStats = user.topicStrength || {};
  
  const getTagColor = (tag: PerformanceTag) => {
      switch(tag) {
          case 'EXCELLENT': return 'bg-green-100 text-green-700 border-green-200';
          case 'GOOD': return 'bg-blue-100 text-blue-700 border-blue-200';
          case 'BAD': return 'bg-orange-100 text-orange-700 border-orange-200';
          case 'VERY_BAD': return 'bg-red-100 text-red-700 border-red-200';
          default: return 'bg-slate-100 text-slate-600';
      }
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-24 animate-in fade-in slide-in-from-right">
        {selectedResult && (
            <MarksheetCard 
                result={selectedResult} 
                user={user} 
                settings={settings}
                onClose={() => setSelectedResult(null)} 
            />
        )}
        
        {/* HEADER */}
        <div className="bg-white p-4 shadow-sm border-b border-slate-200 sticky top-0 z-10 flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full"><TrendingUp size={20} className="text-slate-600" /></button>
            <div>
                <h2 className="text-xl font-black text-slate-800">Annual Report</h2>
                <p className="text-xs text-slate-500 font-bold uppercase">Performance Analytics</p>
            </div>
        </div>

        <div className="p-4 space-y-6">
            {/* SUMMARY CARDS */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-blue-100 rounded-lg text-blue-600"><CheckCircle size={18} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Accuracy</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{accuracy}%</p>
                    <p className="text-[10px] text-slate-400">{totalCorrect}/{totalQuestions} Correct</p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600"><Clock size={18} /></div>
                        <span className="text-xs font-bold text-slate-400 uppercase">Speed</span>
                    </div>
                    <p className="text-2xl font-black text-slate-800">{avgTimePerQ}s</p>
                    <p className="text-[10px] text-slate-400">Avg per Question</p>
                </div>
            </div>

            {/* TOPIC STRENGTH */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BookOpen size={18} className="text-indigo-500" /> Topic Strength
                </h3>
                {Object.keys(topicStats).length === 0 && <p className="text-slate-400 text-sm text-center py-4">No data yet.</p>}
                <div className="space-y-4">
                    {Object.entries(topicStats).map(([topic, stats]) => {
                        const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
                        let barColor = 'bg-red-500';
                        if (pct >= 80) barColor = 'bg-green-500';
                        else if (pct >= 50) barColor = 'bg-yellow-500';

                        return (
                            <div key={topic}>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span className="text-slate-700">{topic}</span>
                                    <span className={pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}>{pct}%</span>
                                </div>
                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                    <div className={`h-full ${barColor} transition-all duration-1000`} style={{ width: `${pct}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RECENT TESTS */}
            <div>
                <h3 className="font-bold text-slate-800 mb-3 px-1 flex items-center gap-2">
                    <Calendar size={18} className="text-slate-400" /> Recent Tests
                </h3>
                <div className="space-y-3">
                    {history.length === 0 && <p className="text-slate-400 text-sm text-center py-8 bg-white rounded-xl border border-dashed">No tests taken yet.</p>}
                    {history.map((item) => (
                        <div key={item.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="font-bold text-slate-800 text-sm">{item.chapterTitle}</h4>
                                    <p className="text-xs text-slate-500">{item.subjectName} • {new Date(item.date).toLocaleDateString()}</p>
                                </div>
                                <div className={`px-2 py-1 rounded text-[10px] font-black border ${getTagColor(item.performanceTag)}`}>
                                    {item.performanceTag.replace('_', ' ')}
                                </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg">
                                <div className="text-center flex-1 border-r border-slate-200">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Score</p>
                                    <p className="font-black text-slate-700">{item.score}/{item.totalQuestions}</p>
                                </div>
                                <div className="text-center flex-1 border-r border-slate-200">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Avg Time</p>
                                    <p className="font-black text-slate-700">{item.averageTimePerQuestion.toFixed(1)}s</p>
                                </div>
                                <div className="text-center flex-1">
                                    <p className="text-slate-400 font-bold uppercase text-[9px]">Total Time</p>
                                    <p className="font-black text-slate-700">{Math.floor(item.totalTimeSeconds/60)}m {item.totalTimeSeconds%60}s</p>
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => setSelectedResult(item)}
                                className="w-full py-2 bg-slate-800 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-900 transition-colors"
                            >
                                <FileText size={14} /> View Marksheet
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
  );
};
