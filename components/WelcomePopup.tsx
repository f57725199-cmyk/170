
import React from 'react';
import { BrainCircuit, Zap, Clock, Wifi, Trophy } from 'lucide-react';

interface Props {
  onStart: () => void;
  isResume: boolean;
  title?: string;
  message?: string;
  footerText?: string;
}

export const WelcomePopup: React.FC<Props> = ({ onStart, isResume, title, message, footerText }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
       <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700 rounded-[2rem] p-8 text-center shadow-2xl overflow-hidden ring-1 ring-slate-800">
           
           {/* Glowing Background Effect */}
           <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-blue-500/10 blur-3xl rounded-full animate-pulse"></div>
           
           <div className="relative z-10">
               {/* GLOWING LOGO */}
               <div className="w-20 h-20 mx-auto mb-6 bg-blue-600 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.6)] animate-bounce-slow">
                   <BrainCircuit size={40} className="text-white" />
               </div>
               
               <h2 className="text-3xl font-black text-white mb-1 tracking-tight">IIC <span className="text-blue-500">AI</span></h2>
               <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">Future of Education</p>
               
               {/* SCROLLABLE FEATURE LIST */}
               <div className="h-48 overflow-y-auto mb-6 pr-2 space-y-3 custom-scrollbar text-left">
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-start gap-3">
                       <div className="bg-slate-700/50 p-2 rounded-lg text-yellow-400"><Zap size={18} /></div>
                       <div>
                           <h4 className="text-slate-200 font-bold text-xs">AI Powered Learning</h4>
                           <p className="text-slate-500 text-[10px]">Instant Notes & Smart MCQs generated just for you.</p>
                       </div>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-start gap-3">
                       <div className="bg-slate-700/50 p-2 rounded-lg text-green-400"><Clock size={18} /></div>
                       <div>
                           <h4 className="text-slate-200 font-bold text-xs">Daily Rewards</h4>
                           <p className="text-slate-500 text-[10px]">Study 1 Hour → Get Free Basic Premium.<br/>Study 3 Hours → Get Free Ultra Premium.</p>
                       </div>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-start gap-3">
                       <div className="bg-slate-700/50 p-2 rounded-lg text-red-400"><Wifi size={18} /></div>
                       <div>
                           <h4 className="text-slate-200 font-bold text-xs">Unlimited Videos</h4>
                           <p className="text-slate-500 text-[10px]">Watch Video Playlists directly inside the app.</p>
                       </div>
                   </div>
                   <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/50 flex items-start gap-3">
                       <div className="bg-slate-700/50 p-2 rounded-lg text-orange-400"><Trophy size={18} /></div>
                       <div>
                           <h4 className="text-slate-200 font-bold text-xs">Weekly Tests</h4>
                           <p className="text-slate-500 text-[10px]">Participate & Earn 24h Free Pass instantly.</p>
                       </div>
                   </div>
               </div>

               <button onClick={onStart} className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-900/30 transform transition active:scale-95 border border-blue-500/20">
                   {isResume ? "Resume Learning 🚀" : "Get Started 🚀"}
               </button>
               
               <div className="mt-6">
                   <p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{footerText || "Developed by Nadim Anwar"}</p>
               </div>
           </div>
       </div>
    </div>
  );
};
