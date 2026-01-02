
import React from 'react';
import { Board, SystemSettings } from '../types';
import { Landmark, Building2, ArrowLeft, Briefcase } from 'lucide-react';

interface Props {
  onSelect: (board: Board) => void;
  onBack?: () => void;
}

export const BoardSelection: React.FC<Props> = ({ onSelect, onBack }) => {
  const [allowedBoards, setAllowedBoards] = React.useState<Board[]>(['CBSE', 'BSEB', 'COMPETITION']);

  React.useEffect(() => {
      const s = localStorage.getItem('nst_system_settings');
      if (s) {
          const settings = JSON.parse(s) as SystemSettings;
          if (settings.allowedBoards && settings.allowedBoards.length > 0) {
              setAllowedBoards(settings.allowedBoards);
          }
      }
  }, []);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center mb-8">
        {onBack && (
            <button onClick={onBack} className="text-slate-500 hover:text-slate-800 transition-colors mr-4 flex items-center gap-1 font-medium">
             <ArrowLeft size={18} /> Back
            </button>
        )}
      </div>

      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-slate-800 mb-3">Select Your Board</h2>
        <p className="text-slate-600">Choose your education board to continue</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto px-4">
        {allowedBoards.includes('CBSE') && (
            <button
              onClick={() => onSelect('CBSE')}
              className="group relative overflow-hidden bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 text-left"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Landmark size={120} className="text-blue-900" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Landmark size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">CBSE Board</h3>
                <p className="text-slate-500 mb-4">Central Board of Secondary Education</p>
                <span className="text-sm font-medium text-blue-600 group-hover:text-blue-700">Select CBSE &rarr;</span>
              </div>
            </button>
        )}

        {allowedBoards.includes('BSEB') && (
            <button
              onClick={() => onSelect('BSEB')}
              className="group relative overflow-hidden bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-orange-500 hover:-translate-y-1 transition-all duration-300 text-left"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Building2 size={120} className="text-orange-900" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mb-6 group-hover:bg-orange-600 group-hover:text-white transition-colors">
                  <Building2 size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Bihar Board (BSEB)</h3>
                <p className="text-slate-500 mb-4">Bihar School Examination Board</p>
                <span className="text-sm font-medium text-orange-600 group-hover:text-orange-700">Select BSEB &rarr;</span>
              </div>
            </button>
        )}

        {/* COMPETITION MODE */}
        {(allowedBoards.includes('COMPETITION') || allowedBoards.length === 0) && (
            <button
              onClick={() => onSelect('COMPETITION')}
              className="group relative overflow-hidden bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-purple-500 hover:-translate-y-1 transition-all duration-300 text-left md:col-span-2"
            >
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Briefcase size={120} className="text-purple-900" />
              </div>
              
              <div className="relative z-10 flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mb-6 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Briefcase size={40} />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">Competition Exams</h3>
                <p className="text-slate-500 mb-4">SSC, Railways, Police, UPSC & More</p>
                <span className="text-sm font-medium text-purple-600 group-hover:text-purple-700">Enter Competition Mode &rarr;</span>
              </div>
            </button>
        )}
      </div>
    </div>
  );
};
