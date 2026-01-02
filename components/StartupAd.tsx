import React from 'react';
import { StartupConfig } from '../types';
import { Sparkles, Zap, ArrowRight, BrainCircuit } from 'lucide-react';

interface Props {
    config?: StartupConfig;
    onClose: () => void;
}

export const StartupAd: React.FC<Props> = ({ onClose }) => {
    return (
        <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[140%] bg-gradient-to-br from-blue-900/20 to-purple-900/20 blur-3xl"></div>
            </div>

            <div className="relative z-10 max-w-md w-full flex flex-col items-center h-full justify-between py-10">
                
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="mb-8 relative">
                        <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(37,99,235,0.5)] animate-bounce-slow">
                            <BrainCircuit size={48} className="text-white" />
                        </div>
                    </div>

                    <h1 className="text-4xl font-black text-white mb-2 tracking-tight">IIC <span className="text-blue-500">AI</span></h1>
                    <p className="text-slate-400 text-sm font-medium uppercase tracking-widest mb-10">Future of Learning</p>

                    <div className="space-y-6 w-full text-left">
                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-start gap-4">
                            <div className="bg-yellow-500/10 p-3 rounded-xl text-yellow-500">
                                <Zap size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">Study & Earn</h3>
                                <p className="text-slate-400 text-sm">2 Hours Study = <span className="text-yellow-400 font-bold">FREE Ultra Subscription</span></p>
                            </div>
                        </div>

                        <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800 flex items-start gap-4">
                            <div className="bg-purple-500/10 p-3 rounded-xl text-purple-500">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg">AI Powered</h3>
                                <p className="text-slate-400 text-sm">Instant Notes, Smart MCQs & Personal Analysis.</p>
                            </div>
                        </div>

                        <p className="text-[10px] text-slate-600 mt-2 text-center opacity-60">
                            * Premium status is managed by Admin and can be revoked at any time.
                        </p>
                    </div>
                </div>

                <div className="w-full">
                    <button 
                        onClick={onClose}
                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        Get Started <ArrowRight size={20} />
                    </button>
                    <p className="text-slate-600 text-[10px] font-bold mt-6 uppercase tracking-widest">Developed by Nadim Anwar</p>
                </div>
            </div>
        </div>
    );
};
