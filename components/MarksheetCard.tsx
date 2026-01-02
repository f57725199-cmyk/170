import React from 'react';
import { MCQResult, User, SystemSettings } from '../types';
import { X, Share2 } from 'lucide-react';

interface Props {
  result: MCQResult;
  user: User;
  settings?: SystemSettings;
  onClose: () => void;
}

export const MarksheetCard: React.FC<Props> = ({ result, user, settings, onClose }) => {
  const percentage = Math.round((result.score / result.totalQuestions) * 100);
  const attempted = (result.correctCount + result.wrongCount);
  
  // OMR Rendering Logic
  const renderOMRRow = (qIndex: number, selected: number, correct: number) => {
      const options = [0, 1, 2, 3]; // A, B, C, D
      return (
          <div key={qIndex} className="flex items-center gap-3 mb-2">
              <span className="w-6 text-[10px] font-bold text-slate-500 text-right">{qIndex + 1}</span>
              <div className="flex gap-1.5">
                  {options.map((opt) => {
                      let bgClass = "bg-white border border-slate-300 text-slate-400"; // Default
                      
                      const isSelected = selected === opt;
                      const isCorrect = correct === opt;
                      
                      if (isSelected) {
                          if (isCorrect) bgClass = "bg-green-600 border-green-600 text-white shadow-sm"; // User Correct
                          else bgClass = "bg-red-500 border-red-500 text-white shadow-sm"; // User Wrong
                      } else if (isCorrect && selected !== -1) {
                          // User attempted but wrong -> Show correct answer in Green
                          bgClass = "bg-green-600 border-green-600 text-white opacity-80"; 
                      } else if (isCorrect && selected === -1) {
                          // Unattempted -> Show correct as outline or dim? 
                          // Requirement doesn't strictly specify unattempted visualization, but usually we show correct.
                          bgClass = "border-green-500 text-green-600 bg-green-50";
                      }

                      return (
                          <div key={opt} className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${bgClass}`}>
                              {String.fromCharCode(65 + opt)}
                          </div>
                      );
                  })}
              </div>
          </div>
      );
  };

  const omrData = result.omrData || [];
  const hasOMR = omrData.length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-in fade-in overflow-y-auto">
        <div className="bg-white w-full max-w-3xl rounded-none sm:rounded-xl shadow-2xl overflow-hidden relative my-auto border-t-8 border-slate-900">
            {/* CLOSE */}
            <button onClick={onClose} className="absolute top-4 right-4 z-10 text-slate-400 hover:text-slate-800 transition-colors">
                <X size={24} />
            </button>

            {/* 1. HEADER */}
            <div className="bg-slate-50 p-6 text-center border-b border-slate-200">
                <h1 className="text-3xl font-black tracking-widest text-slate-900 uppercase mb-1 font-serif">NSTA</h1>
                <p className="text-[10px] font-bold tracking-[0.4em] uppercase text-slate-500">POWERED BY IIC</p>
                <div className="mt-4 inline-block px-4 py-1 bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                    Official Marksheet
                </div>
            </div>

            {/* 2. STUDENT INFO */}
            <div className="bg-white p-6 border-b border-slate-200">
                <div className="flex flex-wrap justify-between items-end gap-4">
                    <div className="flex-1 min-w-[200px]">
                        <div className="grid grid-cols-[60px_1fr] gap-2 text-sm mb-1">
                            <span className="font-bold text-slate-400 uppercase text-[10px] pt-1">Name</span>
                            <span className="font-black text-slate-800 text-lg uppercase border-b border-slate-200 pb-1">{user.name}</span>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2 text-sm mb-1">
                            <span className="font-bold text-slate-400 uppercase text-[10px] pt-1">Roll/UID</span>
                            <span className="font-mono font-bold text-slate-700 border-b border-slate-200 pb-1">{user.displayId || user.id}</span>
                        </div>
                        <div className="grid grid-cols-[60px_1fr] gap-2 text-sm">
                            <span className="font-bold text-slate-400 uppercase text-[10px] pt-1">Class</span>
                            <span className="font-bold text-slate-700 border-b border-slate-200 pb-1">{result.classLevel || user.classLevel || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div className="text-right">
                        <div className={`w-24 h-24 rounded-full border-4 flex flex-col items-center justify-center ${percentage >= 40 ? 'border-green-500 text-green-600' : 'border-red-500 text-red-600'}`}>
                            <span className="text-3xl font-black">{percentage}%</span>
                            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Score</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. SUMMARY STATS */}
            <div className="grid grid-cols-4 divide-x divide-slate-100 border-b border-slate-200 bg-slate-50">
                <div className="p-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total</p>
                    <p className="font-black text-xl text-slate-800">{result.totalQuestions}</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Attempted</p>
                    <p className="font-black text-xl text-blue-600">{attempted}</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Correct</p>
                    <p className="font-black text-xl text-green-600">{result.correctCount}</p>
                </div>
                <div className="p-4 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wrong</p>
                    <p className="font-black text-xl text-red-600">{result.wrongCount}</p>
                </div>
            </div>

            {/* 4. OMR SHEET GRID */}
            <div className="p-8 bg-white max-h-[50vh] overflow-y-auto custom-scrollbar">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 text-center">— OMR Response Sheet —</h3>
                
                {!hasOMR ? (
                    <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                        <p className="text-slate-400 font-medium">OMR Data unavailable for this test record.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-12 gap-y-2">
                        {omrData.map((data) => renderOMRRow(data.qIndex, data.selected, data.correct))}
                    </div>
                )}
            </div>

            {/* FOOTER */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-center sm:text-left">
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Generated by NSTA Engine</p>
                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">Developed by Nadim</p>
                    <p className="text-[9px] text-slate-400 font-bold mt-1">{new Date(result.date).toLocaleString()}</p>
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                    <button onClick={onClose} className="flex-1 sm:flex-none px-6 py-2.5 bg-white border border-slate-300 text-slate-600 font-bold rounded-lg text-xs hover:bg-slate-50 uppercase tracking-wider">Close</button>
                    <button className="flex-1 sm:flex-none px-6 py-2.5 bg-slate-900 text-white font-bold rounded-lg text-xs hover:bg-slate-800 flex items-center justify-center gap-2 uppercase tracking-wider shadow-lg">
                        <Share2 size={14} /> Download
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};
