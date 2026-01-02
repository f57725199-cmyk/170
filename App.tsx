
import React, { useState, useEffect } from 'react';
import { 
  ClassLevel, Subject, Chapter, AppState, Board, Stream, User, ContentType, SystemSettings, ActivityLogEntry, WeeklyTest, LessonContent
} from './types';
import { getChapterData, saveChapterData, checkFirebaseConnection, saveTestResult, saveUserToLive, updateUserStatus, getUserData, subscribeToSettings } from './firebase';
import { fetchChapters, fetchLessonContent } from './services/gemini';
import { BoardSelection } from './components/BoardSelection';
import { ClassSelection } from './components/ClassSelection';
import { SubjectSelection } from './components/SubjectSelection';
import { ChapterSelection } from './components/ChapterSelection';
import { StreamSelection } from './components/StreamSelection';
import { LessonView } from './components/LessonView';
import { Auth } from './components/Auth';
import { AdminDashboard } from './components/AdminDashboard';
import { StudentDashboard } from './components/StudentDashboard';
import { AudioStudio } from './components/AudioStudio';
import { WelcomePopup } from './components/WelcomePopup';
import { PremiumModal } from './components/PremiumModal';
import { LoadingOverlay } from './components/LoadingOverlay';
import { RulesPage } from './components/RulesPage';
import { IICPage } from './components/IICPage';
import { StartupAd } from './components/StartupAd';
import { WeeklyTestView } from './components/WeeklyTestView';
import { FloatingDock } from './components/FloatingDock';
import { RewardPopup } from './components/RewardPopup';
import { CreditConfirmationModal } from './components/CreditConfirmationModal';
import { CustomAlert, CustomConfirm } from './components/CustomDialogs';
import { MarksheetCard } from './components/MarksheetCard';
import { BrainCircuit, Globe, LogOut, LayoutDashboard, BookOpen, Headphones, HelpCircle, Newspaper, KeyRound, Lock, X, ShieldCheck, FileText, UserPlus, EyeOff, WifiOff } from 'lucide-react';
import { SUPPORT_EMAIL } from './constants';
import { StudentTab, PendingReward, MCQResult } from './types';

const TermsPopup: React.FC<{ onClose: () => void, text?: string }> = ({ onClose, text }) => (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
        <div className="bg-white w-full max-w-lg md:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-white p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 z-10">
                <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                    <FileText className="text-[var(--primary)]" /> Terms & Conditions
                </h3>
            </div>
            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 leading-relaxed custom-scrollbar whitespace-pre-wrap">
                <p className="text-slate-900 font-medium">Please read carefully before using NST AI Assistant.</p>
                <p>{text || "By continuing, you agree to abide by these rules and the standard terms of service."}</p>
            </div>
            <div className="p-4 border-t border-slate-100 bg-white sticky bottom-0 z-10">
                <button onClick={onClose} className="w-full bg-[var(--primary)] hover:opacity-90 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all active:scale-95">I Agree & Continue</button>
            </div>
        </div>
    </div>
);

