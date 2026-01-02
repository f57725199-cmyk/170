
import React, { useState, useEffect } from 'react';
import { Chapter, User, Subject, SystemSettings } from '../types';
import { FileText, Lock, ArrowLeft, Crown, Star, CheckCircle, AlertCircle } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';
import { getChapterData, saveUserToLive } from '../firebase';
import { CreditConfirmationModal } from './CreditConfirmationModal';

interface Props {
  chapter: Chapter;
  subject: Subject;
  user: User;
  board: string;
  classLevel: string;
  stream: string | null;
  onBack: () => void;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings;
}

export const PdfView: React.FC<Props> = ({ 
  chapter, subject, user, board, classLevel, stream, onBack, onUpdateUser, settings 
}) => {
  const [contentData, setContentData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [activePdf, setActivePdf] = useState<string | null>(null);
  const [pendingPdf, setPendingPdf] = useState<{type: string, price: number, link: string} | null>(null);
  
  // Custom Alert State
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // STRICT KEY MATCHING WITH ADMIN
        const streamKey = (classLevel === '11' || classLevel === '12') && stream ? `-${stream}` : '';
        const key = `nst_content_${board}_${classLevel}${streamKey}_${subject.name}_${chapter.id}`;
        
        let data = await getChapterData(key);
        if (!data) {
            const stored = localStorage.getItem(key);
            if (stored) data = JSON.parse(stored);
        }
        setContentData(data || {});
      } catch (error) {
        console.error("Error loading PDF data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [chapter.id, board, classLevel, stream, subject.name]);

  const handlePdfClick = (type: 'FREE' | 'PREMIUM') => {
      let link = '';
      let price = 0;

      if (type === 'FREE') {
          link = contentData?.freeLink;
          price = 0;
      } else if (type === 'PREMIUM') {
          link = contentData?.premiumLink;
          price = contentData?.price !== undefined ? contentData.price : (settings?.defaultPdfCost ?? 5);
      }

      if (!link) {
          setAlertConfig({isOpen: true, message: "Coming Soon! This content is being prepared."});
          return;
      }

      // Access Check
      if (user.role === 'ADMIN') {
          setActivePdf(link);
          return;
      }

      if (price === 0) {
          setActivePdf(link);
          return;
      }

      // Subscription Check
      const isSubscribed = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      if (isSubscribed) {
          // ULTRA unlocks EVERYTHING
          if (user.subscriptionLevel === 'ULTRA') {
              setActivePdf(link);
              return;
          }
          // BASIC unlocks ONLY FREE/NORMAL (which usually have price 0 anyway, but just in case)
          // BASIC does NOT unlock PREMIUM/EXCLUSIVE PDFs
          if (type === 'FREE') { 
             // Free is free
          } else {
             // Premium needs Ultra or payment
          }
      }

      // Coin Deduction
      if (user.isAutoDeductEnabled) {
          processPaymentAndOpen(link, price);
      } else {
          setPendingPdf({ type, price, link });
      }
  };

  const processPaymentAndOpen = (link: string, price: number, enableAuto: boolean = false) => {
      if (user.credits < price) {
          setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${price} coins.`});
          return;
      }

      let updatedUser = { ...user, credits: user.credits - price };
      
      if (enableAuto) {
          updatedUser.isAutoDeductEnabled = true;
      }

      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser);
      onUpdateUser(updatedUser);
      
      setActivePdf(link);
      setPendingPdf(null);
  };

  return (
    <div className="bg-slate-50 min-h-screen pb-20 animate-in fade-in slide-in-from-right-8">
       <CustomAlert 
           isOpen={alertConfig.isOpen} 
           message={alertConfig.message} 
           onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
       />
       {/* HEADER */}
       <div className="sticky top-0 z-20 bg-white border-b border-slate-100 shadow-sm p-4 flex items-center gap-3">
           <button onClick={() => activePdf ? setActivePdf(null) : onBack()} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
               <ArrowLeft size={20} />
           </button>
           <div className="flex-1">
               <h3 className="font-bold text-slate-800 leading-tight line-clamp-1">{chapter.title}</h3>
               <p className="text-xs text-slate-500">{subject.name} • Notes Library</p>
           </div>
           <div className="flex items-center gap-1 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
               <Crown size={14} className="text-blue-600" />
               <span className="font-black text-blue-800 text-xs">{user.credits} CR</span>
           </div>
       </div>

       {activePdf ? (
           <div className="h-[calc(100vh-80px)] w-full bg-slate-100 relative">
               {/* WATERMARK OVERLAY (If Configured) */}
               {(contentData?.watermarkText || contentData?.watermarkConfig) && (
                   <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden select-none">
                       {/* Priority to new Config, Fallback to Legacy Text */}
                       {(() => {
                           const config = contentData.watermarkConfig || { 
                               text: contentData.watermarkText, 
                               opacity: 0.3, 
                               color: '#9ca3af', // gray-400 
                               backgroundColor: '#000000', // black
                               fontSize: 40,
                               isRepeating: true,
                               rotation: -12
                           };

                           if (config.isRepeating !== false) {
                               // REPEATING PATTERN
                               return (
                                   <div className="w-full h-full flex flex-col items-center justify-center gap-24">
                                        {Array.from({length: 8}).map((_, i) => (
                                            <div key={i} style={{ transform: `rotate(${config.rotation ?? -12}deg)` }}>
                                                <span 
                                                    style={{
                                                        color: config.color,
                                                        backgroundColor: config.backgroundColor,
                                                        opacity: config.opacity,
                                                        fontSize: `${config.fontSize}px`,
                                                        padding: '8px 24px',
                                                        fontWeight: '900',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.1em',
                                                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                                                    }}
                                                >
                                                    {config.text}
                                                </span>
                                            </div>
                                        ))}
                                   </div>
                               );
                           } else {
                               // FIXED POSITION (Redaction Mode)
                               return (
                                   <div 
                                       className="absolute whitespace-nowrap uppercase tracking-widest font-black shadow-2xl"
                                       style={{
                                           left: `${config.positionX ?? 50}%`,
                                           top: `${config.positionY ?? 50}%`,
                                           transform: 'translate(-50%, -50%)',
                                           color: config.color,
                                           backgroundColor: config.backgroundColor,
                                           opacity: config.opacity,
                                           fontSize: `${config.fontSize}px`,
                                           padding: '8px 16px',
                                           pointerEvents: 'auto' // Allow blocking clicks if opaque? No, user said "hide word".
                                           // Actually, if it's over iframe, it blocks clicks automatically if pointer-events-auto.
                                           // But if we want to allow scrolling, we can't block events on the overlay container, 
                                           // but maybe the watermark itself? 
                                           // If the watermark is "1 word ko chhupana", it's small. Blocking clicks on it is fine.
                                       }}
                                   >
                                       {config.text}
                                   </div>
                               );
                           }
                       })()}
                   </div>
               )}
               
               <iframe 
                   src={activePdf.includes('drive.google.com') ? activePdf.replace('/view', '/preview') : activePdf} 
                   className="w-full h-full border-none relative z-0"
                   title="PDF Viewer"
                   sandbox="allow-scripts allow-same-origin"
               ></iframe>
           </div>
       ) : (
       <div className="p-6 space-y-4">
           {loading ? (
               <div className="space-y-4">
                   <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
                   <div className="h-24 bg-slate-100 rounded-2xl animate-pulse"></div>
               </div>
           ) : (
               <>
                   {/* FREE NOTES - GREEN BADGE */}
                   <button 
                       onClick={() => handlePdfClick('FREE')}
                       className="w-full p-5 rounded-2xl border-2 border-green-100 bg-white hover:bg-green-50 flex items-center gap-4 transition-all relative group overflow-hidden"
                   >
                       {/* BADGE */}
                       <div className="absolute top-3 right-3 flex items-center gap-1 bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                           <CheckCircle size={10} /> FREE
                       </div>

                       <div className="w-12 h-12 rounded-full bg-green-50 text-green-600 flex items-center justify-center border border-green-100">
                           <FileText size={24} />
                       </div>
                       <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-800">Free Notes</h4>
                           <p className="text-xs text-slate-500">Standard Quality PDF</p>
                       </div>
                       <div className="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
                           <ArrowLeft size={16} className="rotate-180" />
                       </div>
                   </button>

                   {/* PREMIUM NOTES - GOLD BADGE */}
                   <button 
                       onClick={() => handlePdfClick('PREMIUM')}
                       className="w-full p-5 rounded-2xl border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-white hover:border-yellow-300 flex items-center gap-4 transition-all relative group overflow-hidden"
                   >
                       {/* BADGE */}
                       <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full text-[10px] font-bold border border-yellow-200">
                           <Crown size={10} /> PREMIUM
                       </div>

                       <div className="w-12 h-12 rounded-full bg-yellow-100 text-yellow-600 flex items-center justify-center border border-yellow-200">
                           <Star size={24} fill="currentColor" />
                       </div>
                       <div className="flex-1 text-left">
                           <h4 className="font-bold text-slate-800">Premium Notes</h4>
                           <p className="text-xs text-slate-500">High Quality / Handwriting</p>
                       </div>
                       
                       {/* PRICE or LOCK */}
                       <div className="flex flex-col items-end">
                           <span className="text-xs font-black text-yellow-700">
                               {contentData?.price !== undefined ? contentData.price : (settings?.defaultPdfCost ?? 5)} CR
                           </span>
                           <span className="text-[10px] text-slate-400">Unlock</span>
                       </div>
                   </button>
               </>
           )}
           
           <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 mt-6 flex gap-3 items-start">
               <AlertCircle size={16} className="text-blue-500 mt-0.5" />
               <p className="text-xs text-blue-700 leading-relaxed">
                   <strong>Tip:</strong> Premium notes often contain handwritten solutions and extra examples not found in the free version.
               </p>
           </div>
       </div>
       )}

       {/* NEW CONFIRMATION MODAL */}
       {pendingPdf && (
           <CreditConfirmationModal 
               title={`Unlock ${pendingPdf.type === 'PREMIUM' ? 'Premium' : 'Free'} Notes`}
               cost={pendingPdf.price}
               userCredits={user.credits}
               isAutoEnabledInitial={!!user.isAutoDeductEnabled}
               onCancel={() => setPendingPdf(null)}
               onConfirm={(auto) => processPaymentAndOpen(pendingPdf.link, pendingPdf.price, auto)}
           />
       )}
    </div>
  );
};