const App: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStartupAd, setShowStartupAd] = useState(false);

  const [state, setState] = useState<AppState>({
    user: null,
    originalAdmin: null,
    view: 'BOARDS',
    selectedBoard: null,
    selectedClass: null,
    selectedStream: null,
    selectedSubject: null,
    selectedChapter: null,
    chapters: [],
    lessonContent: null,
    loading: false,
    error: null,
    language: 'English',
    showWelcome: false,
    globalMessage: null,
    settings: {
        appName: 'IDEAL INSPIRATION CLASSES',
        appShortName: 'IIC',
        aiName: 'IIC AI',
        themeColor: '#3b82f6',
        maintenanceMode: false,
        maintenanceMessage: 'We are upgrading our servers. Please check back later.',
        customCSS: '',
        apiKeys: [],
        welcomeTitle: 'Unlock Smart Learning', 
        welcomeMessage: 'Experience the power of AI-driven education. Our AI filters out the noise of traditional textbooks to deliver only the essential, high-yield topics you need for success. Study smarter, not harder.',
        marqueeLines: ["Welcome to Online Classes", "Learn Smart", "Contact Admin for Credits"], 
        liveMessage1: '', 
        liveMessage2: '', 
        wheelRewards: [0, 1, 2, 5],
        chatCost: 1,
        dailyReward: 3,
        signupBonus: 2,
        isChatEnabled: true,
        isGameEnabled: true, 
        allowSignup: true,
        loginMessage: '',
        allowedClasses: ['6','7','8','9','10','11','12'],
        storageCapacity: '100 GB',
        isPaymentEnabled: true, 
        upiId: '',
        upiName: '',
        qrCodeUrl: '',
        paymentInstructions: '',
        packages: [
            { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
            { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
            { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
            { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
            { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
            { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
            { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
        ],
        subscriptionPlans: [
            { id: 'weekly', name: 'Weekly', duration: '7 days', basicPrice: 49, basicOriginalPrice: 99, ultraPrice: 79, ultraOriginalPrice: 149, features: ['Premium Content'], popular: false },
            { id: 'monthly', name: 'Monthly', duration: '30 days', basicPrice: 149, basicOriginalPrice: 299, ultraPrice: 199, ultraOriginalPrice: 399, features: ['Everything in Weekly', 'Live Chat'], popular: true },
            { id: 'quarterly', name: 'Quarterly', duration: '3 months', basicPrice: 399, basicOriginalPrice: 799, ultraPrice: 499, ultraOriginalPrice: 999, features: ['Everything in Monthly', 'Priority Support'], popular: false },
            { id: 'yearly', name: 'Yearly', duration: '365 days', basicPrice: 999, basicOriginalPrice: 1999, ultraPrice: 1499, ultraOriginalPrice: 2999, features: ['Everything in Quarterly', 'Priority Support'], popular: false },
            { id: 'lifetime', name: 'Lifetime', duration: 'Forever', basicPrice: 4999, basicOriginalPrice: 9999, ultraPrice: 7499, ultraOriginalPrice: 14999, features: ['VIP Status'], popular: true }
        ],
        startupAd: {
            enabled: false,
            duration: 2,
            title: "Premium Features",
            features: ["AI Notes Generator", "MCQ Practice", "Live Chat Support"],
            bgColor: "#1e293b",
            textColor: "#ffffff"
        },
        engagementRewards: [
            { id: 'def-1', seconds: 600, type: 'COINS', amount: 2, label: '10 Mins Study: 2 Coins', enabled: true },
            { id: 'def-2', seconds: 1800, type: 'COINS', amount: 4, label: '30 Mins Study: 4 Coins', enabled: true },
            { id: 'def-3', seconds: 3600, type: 'SUBSCRIPTION', subTier: 'WEEKLY', subLevel: 'BASIC', durationHours: 4, label: '1 Hour Study: Free Basic Sub (4h)', enabled: true },
            { id: 'def-4', seconds: 7200, type: 'SUBSCRIPTION', subTier: 'LIFETIME', subLevel: 'ULTRA', durationHours: 4, label: '2 Hours Study: Free Ultra Sub (4h)', enabled: true }
        ]
    }
  });

  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [tempSelectedChapter, setTempSelectedChapter] = useState<Chapter | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [generationDataReady, setGenerationDataReady] = useState(false);
  const [activeWeeklyTest, setActiveWeeklyTest] = useState<WeeklyTest | null>(null);
  const [studentTab, setStudentTab] = useState<StudentTab>('HOME');
  const [activeReward, setActiveReward] = useState<PendingReward | null>(null);
  const [lastTestResult, setLastTestResult] = useState<MCQResult | null>(null);
  
  // CUSTOM DIALOG STATE (GLOBAL)
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({isOpen: false, title: '', message: '', onConfirm: () => {}});

  // CREDIT CONFIRMATION STATE
  const [creditModal, setCreditModal] = useState<{
      isOpen: boolean;
      cost: number;
      title: string;
      onConfirm: (autoEnabled: boolean) => void;
  } | null>(null);

  // GLOBAL STUDY TIMER
  const [dailyStudySeconds, setDailyStudySeconds] = useState(0);
  
  // FULL SCREEN MODE (Hides Header/Footer/Dock)
  const [isFullScreen, setIsFullScreen] = useState(false);

  // --- REWARD CHECKER (Login & Pending) ---
  useEffect(() => {
      if (!state.user) return;
      const today = new Date().toDateString();
      const now = new Date();
      let updatedUser = { ...state.user };
      let hasUpdates = false;
      let newReward: PendingReward | null = null;

      // 1. Daily Login Bonus (10 Coins)
      const lastRewardDate = state.user.lastLoginRewardDate ? new Date(state.user.lastLoginRewardDate).toDateString() : '';
      if (lastRewardDate !== today && !activeReward) {
          updatedUser.credits = (updatedUser.credits || 0) + 10;
          updatedUser.lastLoginRewardDate = new Date().toISOString();
          hasUpdates = true;
          
          newReward = {
              id: `login-bonus-${today}`,
              type: 'COINS',
              amount: 10,
              label: 'Daily Login Bonus',
              expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
          };
      }

      // 2. Check Pending Unlocks (Prizes)
      // Only if no new reward set (priority to Login Bonus, next render will handle Prize)
      if (!newReward && !activeReward && updatedUser.pendingRewards && updatedUser.pendingRewards.length > 0) {
          const unlockIndex = updatedUser.pendingRewards.findIndex(r => !r.unlockDate || new Date(r.unlockDate) <= now);
          
          if (unlockIndex !== -1) {
              const item = updatedUser.pendingRewards[unlockIndex];
              newReward = item;
              
              // Remove from pending list (it moved to Active Popup)
              const newPending = [...updatedUser.pendingRewards];
              newPending.splice(unlockIndex, 1);
              updatedUser.pendingRewards = newPending;
              hasUpdates = true;
          }
      }

      if (hasUpdates || newReward) {
          if (hasUpdates) {
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              saveUserToLive(updatedUser);
              setState(prev => ({...prev, user: updatedUser}));
          }
          if (newReward) {
              setActiveReward(newReward);
          }
      }
  }, [state.user?.id, state.user?.lastLoginRewardDate, activeReward]); // Re-run when user or activeReward changes

  // --- ONLINE/OFFLINE DETECTOR ---
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // --- LIVE SETTINGS SYNC (REALTIME) ---
  useEffect(() => {
      // Subscribe to Firebase Settings Updates
      const unsubscribe = subscribeToSettings((newSettings) => {
          if (newSettings) {
              setState(prev => {
                  const hasChanges = JSON.stringify(prev.settings) !== JSON.stringify({...prev.settings, ...newSettings});
                  if (hasChanges) {
                      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
                      return {...prev, settings: {...prev.settings, ...newSettings}};
                  }
                  return prev;
              });
          }
      });
      return () => {
          if (unsubscribe) unsubscribe();
      };
  }, []);

  // --- SYNC USER PROFILE ON LOAD (ENSURE PREMIUM UPDATE VISIBLE) ---
  useEffect(() => {
      if (state.user) {
          getUserData(state.user.id).then(cloudUser => {
             if (cloudUser) {
                 // Ignore if identical
                 const currentStr = JSON.stringify(state.user);
                 const cloudStr = JSON.stringify(cloudUser);
                 if (currentStr !== cloudStr) {
                     console.log("Syncing User Profile from Cloud...");
                     localStorage.setItem('nst_current_user', cloudStr);
                     setState(prev => ({...prev, user: cloudUser}));
                 }
             }
          });
      }
  }, [state.user?.id]);

  useEffect(() => {
      // STARTUP AD LOGIC
      // const hasSeenAd = sessionStorage.getItem('nst_ad_seen');
      // if (!hasSeenAd) {
      //     setShowStartupAd(true);
      // }

      let loadedSettings = state.settings;
      const storedSettings = localStorage.getItem('nst_system_settings');
      if (storedSettings) {
          try {
              const parsed = JSON.parse(storedSettings);
              loadedSettings = { ...state.settings, ...parsed };
              setState(prev => ({ 
                  ...prev, 
                  settings: loadedSettings 
              }));
          } catch(e) {}
      }
      
      const hasAcceptedTerms = localStorage.getItem('nst_terms_accepted');
      if (!hasAcceptedTerms && loadedSettings.showTermsPopup !== false) setShowTerms(true);

      const hasSeenWelcome = localStorage.getItem('nst_has_seen_welcome');
      if (!hasSeenWelcome && hasAcceptedTerms && loadedSettings.showWelcomePopup !== false) setState(prev => ({ ...prev, showWelcome: true }));

      const loggedInUserStr = localStorage.getItem('nst_current_user');
      if (loggedInUserStr) {
        const user: User = JSON.parse(loggedInUserStr);
        if (!user.progress) user.progress = {};
        if (user.isLocked) { 
            localStorage.removeItem('nst_current_user'); 
            setAlertConfig({isOpen: true, message: "Account Locked. Please contact Admin."}); 
            return; 
        }

        let initialView = user.role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD';
        setState(prev => ({ 
          ...prev, user: user, view: initialView as any, selectedBoard: user.board || null, selectedClass: user.classLevel || null, selectedStream: user.stream || null, language: user.board === 'BSEB' ? 'Hindi' : 'English', showWelcome: !hasSeenWelcome && !!hasAcceptedTerms
        }));
      }
  }, []);

  // --- TIMER LOGIC (UPDATED) ---
  useEffect(() => {
    if (!state.user) return;

    // Load initial seconds from storage
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('nst_timer_date');
    const storedSeconds = parseInt(localStorage.getItem('nst_daily_study_seconds') || '0');

    if (storedDate !== today) {
        localStorage.setItem('nst_timer_date', today);
        localStorage.setItem('nst_daily_study_seconds', '0');
        setDailyStudySeconds(0);
    } else {
        setDailyStudySeconds(storedSeconds);
    }

    // TIMER STARTS AUTOMATICALLY ON LOGIN (GLOBAL)
    let interval: any;
    if (state.user) {
        interval = setInterval(() => {
            setDailyStudySeconds(prev => {
                const next = prev + 1;
                localStorage.setItem('nst_daily_study_seconds', next.toString());
                
                // NEW: CHECK FOR DAILY REWARDS (DYNAMIC)
                if (state.user && state.settings.engagementRewards) {
                    state.settings.engagementRewards.forEach(reward => {
                        if (reward.enabled && next === reward.seconds) {
                             setActiveReward({
                                id: `rew-${Date.now()}`,
                                type: reward.type,
                                amount: reward.amount,
                                subTier: reward.subTier,
                                subLevel: reward.subLevel,
                                durationHours: reward.durationHours,
                                label: reward.label,
                                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                            });
                        }
                    });
                }

                if (next % 10 === 0) updateUserStatus(state.user!.id, next); 
                return next;
            });
        }, 1000);
    }

    return () => {
        if (interval) clearInterval(interval);
    };
  }, [state.user?.id, state.view]); 

  useEffect(() => {
      document.title = `${state.settings.appName}`;
      const styleId = 'nst-custom-styles';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
          styleTag = document.createElement('style');
          styleTag.id = styleId;
          document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `:root { --primary: ${state.settings.themeColor || '#3b82f6'}; } .text-primary { color: var(--primary); } .bg-primary { background-color: var(--primary); } .border-primary { border-color: var(--primary); } ${state.settings.customCSS || ''}`;
  }, [state.settings]);

  // --- LOGGING SYSTEM ---
  const logActivity = (action: string, details: string, overrideUser?: User) => {
      const u = overrideUser || state.user;
      if (!u && !overrideUser) return;
      
      const newLog: ActivityLogEntry = {
          id: Date.now().toString() + Math.random(),
          userId: u!.id,
          userName: u!.name,
          role: u!.role,
          action: action,
          details: details,
          timestamp: new Date().toISOString()
      };

      const storedLogs = localStorage.getItem('nst_activity_log');
      const logs: ActivityLogEntry[] = storedLogs ? JSON.parse(storedLogs) : [];
      // Keep last 500 logs
      const updatedLogs = [...logs, newLog].slice(-500); 
      localStorage.setItem('nst_activity_log', JSON.stringify(updatedLogs));
  };

  const updateSettings = (newSettings: SystemSettings) => {
      setState(prev => ({...prev, settings: newSettings}));
      localStorage.setItem('nst_system_settings', JSON.stringify(newSettings));
  };

  const handleAcceptTerms = () => {
      localStorage.setItem('nst_terms_accepted', 'true');
      setShowTerms(false);
      const hasSeenWelcome = localStorage.getItem('nst_has_seen_welcome');
      if (!hasSeenWelcome) setState(prev => ({ ...prev, showWelcome: true }));
  };

  const handleStartApp = () => {
    localStorage.setItem('nst_has_seen_welcome', 'true');
    setState(prev => ({ ...prev, showWelcome: false }));
  };

  const handleLogin = (user: User) => {
    localStorage.setItem('nst_current_user', JSON.stringify(user));
    saveUserToLive(user); // छात्र का डेटा क्लाउड पर भेजें
    localStorage.setItem('nst_has_seen_welcome', 'true');
    setState(prev => ({ ...prev, user, view: user.role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' as any, selectedBoard: user.board || null, selectedClass: user.classLevel || null, selectedStream: user.stream || null, language: user.board === 'BSEB' ? 'Hindi' : 'English', showWelcome: false }));
  };

  const handleLogout = () => {
    logActivity("LOGOUT", "User Logged Out");
    localStorage.removeItem('nst_current_user');
    setState(prev => ({ ...prev, user: null, originalAdmin: null, view: 'BOARDS', selectedBoard: null, selectedClass: null, selectedStream: null, selectedSubject: null, lessonContent: null, language: 'English' }));
    setDailyStudySeconds(0);
  };

  const handleImpersonate = (targetUser: User) => {
      if (state.user?.role !== 'ADMIN') return;
      logActivity("IMPERSONATE", `Admin accessed as ${targetUser.name}`);
      setState(prev => ({ ...prev, originalAdmin: prev.user, user: targetUser, view: 'STUDENT_DASHBOARD', selectedBoard: targetUser.board || null, selectedClass: targetUser.classLevel || null, selectedStream: targetUser.stream || null, language: targetUser.board === 'BSEB' ? 'Hindi' : 'English' }));
  };

  const handleReturnToAdmin = () => {
      if (!state.originalAdmin) return;
      setState(prev => ({ ...prev, user: prev.originalAdmin, originalAdmin: null, view: 'ADMIN_DASHBOARD', selectedBoard: null, selectedClass: null }));
  };

  const handleBoardSelect = (board: Board) => { setState(prev => ({ ...prev, selectedBoard: board, view: 'CLASSES', language: board === 'BSEB' ? 'Hindi' : 'English' })); };
  const handleClassSelect = (level: ClassLevel) => {
      if (level === '11' || level === '12') {
          setState(prev => ({ ...prev, selectedClass: level, view: 'STREAMS' }));
      } else if (level === 'COMPETITION') {
          setState(prev => ({ ...prev, selectedClass: level, selectedStream: null, view: 'SUBJECTS' }));
      } else {
          setState(prev => ({ ...prev, selectedClass: level, selectedStream: null, view: 'SUBJECTS' }));
      }
  };
  const handleStreamSelect = (stream: Stream) => { setState(prev => ({ ...prev, selectedStream: stream, view: 'SUBJECTS' })); };
  const handleSubjectSelect = async (subject: Subject) => {
    setState(prev => ({ ...prev, selectedSubject: subject, loading: true }));
    try {
      if (state.selectedClass && state.selectedBoard) {
        const chapters = await fetchChapters(state.selectedBoard, state.selectedClass, state.selectedStream, subject, state.language);
        setState(prev => ({ ...prev, chapters, view: 'CHAPTERS', loading: false }));
      }
    } catch (err) { setState(prev => ({ ...prev, chapters: [], view: 'CHAPTERS', loading: false })); }
  };

  const onChapterClick = (chapter: Chapter) => {
      setTempSelectedChapter(chapter);
      setShowPremiumModal(true);
  };

  const handleContentGeneration = async (type: ContentType, count?: number, forcePay: boolean = false) => {
    setShowPremiumModal(false);
    if (!tempSelectedChapter || !state.user) return;
    
    // --- HTML NOTES HANDLING ---
    if (type === 'NOTES_HTML_FREE' || type === 'NOTES_HTML_PREMIUM') {
        const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
        const mainKey = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}`;
        
        let contentData = await getChapterData(mainKey);
        if (!contentData) {
            const stored = localStorage.getItem(mainKey);
            if (stored) contentData = JSON.parse(stored);
        }

        const htmlContent = type === 'NOTES_HTML_FREE' ? contentData?.freeNotesHtml : contentData?.premiumNotesHtml;
        
        if (!htmlContent) {
            // Replaced Alert with Coming Soon View
            setState(prev => ({ 
                ...prev, 
                selectedChapter: tempSelectedChapter, 
                lessonContent: {
                    id: Date.now().toString(),
                    title: tempSelectedChapter.title,
                    subtitle: "Content Unavailable",
                    content: "",
                    type: type,
                    dateCreated: new Date().toISOString(),
                    subjectName: state.selectedSubject?.name || '',
                    isComingSoon: true
                }, 
                view: 'LESSON' 
            }));
            setIsFullScreen(true);
            return;
        }

        const cost = type === 'NOTES_HTML_PREMIUM' ? 5 : 0;
         if (state.user.role !== 'ADMIN' && !state.originalAdmin && cost > 0) {
             if (state.user.credits < cost) {
                 setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${cost} Credits.`});
                 return;
             }

             // CONFIRMATION CHECK
             if (!state.user.isAutoDeductEnabled && !forcePay) {
                 setCreditModal({
                     isOpen: true,
                     cost,
                     title: "Unlock Premium Notes",
                     onConfirm: (auto) => {
                         if (auto) {
                             const u = { ...state.user!, isAutoDeductEnabled: true };
                             saveUserToLive(u);
                             setState(p => ({...p, user: u}));
                         }
                         setCreditModal(null);
                         handleContentGeneration(type, count, true);
                     }
                 });
                 return;
             }

             const updatedUser = { ...state.user, credits: state.user.credits - cost };
             localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
             saveUserToLive(updatedUser);
             setState(prev => ({...prev, user: updatedUser}));
        }

        const lessonContent: LessonContent = {
            id: Date.now().toString(),
            title: tempSelectedChapter.title,
            subtitle: type === 'NOTES_HTML_PREMIUM' ? 'Premium Notes (Rich Text)' : 'Free Notes (Rich Text)',
            content: htmlContent,
            type: type,
            dateCreated: new Date().toISOString(),
            subjectName: state.selectedSubject?.name || ''
        };
        
        setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, lessonContent, view: 'LESSON' }));
        setIsFullScreen(true); // AI Lesson is Full Screen
        return;
    }

    // Check Cost Logic
    let cost = 0;
    const streamKey = (state.selectedClass === '11' || state.selectedClass === '12') ? `-${state.selectedStream}` : '';
    
    // 1. Construct Keys
    const mainKey = `nst_content_${state.selectedBoard}_${state.selectedClass}${streamKey}_${state.selectedSubject?.name}_${tempSelectedChapter.id}`;
    const typeKey = `${mainKey}_${type}`;

    // 2. Try Fetching Admin Data (Main Key) - Consolidates all links
    let onlineContent: any = await getChapterData(mainKey);
    let foundAdminContent = false;

    // Filter Admin Data for the requested Type
    if (onlineContent) {
        if (type === 'PDF_FREE' && onlineContent.freeLink) {
            onlineContent = { ...onlineContent, content: onlineContent.freeLink, type, price: 0 };
            foundAdminContent = true;
        } else if (type === 'PDF_PREMIUM' && onlineContent.premiumLink) {
            onlineContent = { ...onlineContent, content: onlineContent.premiumLink, type }; // Uses default price from object
            foundAdminContent = true;
        } else if (type === 'PDF_ULTRA' && onlineContent.ultraPdfLink) {
            onlineContent = { ...onlineContent, content: onlineContent.ultraPdfLink, type, price: 10 }; // Ultra defaults to 10
            foundAdminContent = true;
        } else if (type === 'VIDEO_LECTURE' && (onlineContent.videoPlaylist?.length > 0 || onlineContent.freeVideoLink || onlineContent.premiumVideoLink)) {
            // Prioritize Playlist -> Premium Link -> Free Link
            const videoUrl = onlineContent.premiumVideoLink || onlineContent.freeVideoLink || '';
            const vidPrice = onlineContent.videoCreditsCost !== undefined ? onlineContent.videoCreditsCost : 5;
            onlineContent = { ...onlineContent, content: videoUrl, videoPlaylist: onlineContent.videoPlaylist, type, price: vidPrice };
            foundAdminContent = true;
        } else {
            // Not found in Admin Data for this specific type (might be AI content)
            onlineContent = null;
        }
    }

    // 3. If not in Admin Data, check Type-Specific Key (Legacy/AI Generated)
    if (!onlineContent) {
        onlineContent = await getChapterData(typeKey);
    }

    if (onlineContent) {
         if(onlineContent.price !== undefined) cost = onlineContent.price;
    }

    // --- ACCESS CONTROL LOGIC (Unified) ---
    let hasAccess = false;
    
    // 1. Admin / System
    if (state.user.role === 'ADMIN' || state.originalAdmin) {
        hasAccess = true;
    } 
    // 2. Cost is 0 (Free Content)
    else if (cost === 0) {
        hasAccess = true;
    }
    // 3. Subscription Check
    else if (state.user.isPremium && state.user.subscriptionEndDate && new Date(state.user.subscriptionEndDate) > new Date()) {
        const userLevel = state.user.subscriptionLevel || 'BASIC'; // Default to BASIC if undefined
        
        // ULTRA Access: Everything
        if (userLevel === 'ULTRA') {
            hasAccess = true;
        } 
        // BASIC Access: MCQ & Notes (HTML) & AI Notes
        else if (userLevel === 'BASIC') {
            if (['MCQ_ANALYSIS', 'MCQ_SIMPLE', 'NOTES_HTML_FREE', 'NOTES_HTML_PREMIUM', 'NOTES_PREMIUM', 'NOTES_SIMPLE'].includes(type)) {
                hasAccess = true;
            }
            // PDF/VIDEO/UltraPDF remain locked for Basic
        }
    }

    // 4. Credit Deduction (Fallback)
    if (!hasAccess) {
        if (state.user.credits >= cost) {
            
            // NEW: CONFIRMATION CHECK
            if (!state.user.isAutoDeductEnabled && !forcePay) {
                 setCreditModal({
                     isOpen: true,
                     cost,
                     title: "Unlock AI Content",
                     onConfirm: (auto) => {
                         if (auto) {
                             const u = { ...state.user!, isAutoDeductEnabled: true };
                             saveUserToLive(u);
                             setState(p => ({...p, user: u}));
                         }
                         setCreditModal(null);
                         handleContentGeneration(type, count, true);
                     }
                 });
                 return;
            }

            // Deduct Credits
            const updatedUser = { ...state.user, credits: state.user.credits - cost };
            localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
            
            // Sync to LocalStorage list
            const storedUsers = localStorage.getItem('nst_users');
            if (storedUsers) {
                const allUsers = JSON.parse(storedUsers);
                const idx = allUsers.findIndex((u:User) => u.id === updatedUser.id);
                if (idx !== -1) { 
                    allUsers[idx] = updatedUser; 
                    localStorage.setItem('nst_users', JSON.stringify(allUsers)); 
                }
            }
            // Sync to Live
            saveUserToLive(updatedUser);
            
            setState(prev => ({...prev, user: updatedUser}));
            hasAccess = true; // Access Granted via Credits
        } else {
            setAlertConfig({isOpen: true, message: `Insufficient Credits! This content costs ${cost} credits.\n\nTip: Upgrade to Subscription to access unlimited content.`});
            return;
        }
    }

    setState(prev => ({ ...prev, selectedChapter: tempSelectedChapter, loading: true }));
    setGenerationDataReady(false); 
    
    logActivity("CONTENT_GEN", `Opened ${type} for ${tempSelectedChapter.title}`);

    try {
        // Try to use online content if available
        if (onlineContent) {
            setState(prev => ({ ...prev, lessonContent: onlineContent }));
            setGenerationDataReady(true);
            return;
        }

        const content = await fetchLessonContent(
          state.selectedBoard!, state.selectedClass!, state.selectedStream!, state.selectedSubject!, tempSelectedChapter, state.language, type, 
          0, false, 15, "", state.user?.role === 'ADMIN'
        );
        
        // Save generated content to Firebase
        await saveChapterData(mainKey, content);

        setState(prev => ({ ...prev, lessonContent: content }));
        setGenerationDataReady(true); // Immediate ready for link mode
        setIsFullScreen(true); // Auto Full Screen for Lesson
    } catch (err) {
      setState(prev => ({ ...prev, loading: false }));
    }
  };
  
  const handleLoadingAnimationComplete = () => { 
      setState(prev => ({ ...prev, loading: false, view: 'LESSON' })); 
      setIsFullScreen(true);
  };

  const handleClaimReward = () => {
      if (!activeReward || !state.user) return;
      
      let updatedUser = { ...state.user };
      
      if (activeReward.type === 'COINS') {
          updatedUser.credits = (updatedUser.credits || 0) + (activeReward.amount || 0);
      } else if (activeReward.type === 'SUBSCRIPTION') {
          updatedUser.subscriptionTier = activeReward.subTier as any;
          updatedUser.subscriptionLevel = activeReward.subLevel;
          updatedUser.subscriptionEndDate = new Date(Date.now() + (activeReward.durationHours || 4) * 60 * 60 * 1000).toISOString();
          updatedUser.isPremium = true;
          updatedUser.grantedByAdmin = true;
      }
      
      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser);
      setState(prev => ({...prev, user: updatedUser}));
      setActiveReward(null);
      setAlertConfig({isOpen: true, message: `🎉 Reward Claimed: ${activeReward.label}`});
  };

  const handleIgnoreReward = () => {
      if (!activeReward || !state.user) return;
      
      const updatedUser = { 
          ...state.user, 
          pendingRewards: [...(state.user.pendingRewards || []), activeReward] 
      };
      
      localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
      saveUserToLive(updatedUser);
      setState(prev => ({...prev, user: updatedUser}));
      setActiveReward(null);
  };

  const handleStartWeeklyTest = (test: WeeklyTest) => {
    setActiveWeeklyTest(test);
  };

  const handleWeeklyTestComplete = async (score: number, total: number, answers: Record<number, number>) => {
    if (!activeWeeklyTest || !state.user) return;
    
    // Save Attempt
    const attempt = {
        testId: activeWeeklyTest.id,
        testName: activeWeeklyTest.name,
        userId: state.user.id,
        userName: state.user.name,
        startedAt: localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`) || new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        score: Math.round((score / total) * 100),
        totalQuestions: total,
        answers: answers
    };
    
    // 1. Local Backup
    const key = `nst_test_attempts_${state.user.id}`;
    const attempts = JSON.parse(localStorage.getItem(key) || '{}');
    attempts[activeWeeklyTest.id] = attempt;
    localStorage.setItem(key, JSON.stringify(attempts));

    // 2. Firestore Sync (So Admin can see)
    await saveTestResult(state.user.id, attempt);
    
    logActivity("TEST_SUBMIT", `Completed ${activeWeeklyTest.name} with score ${score}/${total}`);
    setActiveWeeklyTest(null);
    
    // AUTOMATIC REWARD: PARTICIPATION (24 Hours Free)
    // "baki sab ko jo test diye ho unko 24 ghanta free subscription"
    const rewardEndDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const updatedUser = { 
        ...state.user, 
        subscriptionTier: 'WEEKLY' as any, // 24h Access (mapped to valid tier)
        subscriptionEndDate: rewardEndDate,
        grantedByAdmin: true 
    };
    localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
    await saveUserToLive(updatedUser);

    // Create Result Object for Marksheet
    const startTimeStr = localStorage.getItem(`weekly_test_start_${activeWeeklyTest.id}`);
    const timeTaken = startTimeStr ? (Date.now() - parseInt(startTimeStr)) / 1000 : 0;
    
    const omrData = activeWeeklyTest.questions.map((q, idx) => ({
        qIndex: idx,
        selected: answers[idx] !== undefined ? answers[idx] : -1,
        correct: q.correctAnswer
    }));

    const result: MCQResult = {
        id: `wt-${Date.now()}`,
        userId: state.user.id,
        chapterId: activeWeeklyTest.id,
        subjectId: 'WEEKLY',
        subjectName: 'Weekly Test',
        chapterTitle: activeWeeklyTest.name,
        date: new Date().toISOString(),
        totalQuestions: total,
        correctCount: score,
        wrongCount: total - score,
        score: score,
        totalTimeSeconds: timeTaken,
        averageTimePerQuestion: total > 0 ? timeTaken / total : 0,
        performanceTag: (score / total) >= 0.8 ? 'EXCELLENT' : (score / total) >= 0.5 ? 'GOOD' : 'BAD',
        classLevel: activeWeeklyTest.classLevel,
        omrData: omrData
    };
    
    setLastTestResult(result);
    // setAlertConfig({isOpen: true, message: `Test Submitted! You scored ${score}/${total}.\n\n🎁 REWARD UNLOCKED: 24 Hours Free Subscription granted for participating!`});
    
    // Cleanup Local Timer
    localStorage.removeItem(`weekly_test_start_${activeWeeklyTest.id}`);
  };

  // --- SAFE NAVIGATION LOGIC ---
  const goHome = () => {
     if (state.user?.role === 'STUDENT' || state.originalAdmin) {
         setState(prev => ({...prev, view: 'STUDENT_DASHBOARD'}));
     } else if (state.user?.role === 'ADMIN') {
         setState(prev => ({...prev, view: 'ADMIN_DASHBOARD'}));
     }
  };

  const goBack = () => {
    // Exit Full Screen if active
    if (isFullScreen) {
        setIsFullScreen(false);
        // If viewing lesson, go back to chapters
        if (state.view === 'LESSON') {
             setState(prev => ({ ...prev, view: 'CHAPTERS', lessonContent: null }));
             return;
        }
        // If inside StudentDashboard (e.g. Video Player), we let StudentDashboard handle the back logic
        // But here we are in App level.
        // StudentDashboard calls goBack prop? 
        // No, StudentDashboard has its own onBack for players.
        // Wait, FloatingDock calls goBack which calls this goBack.
        // If FloatingDock is hidden, user uses the Back button inside the Player (VideoPlaylistView).
        // That Back button in Player calls `onBack` prop of Player, which calls `setContentViewStep('CHAPTERS')` in StudentDashboard.
        // It does NOT call this global `goBack`.
        // So we just need to ensure `isFullScreen` is reset when StudentDashboard exits player.
    }

    if (activeWeeklyTest) {
        setConfirmConfig({
            isOpen: true,
            title: "Quit Test?",
            message: "Progress may be lost unless submitted. Are you sure?",
            onConfirm: () => {
                setActiveWeeklyTest(null);
                setConfirmConfig(prev => ({...prev, isOpen: false}));
            }
        });
        return;
    }

    setState(prev => {
      // 1. Content -> Chapters
      if (prev.view === 'LESSON') return { ...prev, view: 'CHAPTERS', lessonContent: null };

      // 2. Chapters -> Dashboard (for Students) OR Subjects (Admin)
      if (prev.view === 'CHAPTERS') {
          // If Student, go DIRECTLY to Dashboard. Don't unwind to subjects/boards.
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedChapter: null, selectedSubject: null };
          }
          return { ...prev, view: 'SUBJECTS', selectedChapter: null };
      }

      // 3. Subjects -> Dashboard (for Students) OR Classes (Admin)
      if (prev.view === 'SUBJECTS') {
          // If Student, go DIRECTLY to Dashboard
          if (prev.user?.role === 'STUDENT' || prev.originalAdmin) {
              return { ...prev, view: 'STUDENT_DASHBOARD', selectedSubject: null };
          }
          return { ...prev, view: ['11','12'].includes(prev.selectedClass||'') ? 'STREAMS' : 'CLASSES', selectedSubject: null };
      }

      if (prev.view === 'STREAMS') return { ...prev, view: 'CLASSES', selectedStream: null };
      if (prev.view === 'CLASSES') return { ...prev, view: 'BOARDS', selectedClass: null };
      
      // 4. Boards -> Dashboard or Admin
      if (prev.view === 'BOARDS') {
          const nextView = prev.user?.role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD';
          return { ...prev, view: nextView as any, selectedBoard: null };
      }
      
      return { ...prev, view: prev.user?.role === 'ADMIN' ? 'ADMIN_DASHBOARD' as any : 'STUDENT_DASHBOARD' as any };
    });
  };

  // --- OFFLINE SCREEN ---
  if (!isOnline) {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <WifiOff size={80} className="text-red-500 mb-6 animate-pulse" />
              <h1 className="text-3xl font-black mb-2">Internet Not Connected</h1>
              <p className="text-slate-400 mb-8 max-w-sm">
                  Please check your internet connection to continue using NST AI Assistant.
              </p>
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  {state.settings.footerText || 'Developed by Nadim Anwar'}
              </div>
          </div>
      );
  }

  // --- MAINTENANCE SCREEN ---
  if (state.settings.maintenanceMode && state.user?.role !== 'ADMIN') {
      return (
          <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-8 text-center animate-in fade-in">
              <div className="bg-red-500/10 p-6 rounded-full mb-6 animate-pulse">
                  <Lock size={64} className="text-red-500" />
              </div>
              <h1 className="text-3xl font-black mb-4">Under Maintenance</h1>
              <p className="text-slate-400 mb-8 max-w-sm leading-relaxed">
                  {state.settings.maintenanceMessage || "We are currently upgrading our servers. Please check back later."}
              </p>
              
              {/* Secret Admin Login */}
              <button 
                  onClick={() => setState(prev => ({...prev, user: null, view: 'BOARDS', settings: {...prev.settings, maintenanceMode: false}}))} 
                  className="text-[10px] text-slate-700 hover:text-slate-500 font-bold uppercase tracking-widest"
              >
                  Admin Bypass
              </button>
          </div>
      );
  }

  // --- STARTUP AD SCREEN ---
  if (showStartupAd && state.settings.startupAd?.enabled) {
      return (
          <StartupAd 
              config={state.settings.startupAd} 
              onClose={() => {
                  setShowStartupAd(false);
                  sessionStorage.setItem('nst_ad_seen', 'true');
              }} 
          />
      );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans relative">
      
      {/* GLOBAL LIVE DASHBOARD 1 (TOP) */}
      {state.settings.liveMessage1 && (
          <div className="bg-red-600 text-white text-[10px] font-bold py-1 overflow-hidden relative whitespace-nowrap z-50">
              <div className="animate-marquee inline-block">{state.settings.liveMessage1} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage1} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage1}</div>
          </div>
      )}

      {/* IMPERSONATION RETURN BUTTON */}
      {state.originalAdmin && (
          <div className="fixed bottom-12 right-6 z-[90] animate-bounce">
              <button onClick={handleReturnToAdmin} className="bg-red-600 text-white font-bold py-3 px-6 rounded-full shadow-2xl flex items-center gap-2 border-4 border-white">
                  <EyeOff size={20} /> Exit User View
              </button>
          </div>
      )}

      {showTerms && <TermsPopup onClose={handleAcceptTerms} text={state.settings.termsText} />}

      {!isFullScreen && (
      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
           <div onClick={() => setState(prev => ({ ...prev, view: state.user?.role === 'ADMIN' ? 'ADMIN_DASHBOARD' : 'STUDENT_DASHBOARD' as any }))} className="flex items-center gap-2 cursor-pointer">
               <div className="bg-[var(--primary)] rounded-lg p-1.5 text-white"><BrainCircuit size={20} /></div>
               <h1 className="text-xl font-black text-slate-800">{state.settings.appName}</h1>
           </div>
           {state.user && (
               <div className="flex items-center gap-2">
                   <div className="text-right hidden md:block">
                       <div className="text-xs font-bold text-slate-800">{state.user.name}</div>
                   </div>
                   <button onClick={handleLogout} className="p-2 text-red-400 hover:bg-red-50 rounded-full"><LogOut size={20} /></button>
               </div>
           )}
        </div>
      </header>
      )}

      <main className={`flex-1 w-full max-w-6xl mx-auto ${isFullScreen ? 'p-0' : 'p-4 mb-8'}`}>
        {!state.user ? (
            <Auth onLogin={handleLogin} logActivity={logActivity} />
        ) : (
            <>
                {state.view === 'ADMIN_DASHBOARD' && state.user.role === 'ADMIN' && <AdminDashboard onNavigate={(v) => setState(prev => ({...prev, view: v}))} settings={state.settings} onUpdateSettings={updateSettings} onImpersonate={handleImpersonate} logActivity={logActivity} />}
                
                {/* ACTIVE WEEKLY TEST OVERRIDE */}
                {activeWeeklyTest ? (
                    <WeeklyTestView 
                        test={activeWeeklyTest} 
                        onComplete={handleWeeklyTestComplete} 
                        onExit={() => { 
                            setConfirmConfig({
                                isOpen: true,
                                title: "Quit Test?",
                                message: "Are you sure you want to quit the ongoing test?",
                                onConfirm: () => {
                                    setActiveWeeklyTest(null);
                                    setConfirmConfig(prev => ({...prev, isOpen: false}));
                                }
                            });
                        }} 
                    />
                ) : (
                    state.view === 'STUDENT_DASHBOARD' as any && (
                        <StudentDashboard 
                            user={state.user} 
                            dailyStudySeconds={dailyStudySeconds} 
                            onSubjectSelect={handleSubjectSelect} 
                            onRedeemSuccess={u => setState(prev => ({...prev, user: u}))} 
                            settings={state.settings} 
                            onStartWeeklyTest={handleStartWeeklyTest} 
                            activeTab={studentTab} 
                            onTabChange={setStudentTab} 
                            setFullScreen={setIsFullScreen} // PASSED PROP
                            onNavigate={(v) => setState(prev => ({...prev, view: v}))}
                        />
                    )
                )}
                
                {(!activeWeeklyTest && state.view === 'BOARDS') && <BoardSelection onSelect={handleBoardSelect} onBack={goBack} />}
                {state.view === 'CLASSES' && <ClassSelection selectedBoard={state.selectedBoard} allowedClasses={state.user?.role === 'ADMIN' ? undefined : state.settings.allowedClasses} onSelect={handleClassSelect} onBack={goBack} />}
                {state.view === 'STREAMS' && <StreamSelection onSelect={handleStreamSelect} onBack={goBack} />}
                {state.view === 'SUBJECTS' && state.selectedClass && <SubjectSelection classLevel={state.selectedClass} stream={state.selectedStream} onSelect={handleSubjectSelect} onBack={goBack} />}
                {state.view === 'CHAPTERS' && state.selectedSubject && <ChapterSelection chapters={state.chapters} subject={state.selectedSubject} classLevel={state.selectedClass!} loading={state.loading && state.view === 'CHAPTERS'} user={state.user} onSelect={onChapterClick} onBack={goBack}/>}
                {state.view === 'LESSON' && state.lessonContent && <LessonView content={state.lessonContent} subject={state.selectedSubject!} classLevel={state.selectedClass!} chapter={state.selectedChapter!} loading={false} onBack={goBack} />}
            </>
        )}
      </main>
      
      {/* PERSISTENT FOOTER - Hide in Student Dashboard as it has its own Bottom Nav */}
      {!isFullScreen && state.view !== 'STUDENT_DASHBOARD' && (
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-1 text-center z-[40]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {state.settings.footerText || 'Developed by Nadim Anwar'}
          </p>
      </footer>
      )}

      {/* GLOBAL LIVE DASHBOARD 2 (BOTTOM) */}
      {state.settings.liveMessage2 && (
          <div className="fixed bottom-6 left-0 right-0 bg-blue-600 text-white text-[10px] font-bold py-1 overflow-hidden relative whitespace-nowrap z-[39]">
              <div className="animate-marquee-reverse inline-block">{state.settings.liveMessage2} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage2} &nbsp;&nbsp;&bull;&nbsp;&nbsp; {state.settings.liveMessage2}</div>
          </div>
      )}

      {state.loading && <LoadingOverlay dataReady={generationDataReady} onComplete={handleLoadingAnimationComplete} />}
      {showPremiumModal && tempSelectedChapter && state.user && (
          <PremiumModal user={state.user} chapter={tempSelectedChapter} credits={state.user.credits || 0} isAdmin={state.user.role === 'ADMIN'} onSelect={handleContentGeneration} onClose={() => setShowPremiumModal(false)} />
      )}
      {state.showWelcome && <WelcomePopup onStart={handleStartApp} isResume={!!state.user} title={state.settings.welcomeTitle} message={state.settings.welcomeMessage} footerText={state.settings.footerText} />}
      
      {/* FLOATING DOCK */}
      {state.user && !activeWeeklyTest && !isFullScreen && (
          <FloatingDock 
            onTabSelect={setStudentTab} 
            onGoHome={goHome} 
            onGoBack={goBack} 
            isStudent={state.user.role === 'STUDENT' || !!state.originalAdmin} 
            settings={state.settings}
          />
      )}
      
      {activeReward && <RewardPopup reward={activeReward} onClaim={handleClaimReward} onIgnore={handleIgnoreReward} />}
      
      {lastTestResult && state.user && (
          <MarksheetCard 
              result={lastTestResult} 
              user={state.user} 
              settings={state.settings} 
              onClose={() => setLastTestResult(null)} 
          />
      )}

      {creditModal && state.user && (
          <CreditConfirmationModal 
              title={creditModal.title}
              cost={creditModal.cost}
              userCredits={state.user.credits}
              isAutoEnabledInitial={!!state.user.isAutoDeductEnabled}
              onConfirm={creditModal.onConfirm}
              onCancel={() => setCreditModal(null)}
          />
      )}

      {/* GLOBAL DIALOGS */}
      <CustomAlert 
          isOpen={alertConfig.isOpen} 
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
    </div>
  );
};
export default App;
