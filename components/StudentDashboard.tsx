
import React, { useState, useEffect } from 'react';
import { User, Subject, StudentTab, SystemSettings, CreditPackage, WeeklyTest, Chapter } from '../types';
import { updateUserStatus, db, saveUserToLive, getChapterData } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getSubjectsList } from '../constants';
import { RedeemSection } from './RedeemSection';
import { Store } from './Store';
import { Zap, Crown, Calendar, Clock, History, Layout, Gift, Sparkles, Megaphone, Lock, BookOpen, AlertCircle, Edit, Settings, Play, Pause, RotateCcw, MessageCircle, Gamepad2, Timer, CreditCard, Send, CheckCircle, Mail, X, Ban, Smartphone, Trophy, ShoppingBag, ArrowRight, Video, Youtube, Home, User as UserIcon, Book } from 'lucide-react';
import { SubjectSelection } from './SubjectSelection';
import { ChapterSelection } from './ChapterSelection'; // Imported for Video Flow
import { VideoPlaylistView } from './VideoPlaylistView'; // Imported for Video Flow
import { PdfView } from './PdfView'; // Imported for PDF Flow
import { McqView } from './McqView'; // Imported for MCQ Flow
import { HistoryPage } from './HistoryPage';
import { UniversalChat } from './UniversalChat';
import { Leaderboard } from './Leaderboard';
import { SpinWheel } from './SpinWheel';
import { fetchChapters } from '../services/gemini'; // Needed for Video Flow
import { FileText, CheckSquare } from 'lucide-react'; // Icons
import { LoadingOverlay } from './LoadingOverlay';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { UserGuide } from './UserGuide';
import { SyllabusStructure } from './SyllabusStructure';
import { CustomAlert } from './CustomDialogs';
import { AnalyticsPage } from './AnalyticsPage';

interface Props {
  user: User;
  dailyStudySeconds: number; // Received from Global App
  onSubjectSelect: (subject: Subject) => void;
  onRedeemSuccess: (user: User) => void;
  settings?: SystemSettings; // New prop
  onStartWeeklyTest?: (test: WeeklyTest) => void;
  activeTab: StudentTab;
  onTabChange: (tab: StudentTab) => void;
  setFullScreen: (full: boolean) => void; // Passed from App
  onNavigate?: (view: 'ADMIN_DASHBOARD') => void; // Added for Admin Switch
}

const DEFAULT_PACKAGES: CreditPackage[] = [
    { id: 'pkg-1', name: 'Starter Pack', price: 100, credits: 150 },
    { id: 'pkg-2', name: 'Value Pack', price: 200, credits: 350 },
    { id: 'pkg-3', name: 'Pro Pack', price: 500, credits: 1500 },
    { id: 'pkg-4', name: 'Ultra Pack', price: 1000, credits: 3000 },
    { id: 'pkg-5', name: 'Mega Pack', price: 2000, credits: 7000 },
    { id: 'pkg-6', name: 'Giga Pack', price: 3000, credits: 12000 },
    { id: 'pkg-7', name: 'Ultimate Pack', price: 5000, credits: 20000 }
];

export const StudentDashboard: React.FC<Props> = ({ user, dailyStudySeconds, onSubjectSelect, onRedeemSuccess, settings, onStartWeeklyTest, activeTab, onTabChange, setFullScreen, onNavigate }) => {
  // const [activeTab, setActiveTab] = useState<StudentTab>('VIDEO'); // REMOVED LOCAL STATE
  const [testAttempts, setTestAttempts] = useState<Record<string, any>>(JSON.parse(localStorage.getItem(`nst_test_attempts_${user.id}`) || '{}'));
  const globalMessage = localStorage.getItem('nst_global_message');
  const [activeExternalApp, setActiveExternalApp] = useState<string | null>(null);
  const [pendingApp, setPendingApp] = useState<{app: any, cost: number} | null>(null);
  const [sessionContentSelection, setSeasonContentSelection] = useState<{chapter: Chapter, subject: Subject} | null>(null);
  const [returnTab, setReturnToTab] = useState<StudentTab | null>(null);

  // GENERIC CONTENT FLOW STATE (Used for Video, PDF, MCQ)
  const [contentViewStep, setContentViewStep] = useState<'SUBJECTS' | 'CHAPTERS' | 'PLAYER'>('SUBJECTS');
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loadingChapters, setLoadingChapters] = useState(false);
  
  // LOADING STATE FOR 10S RULE
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [profileData, setProfileData] = useState({
      classLevel: user.classLevel || '10',
      board: user.board || 'CBSE',
      stream: user.stream || 'Science',
      newPassword: '',
      dailyGoalHours: 3 // Default
  });

  const [canClaimReward, setCanClaimReward] = useState(false);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string>('');
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [showFeaturesModal, setShowFeaturesModal] = useState(false);
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [newNameInput, setNewNameInput] = useState('');
  
  // Request Content Modal State
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestData, setRequestData] = useState({ subject: '', topic: '', type: 'PDF' });

  // CUSTOM ALERT STATE
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, type: 'SUCCESS'|'ERROR'|'INFO', title?: string, message: string}>({isOpen: false, type: 'INFO', message: ''});
  const showAlert = (msg: string, type: 'SUCCESS'|'ERROR'|'INFO' = 'INFO', title?: string) => {
      setAlertConfig({ isOpen: true, type, title, message: msg });
  };

  // Custom Daily Target Logic
  const [dailyTargetSeconds, setDailyTargetSeconds] = useState(3 * 3600);
  const REWARD_AMOUNT = settings?.dailyReward || 3;
  
  // Phone setup
  const adminPhones = settings?.adminPhones || [{id: 'default', number: '8227070298', name: 'Admin'}];
  const defaultPhoneId = adminPhones.find(p => p.isDefault)?.id || adminPhones[0]?.id || 'default';
  
  if (!selectedPhoneId && adminPhones.length > 0) {
    setSelectedPhoneId(defaultPhoneId);
  }

  // --- HERO SLIDER STATE ---
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
      { id: 1, title: "Ultra Subscription", subtitle: "Unlimited Access to Videos & PDFs", color: "from-purple-600 to-blue-600" },
      { id: 2, title: "Ace Your Exams", subtitle: "Practice with 1000+ MCQs", color: "from-orange-500 to-red-600" },
      { id: 3, title: "Live Support", subtitle: "Chat directly with experts", color: "from-emerald-500 to-teal-600" }
  ];

  useEffect(() => {
      const timer = setInterval(() => {
          setCurrentSlide((prev) => (prev + 1) % slides.length);
      }, 4000);
      return () => clearInterval(timer);
  }, []);

  // --- ADMIN SWITCH HANDLER ---
  const handleSwitchToAdmin = () => {
    if (onNavigate) {
       onNavigate('ADMIN_DASHBOARD');
    }
  };
  
  const getPhoneNumber = (phoneId?: string) => {
    const phone = adminPhones.find(p => p.id === (phoneId || selectedPhoneId));
    return phone ? phone.number : '8227070298';
  };

  useEffect(() => {
      // Load user's custom goal
      const storedGoal = localStorage.getItem(`nst_goal_${user.id}`);
      if (storedGoal) {
          const hours = parseInt(storedGoal);
          setDailyTargetSeconds(hours * 3600);
          setProfileData(prev => ({...prev, dailyGoalHours: hours}));
      }
  }, [user.id]);

  // ... (Existing Reward Logic - Keep as is) ...
  // --- CHECK YESTERDAY'S REWARD ON LOAD ---
  useEffect(() => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yDateStr = yesterday.toDateString();
      
      const yActivity = parseInt(localStorage.getItem(`activity_${user.id}_${yDateStr}`) || '0');
      const yClaimed = localStorage.getItem(`reward_claimed_${user.id}_${yDateStr}`);
      
      if (!yClaimed && (!user.subscriptionTier || user.subscriptionTier === 'FREE')) {
          let reward = null;
          if (yActivity >= 10800) reward = { tier: 'MONTHLY', level: 'ULTRA', hours: 4 }; // 3 Hrs -> Ultra
          else if (yActivity >= 3600) reward = { tier: 'WEEKLY', level: 'BASIC', hours: 4 }; // 1 Hr -> Basic

          if (reward) {
              const expiresAt = new Date(new Date().setHours(new Date().getHours() + 24)).toISOString();
              const newMsg = {
                  id: `reward-${Date.now()}`,
                  text: `🎁 Daily Reward! You studied enough yesterday. Claim your ${reward.hours} hours of ${reward.level} access now!`,
                  date: new Date().toISOString(),
                  read: false,
                  type: 'REWARD',
                  reward: { tier: reward.tier as any, level: reward.level as any, durationHours: reward.hours },
                  expiresAt: expiresAt,
                  isClaimed: false
              };
              
              const updatedUser = { 
                  ...user, 
                  inbox: [newMsg, ...(user.inbox || [])] 
              };
              
              handleUserUpdate(updatedUser);
              localStorage.setItem(`reward_claimed_${user.id}_${yDateStr}`, 'true');
          }
      }
  }, [user.id]);

  const claimRewardMessage = (msgId: string, reward: any, gift?: any) => {
      const updatedInbox = user.inbox?.map(m => m.id === msgId ? { ...m, isClaimed: true, read: true } : m);
      let updatedUser: User = { ...user, inbox: updatedInbox };
      let successMsg = '';

      if (gift) {
          // HANDLE ADMIN GIFT
          if (gift.type === 'CREDITS') {
              updatedUser.credits = (user.credits || 0) + Number(gift.value);
              successMsg = `🎁 Gift Claimed! Added ${gift.value} Credits.`;
          } else if (gift.type === 'SUBSCRIPTION') {
              const [tier, level] = (gift.value as string).split('_');
              const duration = gift.durationHours || 24;
              const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
              
              updatedUser.subscriptionTier = tier as any;
              updatedUser.subscriptionLevel = level as any;
              updatedUser.subscriptionEndDate = endDate;
              updatedUser.isPremium = true;
              
              successMsg = `🎁 Gift Claimed! ${tier} ${level} unlocked for ${duration} hours.`;
          }
      } else if (reward) {
          // HANDLE AUTO REWARD
          const duration = reward.durationHours || 4;
          const endDate = new Date(Date.now() + duration * 60 * 60 * 1000).toISOString();
          
          updatedUser.subscriptionTier = reward.tier;
          updatedUser.subscriptionLevel = reward.level;
          updatedUser.subscriptionEndDate = endDate;
          updatedUser.isPremium = true;
          
          successMsg = `✅ Reward Claimed! Enjoy ${duration} hours of ${reward.level} access.`;
      }
      
      handleUserUpdate(updatedUser);
      showAlert(successMsg, 'SUCCESS', 'Rewards Claimed');
  };

  // --- TRACK TODAY'S ACTIVITY & FIRST DAY BONUSES ---
  useEffect(() => {
    if (!user.id) return;
    const unsub = onSnapshot(doc(db, "users", user.id), (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data() as User;
            if (cloudData.credits !== user.credits || 
                cloudData.subscriptionTier !== user.subscriptionTier ||
                cloudData.isPremium !== user.isPremium ||
                cloudData.isGameBanned !== user.isGameBanned) {
                const updated = { ...user, ...cloudData };
                onRedeemSuccess(updated); 
            }
        }
    });
    return () => unsub();
  }, [user.id]); 

  useEffect(() => {
      const interval = setInterval(() => {
          updateUserStatus(user.id, dailyStudySeconds);
          const todayStr = new Date().toDateString();
          localStorage.setItem(`activity_${user.id}_${todayStr}`, dailyStudySeconds.toString());
          
          const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
          const firstDayBonusClaimed = localStorage.getItem(`first_day_ultra_${user.id}`);
          
          if (accountAgeHours < 24 && dailyStudySeconds >= 3600 && !firstDayBonusClaimed) {
              const endDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 Hour
              const updatedUser = { 
                  ...user, 
                  subscriptionTier: 'MONTHLY', // Ultra
                  subscriptionEndDate: endDate,
                  isPremium: true
              };
              const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
              const idx = storedUsers.findIndex((u:User) => u.id === user.id);
              if (idx !== -1) storedUsers[idx] = updatedUser;
              
              localStorage.setItem('nst_users', JSON.stringify(storedUsers));
              localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
              localStorage.setItem(`first_day_ultra_${user.id}`, 'true');
              
              onRedeemSuccess(updatedUser);
              showAlert("🎉 FIRST DAY BONUS: You unlocked 1 Hour Free ULTRA Subscription!", 'SUCCESS');
          }
          
      }, 60000); 
      return () => clearInterval(interval);
  }, [dailyStudySeconds, user.id, user.createdAt]);

  // Inbox
  const [showInbox, setShowInbox] = useState(false);
  const unreadCount = user.inbox?.filter(m => !m.read).length || 0;

  useEffect(() => {
    const today = new Date().toDateString();
    const lastClaim = user.lastRewardClaimDate ? new Date(user.lastRewardClaimDate).toDateString() : '';
    setCanClaimReward(lastClaim !== today && dailyStudySeconds >= dailyTargetSeconds);
  }, [user.lastRewardClaimDate, dailyStudySeconds, dailyTargetSeconds]);

  const claimDailyReward = () => {
      if (!canClaimReward) return;
      const updatedUser = {
          ...user,
          credits: (user.credits || 0) + REWARD_AMOUNT,
          lastRewardClaimDate: new Date().toISOString()
      };
      handleUserUpdate(updatedUser);
      setCanClaimReward(false);
      showAlert(`Received: ${REWARD_AMOUNT} Free Credits!`, 'SUCCESS', 'Daily Goal Met');
  };

  const handleExternalAppClick = (app: any) => {
      if (app.isLocked) { showAlert("This app is currently locked by Admin.", 'ERROR'); return; }
      if (app.creditCost > 0) {
          if (user.credits < app.creditCost) { showAlert(`Insufficient Credits! You need ${app.creditCost} credits.`, 'ERROR'); return; }
          if (user.isAutoDeductEnabled) processAppAccess(app, app.creditCost);
          else setPendingApp({ app, cost: app.creditCost });
          return;
      }
      setActiveExternalApp(app.url);
  };

  const processAppAccess = (app: any, cost: number, enableAuto: boolean = false) => {
      let updatedUser = { ...user, credits: user.credits - cost };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      handleUserUpdate(updatedUser);
      setActiveExternalApp(app.url);
      setPendingApp(null);
  };

  const handleBuyPackage = (pkg: CreditPackage) => {
      const phoneNum = getPhoneNumber();
      const message = `Hello Admin, I want to buy credits.\n\n🆔 User ID: ${user.id}\n📦 Package: ${pkg.name}\n💰 Amount: ₹${pkg.price}\n💎 Credits: ${pkg.credits}\n\nPlease check my payment.`;
      const url = `https://wa.me/91${phoneNum}?text=${encodeURIComponent(message)}`;
      window.open(url, '_blank');
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h > 0 ? h + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const saveProfile = () => {
      // Cost Check
      const isPremium = user.isPremium && user.subscriptionEndDate && new Date(user.subscriptionEndDate) > new Date();
      const cost = settings?.profileEditCost ?? 10;
      
      if (!isPremium && user.credits < cost) {
          showAlert(`Profile update costs ${cost} NST Coins.\nYou have ${user.credits} coins.`, 'ERROR');
          return;
      }
      
      // Since we can't easily replace confirm() inside this sync function without breaking flow or using a callback modal state machine,
      // we assume profile updates (Board/Class) are free or low friction enough to skip confirm OR user has enough credits.
      // The "Name Change" has its own dedicated modal now.
      // For general profile, we'll just deduct if needed.
      
      const updatedUser = { 
          ...user, 
          board: profileData.board,
          classLevel: profileData.classLevel,
          stream: profileData.stream,
          password: profileData.newPassword.trim() ? profileData.newPassword : user.password,
          credits: isPremium ? user.credits : user.credits - cost
      };
      localStorage.setItem(`nst_goal_${user.id}`, profileData.dailyGoalHours.toString());
      setDailyTargetSeconds(profileData.dailyGoalHours * 3600);
      handleUserUpdate(updatedUser);
      window.location.reload(); 
      setEditMode(false);
  };
  
  const handleUserUpdate = (updatedUser: User) => {
      const storedUsers = JSON.parse(localStorage.getItem('nst_users') || '[]');
      const userIdx = storedUsers.findIndex((u:User) => u.id === updatedUser.id);
      if (userIdx !== -1) {
          storedUsers[userIdx] = updatedUser;
          localStorage.setItem('nst_users', JSON.stringify(storedUsers));
          localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
          saveUserToLive(updatedUser); 
          onRedeemSuccess(updatedUser); 
      }
  };

  const markInboxRead = () => {
      if (!user.inbox) return;
      const updatedInbox = user.inbox.map(m => ({ ...m, read: true }));
      handleUserUpdate({ ...user, inbox: updatedInbox });
  };

  // --- GENERIC CONTENT FLOW HANDLERS ---
  const handleContentSubjectSelect = async (subject: Subject) => {
      setSelectedSubject(subject);
      setLoadingChapters(true);
      setContentViewStep('CHAPTERS');
      try {
          const ch = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', subject, 'English');
          setChapters(ch);
      } catch(e) { console.error(e); }
      setLoadingChapters(false);
  };

  const handleContentChapterSelect = (chapter: Chapter) => {
      setSelectedChapter(chapter);
      setContentViewStep('PLAYER');
      setFullScreen(true); 
  };

  const onLoadingComplete = () => {
      setIsLoadingContent(false);
      setContentViewStep('PLAYER');
      setFullScreen(true);
  };

  // --- SESSION TOPIC CLICK HANDLER ---
  const handleSessionTopicClick = async (topicName: string, subjectName: string) => {
      // 1. Map Subject Name to Object
      const allSubjects = getSubjectsList(user.classLevel || '10', user.stream || null);
      // Helper map same as in SyllabusStructure
      const subMap: Record<string, string> = {
          'Maths': 'math', 'Mathematics': 'math',
          'Physics': 'physics', 'Chemistry': 'chemistry', 'Biology': 'biology',
          'Science': 'science', 'Social Science': 'sst',
          'History': 'history', 'Geography': 'geography', 'Civics': 'polity', 'Economics': 'economics',
          'English': 'english', 'Hindi': 'hindi'
      };
      
      // Try exact name match first, then map ID
      let targetSubject = allSubjects.find(s => s.name === subjectName);
      if (!targetSubject) {
          const mappedKey = Object.keys(subMap).find(k => subjectName.includes(k));
          if (mappedKey) {
              const mappedId = subMap[mappedKey];
              targetSubject = allSubjects.find(s => s.id === mappedId);
          }
      }

      if (!targetSubject) {
          // Fallback logic for Social Science and Science splits
          if (['History', 'Geography', 'Civics', 'Political Science', 'Economics', 'Social Science'].some(k => subjectName.includes(k))) {
              targetSubject = allSubjects.find(s => s.id === 'sst' || s.id === 'social');
          } else if (['Physics', 'Chemistry', 'Biology'].some(k => subjectName.includes(k))) {
              targetSubject = allSubjects.find(s => s.id === 'science');
          }
      }

      if (!targetSubject) {
          showAlert(`Subject "${subjectName}" not found in your course list.`, 'ERROR');
          return;
      }

      // 2. Fetch Chapters
      setIsLoadingContent(true); 
      
      try {
          const fetchedChapters = await fetchChapters(user.board || 'CBSE', user.classLevel || '10', user.stream || 'Science', targetSubject, 'English');
          
          // 3. Find Matching Chapter (Fuzzy)
          // Clean topic name (remove text in parens and prefixes)
          let cleanTopic = topicName.split('(')[0].trim();
          if (cleanTopic.includes(':')) {
              cleanTopic = cleanTopic.split(':').slice(1).join(':').trim();
          }
          cleanTopic = cleanTopic.toLowerCase()
              .replace(/&/g, 'and')
              .replace(/–/g, '-') // Normalize en-dash
              .replace(/\s+/g, ' ');

          const matchedChapter = fetchedChapters.find(ch => {
              const cleanChapter = ch.title.toLowerCase()
                  .replace(/&/g, 'and')
                  .replace(/–/g, '-') // Normalize en-dash
                  .replace(/\s+/g, ' ');
              return cleanChapter.includes(cleanTopic) || cleanTopic.includes(cleanChapter);
          });
          
          if (matchedChapter) {
              // OPEN SELECTION MODAL
              setIsLoadingContent(false); // Stop loading, we are not navigating yet
              setSeasonContentSelection({ chapter: matchedChapter, subject: targetSubject });
              setChapters(fetchedChapters); // Keep context
          } else {
              // NO MATCH FOUND - STRICT RESTRICTION
              setIsLoadingContent(false);
              showAlert(`Content for "${topicName}" is not available yet. Please check back later.`, 'INFO', 'Coming Soon');
          }
          
      } catch (e) {
          console.error(e);
          setIsLoadingContent(false);
          showAlert("Error loading content. Please check internet.", 'ERROR');
      }
  };

  // GENERIC CONTENT SECTION RENDERER
  const renderContentSection = (type: 'VIDEO' | 'PDF' | 'MCQ') => {
      const handlePlayerBack = () => {
          if (returnTab) {
              onTabChange(returnTab);
              setReturnToTab(null);
              setContentViewStep('SUBJECTS');
              setFullScreen(false);
          } else {
              setContentViewStep('CHAPTERS');
              setFullScreen(false);
          }
      };

      if (contentViewStep === 'PLAYER' && selectedChapter && selectedSubject) {
          if (type === 'VIDEO') {
            return <VideoPlaylistView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          } else if (type === 'PDF') {
            return <PdfView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          } else {
            return <McqView chapter={selectedChapter} subject={selectedSubject} user={user} board={user.board || 'CBSE'} classLevel={user.classLevel || '10'} stream={user.stream || null} onBack={handlePlayerBack} onUpdateUser={handleUserUpdate} settings={settings} />;
          }
      }

      if (contentViewStep === 'CHAPTERS' && selectedSubject) {
          return (
              <ChapterSelection 
                  chapters={chapters} 
                  subject={selectedSubject} 
                  classLevel={user.classLevel || '10'} 
                  loading={loadingChapters} 
                  user={user} 
                  onSelect={handleContentChapterSelect} 
                  onBack={() => { setContentViewStep('SUBJECTS'); onTabChange('COURSES'); }} 
              />
          );
      }

      // Subject List (Default View for Content Tabs)
      // NOTE: This part is technically not used if 'COURSES' tab handles the entry
      // But keeping it as fallback if we navigate directly.
      return null; 
  };

  const isGameEnabled = settings?.isGameEnabled ?? true;

  // --- RENDER BASED ON ACTIVE TAB ---
  const renderMainContent = () => {
      // 1. HOME TAB
      if (activeTab === 'HOME') { 
          return (
              <div className="space-y-6 pb-24">
                  {/* FEATURED & HERO SECTION */}
                  <div className="space-y-4 mb-6">
                      {/* NEW HERO SLIDER (App Features & Subscription) */}
                      <div className="relative h-48 rounded-2xl overflow-hidden shadow-xl mx-1 border border-white/20">
                          {slides.map((slide, index) => (
                              <div 
                                  key={slide.id}
                                  className={`absolute inset-0 bg-gradient-to-br ${slide.color} flex flex-col justify-center p-6 transition-all duration-1000 ${index === currentSlide ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                              >
                                  <div className="text-white relative z-10">
                                      <div className="inline-block px-3 py-1 bg-black/20 rounded-full text-[10px] font-black tracking-widest mb-2 backdrop-blur-md border border-white/10 shadow-sm">
                                          ✨ FEATURED
                                      </div>
                                      <h2 className="text-3xl font-black mb-2 leading-none drop-shadow-md">{slide.title}</h2>
                                      <p className="text-sm font-medium opacity-90 mb-4 max-w-[80%]">{slide.subtitle}</p>
                                      
                                      <button onClick={() => onTabChange('STORE')} className="bg-white text-black px-4 py-2 rounded-lg text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                          <Zap size={14} className="text-yellow-500 fill-yellow-500" /> Check Now
                                      </button>
                                  </div>
                                  {/* Animated Background Element */}
                                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl animate-pulse"></div>
                              </div>
                          ))}
                          {/* Dots */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                              {slides.map((_, i) => (
                                  <button 
                                      key={i} 
                                      onClick={() => setCurrentSlide(i)}
                                      className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-white shadow-[0_0_10px_white]' : 'w-2 bg-white/40 hover:bg-white/60'}`}
                                  ></button>
                              ))}
                          </div>
                      </div>

                      {/* ALL FEATURES GRID (Sara Future Dikhega) */}
                      <div>
                          <div className="flex items-center justify-between px-2 mb-3">
                              <h3 className="font-black text-slate-800 flex items-center gap-2">
                                  <Sparkles className="text-purple-500" size={18} /> App Features
                              </h3>
                              <button 
                                  onClick={() => setShowFeaturesModal(true)}
                                  className="text-[10px] font-bold bg-slate-200 text-slate-600 px-3 py-1 rounded-full hover:bg-slate-300 transition-colors"
                              >
                                  More ▾
                              </button>
                          </div>
                          
                          {/* SCROLLABLE FEATURES LIST */}
                          <div className="overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                              <div className="flex gap-3 w-max">
                                  {[
                                      { id: 'VIDEO', label: 'Videos', icon: Youtube, color: 'text-red-500', bg: 'bg-red-50', hover: 'group-hover:bg-red-500' },
                                      { id: 'PDF', label: 'PDFs', icon: FileText, color: 'text-blue-500', bg: 'bg-blue-50', hover: 'group-hover:bg-blue-500' },
                                      { id: 'MCQ', label: 'Tests', icon: CheckSquare, color: 'text-purple-500', bg: 'bg-purple-50', hover: 'group-hover:bg-purple-500' },
                                      { id: 'STORE', label: 'Premium', icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50', hover: 'group-hover:bg-yellow-500' },
                                      { id: 'LEADERBOARD', label: 'Rank List', icon: Trophy, color: 'text-orange-500', bg: 'bg-orange-50', hover: 'group-hover:bg-orange-500' },
                                      { id: 'CHAT', label: 'Chat', icon: MessageCircle, color: 'text-green-500', bg: 'bg-green-50', hover: 'group-hover:bg-green-500' },
                                      { id: 'GAME', label: 'Spin Win', icon: Gamepad2, color: 'text-pink-500', bg: 'bg-pink-50', hover: 'group-hover:bg-pink-500' },
                                      { id: 'PROFILE', label: 'Profile', icon: UserIcon, color: 'text-slate-500', bg: 'bg-slate-100', hover: 'group-hover:bg-slate-600' },
                                      { id: 'ANALYTICS', label: 'Report', icon: Trophy, color: 'text-indigo-500', bg: 'bg-indigo-50', hover: 'group-hover:bg-indigo-500' },
                                  ].map((item) => (
                                      <button 
                                          key={item.id} 
                                          onClick={() => onTabChange(item.id as StudentTab)} 
                                          className="aspect-square w-20 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-1 hover:shadow-md hover:scale-105 transition-all group shrink-0"
                                      >
                                          <div className={`w-10 h-10 ${item.bg} rounded-full flex items-center justify-center ${item.color} ${item.hover} group-hover:text-white transition-colors`}>
                                              <item.icon size={20} />
                                          </div>
                                          <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                                      </button>
                                  ))}
                              </div>
                          </div>
                      </div>

                      {/* SUBSCRIPTION PROMO BANNER (Inline with Credits) */}
                      <div onClick={() => onTabChange('STORE')} className="mx-1 bg-gradient-to-r from-slate-900 to-slate-800 p-4 rounded-2xl shadow-lg flex items-center justify-between cursor-pointer border border-slate-700 relative overflow-hidden group">
                          <div className="relative z-10">
                              <div className="flex items-center gap-2 mb-1">
                                  <Crown size={16} className="text-yellow-400 animate-pulse" />
                                  <span className="text-xs font-black text-white tracking-widest">PRO MEMBERSHIP</span>
                              </div>
                              <p className="text-[10px] text-slate-400">Unlock All Features + Get Credits</p>
                          </div>
                          <div className="relative z-10 flex flex-col items-end">
                              <span className="text-xl font-black text-white">BASIC / ULTRA</span>
                              <span className="text-[10px] font-bold bg-yellow-400 text-black px-2 py-0.5 rounded-full">+ 5000 Credits</span>
                          </div>
                          {/* Shine Effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                      </div>
                  </div>

                  {/* STATS HEADER */}
                  <div className="bg-slate-900 rounded-2xl p-4 text-white shadow-xl relative overflow-hidden">
                      <div className="flex items-center justify-between relative z-10">
                          <div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                  <Timer size={12} /> Study Timer
                              </div>
                              <div className="text-2xl font-mono font-bold tracking-wider text-green-400">
                                  {formatTime(dailyStudySeconds)}
                              </div>
                          </div>
                          <div className="text-right">
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Credits</p>
                              <div className="flex items-center justify-end gap-1">
                                  <Crown size={16} className="text-yellow-400" />
                                  <span className="text-xl font-black text-blue-400">{user.credits}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  {/* CONTENT REQUEST (DEMAND) SECTION */}
                  <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-2xl border border-pink-100 shadow-sm mt-4">
                      <h3 className="font-bold text-pink-900 mb-2 flex items-center gap-2">
                          <Megaphone size={18} className="text-pink-600" /> Request Content
                      </h3>
                      <p className="text-xs text-slate-600 mb-4">Don't see what you need? Request it here!</p>
                      
                      <button 
                          onClick={() => {
                              setRequestData({ subject: '', topic: '', type: 'PDF' });
                              setShowRequestModal(true);
                          }}
                          className="w-full bg-white text-pink-600 font-bold py-3 rounded-xl shadow-sm border border-pink-200 hover:bg-pink-100 transition-colors flex items-center justify-center gap-2 text-sm"
                      >
                          + Make a Request
                      </button>
                  </div>

                  {/* MORE SERVICES GRID (2x4) */}
                  <div>
                      <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 px-1">
                          <Layout size={18} /> More Services
                      </h3>
                      <div className="grid grid-cols-4 gap-3">
                          <button onClick={() => setShowInbox(true)} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all relative">
                              <Mail size={20} className="text-pink-500" />
                              <span className="text-[10px] font-bold text-slate-600">Inbox</span>
                              {unreadCount > 0 && (
                                  <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                              )}
                          </button>
                          <button onClick={() => onTabChange('HISTORY')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <History size={20} className="text-blue-500" />
                              <span className="text-[10px] font-bold text-slate-600">History</span>
                          </button>
                          {isGameEnabled && (
                              <button onClick={() => onTabChange('GAME')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                                  <Gamepad2 size={20} className="text-orange-500" />
                                  <span className="text-[10px] font-bold text-slate-600">Game</span>
                              </button>
                          )}
                          <button onClick={() => onTabChange('REDEEM')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <Gift size={20} className="text-purple-500" />
                              <span className="text-[10px] font-bold text-slate-600">Redeem</span>
                          </button>
                          <button onClick={() => onTabChange('CHAT')} className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all">
                              <MessageCircle size={20} className="text-green-500" />
                              <span className="text-[10px] font-bold text-slate-600">Support</span>
                          </button>
                          
                          {/* EXTERNAL APPS */}
                          {settings?.externalApps?.slice(0,4).map((app) => (
                              <button 
                                  key={app.id} 
                                  onClick={() => handleExternalAppClick(app)}
                                  className="aspect-square bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-all"
                              >
                                  {app.isLocked ? <Lock size={20} className="text-slate-400" /> : <Zap size={20} className="text-yellow-500" />}
                                  <span className="text-[10px] font-bold text-slate-600 truncate w-full text-center px-1">{app.name}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              </div>
          );
      }

      // 2. COURSES TAB (Handles Video, Notes, MCQ Selection)
      if (activeTab === 'COURSES') {
          // If viewing a specific content type (from drilled down), show it
          // Note: Clicking a subject switches tab to VIDEO/PDF/MCQ, so COURSES just shows the Hub.
          return (
              <div className="space-y-6 pb-24">
                      <div className="flex items-center justify-between">
                          <h2 className="text-2xl font-black text-slate-800">My Study Hub</h2>
                          <button onClick={() => onTabChange('LEADERBOARD')} className="bg-yellow-100 text-yellow-700 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 hover:bg-yellow-200 transition">
                              <Trophy size={14} /> Rank List
                          </button>
                      </div>
                      
                      {/* Video Section */}
                      <div className="bg-red-50 p-4 rounded-2xl border border-red-100">
                          <h3 className="font-bold text-red-800 flex items-center gap-2 mb-2"><Youtube /> Video Lectures</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('VIDEO'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-red-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* Notes Section */}
                      <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                          <h3 className="font-bold text-blue-800 flex items-center gap-2 mb-2"><FileText /> Notes Library</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('PDF'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-blue-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>

                      {/* MCQ Section */}
                      <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100">
                          <h3 className="font-bold text-purple-800 flex items-center gap-2 mb-2"><CheckSquare /> MCQ Practice</h3>
                          <div className="grid grid-cols-2 gap-2">
                              {getSubjectsList(user.classLevel || '10', user.stream || null).map(s => (
                                  <button key={s.id} onClick={() => { onTabChange('MCQ'); handleContentSubjectSelect(s); }} className="bg-white p-2 rounded-xl text-xs font-bold text-slate-700 shadow-sm border border-purple-100 text-left">
                                      {s.name}
                                  </button>
                              ))}
                          </div>
                      </div>
                  </div>
              );
      }

      // 3. SESSION TAB (New Syllabus Structure)
      if (activeTab === 'SESSION') {
          return (
              <SyllabusStructure 
                user={user} 
                startDate={settings?.sessionStartDate}
                onTopicClick={handleSessionTopicClick} 
              />
          );
      }

      // 4. LEGACY TABS (Mapped to new structure or kept as sub-views)
      if (activeTab === 'ANALYTICS') return <AnalyticsPage user={user} onBack={() => onTabChange('HOME')} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard />;
      if (activeTab === 'ANALYTICS') return <AnalyticsPage user={user} onBack={() => onTabChange('HOME')} settings={settings} />;
      if (activeTab === 'HISTORY') return <HistoryPage user={user} onUpdateUser={handleUserUpdate} settings={settings} />;
      if (activeTab === 'LEADERBOARD') return <Leaderboard />;
      if (activeTab === 'GAME') return isGameEnabled ? (user.isGameBanned ? <div className="text-center py-20 bg-red-50 rounded-2xl border border-red-100"><Ban size={48} className="mx-auto text-red-500 mb-4" /><h3 className="text-lg font-bold text-red-700">Access Denied</h3><p className="text-sm text-red-600">Admin has disabled the game for your account.</p></div> : <SpinWheel user={user} onUpdateUser={handleUserUpdate} settings={settings} />) : null;
      if (activeTab === 'REDEEM') return <div className="animate-in fade-in slide-in-from-bottom-2 duration-300"><RedeemSection user={user} onSuccess={onRedeemSuccess} /></div>;
      if (activeTab === 'CHAT') return <UniversalChat currentUser={user} onUserUpdate={handleUserUpdate} settings={settings} />;
      if (activeTab === 'STORE') return <Store user={user} settings={settings} onUserUpdate={handleUserUpdate} />;
      if (activeTab === 'PROFILE') return (
                <div className="animate-in fade-in zoom-in duration-300 pb-24">
                    <div className={`rounded-3xl p-8 text-center text-white mb-6 shadow-xl relative overflow-hidden ${
                        user.subscriptionLevel === 'ULTRA' && user.isPremium 
                        ? 'bg-gradient-to-br from-yellow-500 via-orange-500 to-red-600 shadow-orange-500/50' 
                        : user.subscriptionLevel === 'BASIC' && user.isPremium
                        ? 'bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-500 shadow-blue-500/50'
                        : 'bg-gradient-to-br from-slate-700 to-slate-900'
                    }`}>
                        {/* ANIMATED BACKGROUND FOR ULTRA */}
                        {user.subscriptionLevel === 'ULTRA' && user.isPremium && (
                            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-spin-slow"></div>
                        )}
                        
                        {/* ANIMATED BACKGROUND FOR BASIC */}
                        {user.subscriptionLevel === 'BASIC' && user.isPremium && (
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-30 animate-pulse"></div>
                        )}

                        {/* SPECIAL BANNER ANIMATION (7/30/365) */}
                        {(user.subscriptionTier === 'WEEKLY' || user.subscriptionTier === 'MONTHLY' || user.subscriptionTier === 'YEARLY' || user.subscriptionTier === 'LIFETIME') && user.isPremium && (
                            <div className="absolute top-2 right-2 animate-bounce">
                                <span className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold border border-white/30">
                                    {user.subscriptionTier === 'WEEKLY' ? '7 DAYS' : user.subscriptionTier === 'MONTHLY' ? '30 DAYS' : user.subscriptionTier === 'LIFETIME' ? '∞' : '365 DAYS'}
                                </span>
                            </div>
                        )}

                        <div className={`w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl font-black shadow-2xl relative z-10 ${
                            user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'text-orange-600 ring-4 ring-yellow-300 animate-bounce-slow' : 
                            user.subscriptionLevel === 'BASIC' && user.isPremium ? 'text-blue-600 ring-4 ring-cyan-300' : 
                            'text-slate-800'
                        }`}>
                            {user.name.charAt(0)}
                            {user.subscriptionLevel === 'ULTRA' && user.isPremium && <div className="absolute -top-2 -right-2 text-2xl">👑</div>}
                        </div>
                        
                        <div className="flex items-center justify-center gap-2 relative z-10">
                            <h2 className="text-3xl font-black">{user.name}</h2>
                            <button 
                                onClick={() => { setNewNameInput(user.name); setShowNameChangeModal(true); }}
                                className="bg-white/20 p-1.5 rounded-full hover:bg-white/40 transition-colors"
                            >
                                <Edit size={14} />
                            </button>
                        </div>
                        <p className="text-white/80 text-sm font-mono relative z-10">ID: {user.displayId || user.id}</p>
                        
                        <div className="mt-4 relative z-10">
                            <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                                user.subscriptionLevel === 'ULTRA' && user.isPremium ? 'bg-yellow-400 text-black' : 
                                user.subscriptionLevel === 'BASIC' && user.isPremium ? 'bg-cyan-400 text-black' : 'bg-slate-600 text-slate-300'
                            }`}>
                                {user.isPremium ? `${user.subscriptionLevel} Member` : 'Free User'}
                            </span>
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Class</p>
                            <p className="text-lg font-black text-slate-800">{user.classLevel} • {user.board} • {user.stream}</p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                            <p className="text-xs font-bold text-slate-500 uppercase mb-1">Subscription</p>
                            <p className="text-lg font-black text-slate-800">{user.subscriptionTier || 'FREE'}</p>
                            {user.subscriptionEndDate && <p className="text-xs text-slate-500 mt-1">Expires: {new Date(user.subscriptionEndDate).toLocaleDateString()}</p>}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                                <p className="text-xs font-bold text-blue-600 uppercase">Credits</p>
                                <p className="text-2xl font-black text-blue-600">{user.credits}</p>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                                <p className="text-xs font-bold text-orange-600 uppercase">Streak</p>
                                <p className="text-2xl font-black text-orange-600">{user.streak} Days</p>
                            </div>
                        </div>
                        
                        <button onClick={() => setEditMode(true)} className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-900">✏️ Edit Profile</button>
                        <button onClick={() => {localStorage.removeItem(`nst_user_${user.id}`); window.location.reload();}} className="w-full bg-red-500 text-white py-3 rounded-xl font-bold hover:bg-red-600">🚪 Logout</button>
                    </div>
                </div>
      );

      // Handle Drill-Down Views (Video, PDF, MCQ)
      if (activeTab === 'VIDEO' || activeTab === 'PDF' || activeTab === 'MCQ') {
          return renderContentSection(activeTab);
      }

      return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
        {/* ADMIN SWITCH BUTTON */}
        {user.role === 'ADMIN' && (
             <div className="fixed bottom-24 right-4 z-50">
                 <button 
                    onClick={handleSwitchToAdmin}
                    className="bg-slate-900 text-white p-4 rounded-full shadow-2xl border-2 border-slate-700 hover:scale-110 transition-transform flex items-center gap-2 animate-bounce-slow"
                 >
                     <Layout size={20} className="text-yellow-400" />
                     <span className="font-bold text-xs">Admin Panel</span>
                 </button>
             </div>
        )}

        {/* NOTIFICATION BAR (Only on Home) */}
        {activeTab === 'HOME' && settings?.noticeText && (
            <div className="bg-gradient-to-r from-slate-900 to-blue-900 text-white p-4 mb-6 rounded-b-2xl shadow-lg border-b border-slate-700 animate-in slide-in-from-top-4 relative mx-4 mt-2">
                <div className="flex items-start gap-3">
                    <Megaphone size={20} className="text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Notice Board</p>
                        <p className="text-sm font-medium leading-relaxed">{settings.noticeText}</p>
                    </div>
                </div>
            </div>
        )}

        {/* REQUEST CONTENT MODAL */}
        {showRequestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <div className="flex items-center gap-2 mb-4 text-pink-600">
                        <Megaphone size={24} />
                        <h3 className="text-lg font-black text-slate-800">Request Content</h3>
                    </div>
                    
                    <div className="space-y-3 mb-6">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Subject</label>
                            <input 
                                type="text" 
                                value={requestData.subject} 
                                onChange={e => setRequestData({...requestData, subject: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Mathematics"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Topic / Chapter</label>
                            <input 
                                type="text" 
                                value={requestData.topic} 
                                onChange={e => setRequestData({...requestData, topic: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                                placeholder="e.g. Trigonometry"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                            <select 
                                value={requestData.type} 
                                onChange={e => setRequestData({...requestData, type: e.target.value})}
                                className="w-full p-2 border rounded-lg"
                            >
                                <option value="PDF">PDF Notes</option>
                                <option value="VIDEO">Video Lecture</option>
                                <option value="MCQ">MCQ Test</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <button onClick={() => setShowRequestModal(false)} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Cancel</button>
                        <button 
                            onClick={() => {
                                if (!requestData.subject || !requestData.topic) {
                                    showAlert("Please fill all fields", 'ERROR');
                                    return;
                                }
                                const request = {
                                    id: `req-${Date.now()}`,
                                    userId: user.id,
                                    userName: user.name,
                                    details: `${user.classLevel || '10'} ${user.board || 'CBSE'} - ${requestData.subject} - ${requestData.topic} - ${requestData.type}`,
                                    timestamp: new Date().toISOString()
                                };
                                const existing = JSON.parse(localStorage.getItem('nst_demand_requests') || '[]');
                                existing.push(request);
                                localStorage.setItem('nst_demand_requests', JSON.stringify(existing));
                                
                                setShowRequestModal(false);
                                showAlert("✅ Request Sent! Admin will check it.", 'SUCCESS');
                            }}
                            className="flex-1 py-3 bg-pink-600 text-white font-bold rounded-xl hover:bg-pink-700 shadow-lg"
                        >
                            Send Request
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* NAME CHANGE MODAL */}
        {showNameChangeModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    <h3 className="text-lg font-bold mb-4 text-slate-800">Change Display Name</h3>
                    <input 
                        type="text" 
                        value={newNameInput} 
                        onChange={e => setNewNameInput(e.target.value)} 
                        className="w-full p-3 border rounded-xl mb-2" 
                        placeholder="Enter new name" 
                    />
                    <p className="text-xs text-slate-500 mb-4">Cost: <span className="font-bold text-orange-600">{settings?.nameChangeCost || 10} Coins</span></p>
                    <div className="flex gap-2">
                        <button onClick={() => setShowNameChangeModal(false)} className="flex-1 py-2 text-slate-500 font-bold bg-slate-100 rounded-lg">Cancel</button>
                        <button 
                            onClick={() => {
                                const cost = settings?.nameChangeCost || 10;
                                if (newNameInput && newNameInput !== user.name) {
                                    if (user.credits < cost) { showAlert(`Insufficient Coins! Need ${cost}.`, 'ERROR'); return; }
                                    const u = { ...user, name: newNameInput, credits: user.credits - cost };
                                    handleUserUpdate(u);
                                    setShowNameChangeModal(false);
                                    showAlert("Name Updated Successfully!", 'SUCCESS');
                                }
                            }}
                            className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700"
                        >
                            Pay & Update
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MAIN CONTENT AREA */}
        <div className="p-4">
            {renderMainContent()}
            
            <div className="mt-8 mb-4 text-center">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                    Developed by Nadim Anwar
                </p>
            </div>
        </div>

        {/* FIXED BOTTOM NAVIGATION */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-lg z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                <button onClick={() => { onTabChange('HOME'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'HOME' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Home size={24} fill={activeTab === 'HOME' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Home</span>
                </button>
                
                {(!['11','12'].includes(user.classLevel || '')) && (
                    <button onClick={() => { onTabChange('SESSION'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'SESSION' ? 'text-blue-600' : 'text-slate-400'}`}>
                        <Calendar size={24} fill={activeTab === 'SESSION' ? "currentColor" : "none"} />
                        <span className="text-[10px] font-bold mt-1">Session</span>
                    </button>
                )}

                <button onClick={() => { onTabChange('COURSES'); setContentViewStep('SUBJECTS'); }} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'COURSES' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'VIDEO' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <Book size={24} fill={activeTab === 'COURSES' || activeTab === 'PDF' || activeTab === 'MCQ' || activeTab === 'VIDEO' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Courses</span>
                </button>
                
                {settings?.isPaymentEnabled !== false && (
                    <button onClick={() => onTabChange('STORE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'STORE' ? 'text-blue-600' : 'text-slate-400'}`}>
                        <ShoppingBag size={24} fill={activeTab === 'STORE' ? "currentColor" : "none"} />
                        <span className="text-[10px] font-bold mt-1">Store</span>
                    </button>
                )}
                <button onClick={() => onTabChange('PROFILE')} className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'PROFILE' ? 'text-blue-600' : 'text-slate-400'}`}>
                    <UserIcon size={24} fill={activeTab === 'PROFILE' ? "currentColor" : "none"} />
                    <span className="text-[10px] font-bold mt-1">Profile</span>
                </button>
            </div>
        </div>

        {/* MODALS */}
        {showUserGuide && <UserGuide onClose={() => setShowUserGuide(false)} />}
        
        {/* APP FEATURES MODAL */}
        {showFeaturesModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-3xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
                    <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Sparkles size={20} className="text-yellow-400" />
                            <h3 className="font-black text-lg">All Features</h3>
                        </div>
                        <button onClick={() => setShowFeaturesModal(false)} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        <p className="text-sm text-slate-600 mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
                            Explore everything IIC App has to offer! Use the dashboard to access these features.
                        </p>
                        
                        <div className="grid gap-3">
                            {[
                                "Smart Video Lectures", "PDF Notes Library", "MCQ Practice Zone", "Weekly Tests", 
                                "Live Leaderboard", "Engagement Rewards", "Universal Chat", "Private Admin Support", 
                                "Spin Wheel Game", "Credit System", "Subscription Plans", "Store & Payments", 
                                "Profile Customization", "Study Timer", "Streak System", "User Inbox",  
                                "Performance History", "Responsive Design", "PDF Watermarking", "Auto-Sync Content", 
                                "Offline Capabilities", "Guest Access", "Passwordless Login", "Gift Codes", 
                                "Featured Shortcuts", "Notice Board", "External Apps Integration", 
                                "AI Question Generator", "Class Management (6-12)", "Daily Goals"
                            ].map((feat, i) => (
                                <div key={i} className="flex items-center gap-3 p-2 border-b border-slate-100 last:border-0">
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                        {i + 1}
                                    </div>
                                    <span className="text-sm font-medium text-slate-700">{feat}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="p-4 border-t bg-slate-50">
                        <button onClick={() => setShowFeaturesModal(false)} className="w-full py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg">Close</button>
                    </div>
                </div>
            </div>
        )}

        {editMode && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
                    {/* ... (Edit Profile Content - duplicated code removed for brevity, should use component) ... */}
                    {/* Re-implementing simplified edit mode here as it was inside a helper function before */}
                    <h3 className="font-bold text-lg mb-4">Edit Profile & Settings</h3>
                    <div className="space-y-3 mb-6">
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Daily Study Goal (Hours)</label><input type="number" value={profileData.dailyGoalHours} onChange={e => setProfileData({...profileData, dailyGoalHours: Number(e.target.value)})} className="w-full p-2 border rounded-lg" min={1} max={12}/></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">New Password</label><input type="text" placeholder="Set new password (optional)" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} className="w-full p-2 border rounded-lg bg-yellow-50 border-yellow-200"/><p className="text-[9px] text-slate-400 mt-1">Leave blank to keep current password.</p></div>
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Board</label><select value={profileData.board} onChange={e => setProfileData({...profileData, board: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="CBSE">CBSE</option><option value="BSEB">BSEB</option></select></div>
                        <div><label className="text-xs font-bold text-slate-500 uppercase">Class</label><select value={profileData.classLevel} onChange={e => setProfileData({...profileData, classLevel: e.target.value as any})} className="w-full p-2 border rounded-lg">{['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>{c}</option>)}</select></div>
                        {['11','12'].includes(profileData.classLevel) && (<div><label className="text-xs font-bold text-slate-500 uppercase">Stream</label><select value={profileData.stream} onChange={e => setProfileData({...profileData, stream: e.target.value as any})} className="w-full p-2 border rounded-lg"><option value="Science">Science</option><option value="Commerce">Commerce</option><option value="Arts">Arts</option></select></div>)}
                        
                        {/* NAME CHANGE */}
                        <div className="h-px bg-slate-100 my-2"></div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase">Display Name ({settings?.nameChangeCost || 10} Coins)</label>
                            <input 
                                type="text" 
                                value={user.name} 
                                onChange={(e) => {
                                    // Normally name is in user object, here we modify a local state if we want preview, 
                                    // but saveProfile uses profileData. Let's add name to profileData.
                                    // BUT user prop is read-only here. We need to handle this in saveProfile properly.
                                    // For now, we will just prompt for Name Change separately or add it here.
                                    // Adding separate logic for Name Change.
                                    // Actually, let's keep it simple: separate button in profile view is better.
                                }}
                                disabled
                                className="w-full p-2 border rounded-lg bg-slate-100 text-slate-500"
                                placeholder="Change from Profile Page"
                            />
                            <p className="text-[9px] text-slate-400 mt-1">Use 'Edit Name' on Profile page to change.</p>
                        </div>
                    </div>
                    <div className="flex gap-2"><button onClick={() => setEditMode(false)} className="flex-1 py-2 text-slate-500 font-bold">Cancel</button><button onClick={saveProfile} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save Changes</button></div>
                </div>
            </div>
        )}
        
        {showInbox && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                    <div className="bg-slate-50 p-4 border-b border-slate-100 flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2"><Mail size={18} className="text-blue-600" /> Admin Messages</h3>
                        <button onClick={() => setShowInbox(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>
                    <div className="max-h-80 overflow-y-auto p-4 space-y-3">
                        {(!user.inbox || user.inbox.length === 0) && <p className="text-slate-400 text-sm text-center py-8">No messages.</p>}
                        {user.inbox?.map(msg => (
                            <div key={msg.id} className={`p-3 rounded-xl border text-sm ${msg.read ? 'bg-white border-slate-100' : 'bg-blue-50 border-blue-100'} transition-all`}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2">
                                        <p className="font-bold text-slate-500">{msg.type === 'GIFT' ? '🎁 GIFT' : 'MESSAGE'}</p>
                                        {!msg.read && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
                                    </div>
                                    <p className="text-slate-400 text-[10px]">{new Date(msg.date).toLocaleDateString()}</p>
                                </div>
                                <p className="text-slate-700 leading-relaxed mb-2">{msg.text}</p>
                                
                                {(msg.type === 'REWARD' || msg.type === 'GIFT') && !msg.isClaimed && (
                                    <button 
                                        onClick={() => claimRewardMessage(msg.id, msg.reward, msg.gift)}
                                        className="w-full mt-2 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold rounded-lg shadow-md hover:scale-[1.02] transition-transform text-xs flex items-center justify-center gap-2"
                                    >
                                        <Gift size={14} /> Claim {msg.type === 'GIFT' ? 'Gift' : 'Reward'}
                                    </button>
                                )}
                                {(msg.isClaimed) && <p className="text-[10px] text-green-600 font-bold bg-green-50 inline-block px-2 py-1 rounded">✅ Claimed</p>}
                            </div>
                        ))}
                    </div>
                    {unreadCount > 0 && <button onClick={markInboxRead} className="w-full py-3 bg-blue-600 text-white font-bold text-sm hover:opacity-90">Mark All as Read</button>}
                </div>
            </div>
        )}

        {isLoadingContent && <LoadingOverlay dataReady={isDataReady} onComplete={onLoadingComplete} />}
        {activeExternalApp && <div className="fixed inset-0 z-50 bg-white flex flex-col"><div className="flex items-center justify-between p-4 border-b bg-slate-50"><button onClick={() => setActiveExternalApp(null)} className="p-2 bg-white rounded-full border shadow-sm"><X size={20} /></button><p className="font-bold text-slate-700">External App</p><div className="w-10"></div></div><iframe src={activeExternalApp} className="flex-1 w-full border-none" title="External App" allow="camera; microphone; geolocation; payment" /></div>}
        {pendingApp && <CreditConfirmationModal title={`Access ${pendingApp.app.name}`} cost={pendingApp.cost} userCredits={user.credits} isAutoEnabledInitial={!!user.isAutoDeductEnabled} onCancel={() => setPendingApp(null)} onConfirm={(auto) => processAppAccess(pendingApp.app, pendingApp.cost, auto)} />}
        
        {/* GLOBAL ALERT MODAL */}
        <CustomAlert 
            isOpen={alertConfig.isOpen}
            type={alertConfig.type}
            title={alertConfig.title}
            message={alertConfig.message}
            onClose={() => setAlertConfig(prev => ({...prev, isOpen: false}))}
        />

        {/* SESSION CONTENT SELECTION MODAL */}
        {sessionContentSelection && (
            <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
                <div className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-sm shadow-2xl relative overflow-hidden">
                    {/* Header Decoration */}
                    <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    
                    <div className="text-center mb-6 mt-2">
                        <div className="inline-block p-3 rounded-full bg-slate-100 mb-3 border-4 border-white shadow-lg">
                            <BookOpen size={28} className="text-slate-700" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 leading-tight mb-1">{sessionContentSelection.chapter.title}</h3>
                        <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">{sessionContentSelection.subject.name}</p>
                    </div>
                    
                    <div className="space-y-3">
                        {/* PDF / NOTES */}
                        <button 
                            onClick={() => {
                                setSelectedSubject(sessionContentSelection.subject);
                                setSelectedChapter(sessionContentSelection.chapter);
                                setContentViewStep('PLAYER');
                                setReturnToTab('SESSION');
                                setFullScreen(true);
                                onTabChange('PDF');
                                setSeasonContentSelection(null);
                            }}
                            className="w-full p-4 bg-white border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 rounded-2xl flex items-center gap-4 group transition-all shadow-sm hover:shadow-md"
                        >
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <FileText size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h4 className="font-bold text-slate-800 group-hover:text-blue-700">PDF Notes</h4>
                                <p className="text-[10px] text-slate-400">Read Theory & Solutions</p>
                            </div>
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-500" />
                        </button>
                        
                        {/* VIDEO */}
                        <button 
                            onClick={() => {
                                setSelectedSubject(sessionContentSelection.subject);
                                setSelectedChapter(sessionContentSelection.chapter);
                                setContentViewStep('PLAYER');
                                setReturnToTab('SESSION');
                                setFullScreen(true);
                                onTabChange('VIDEO');
                                setSeasonContentSelection(null);
                            }}
                            className="w-full p-4 bg-white border-2 border-slate-100 hover:border-red-500 hover:bg-red-50 rounded-2xl flex items-center gap-4 group transition-all shadow-sm hover:shadow-md"
                        >
                            <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                                <Youtube size={24} />
                            </div>
                            <div className="text-left flex-1">
                                <h4 className="font-bold text-slate-800 group-hover:text-red-700">Video Class</h4>
                                <p className="text-[10px] text-slate-400">Watch Explainer Videos</p>
                            </div>
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-red-500" />
                        </button>

                        {/* EXTRAS ROW (MCQ + More) */}
                        <div className="grid grid-cols-2 gap-3">
                            <button 
                                onClick={() => {
                                    setSelectedSubject(sessionContentSelection.subject);
                                    setSelectedChapter(sessionContentSelection.chapter);
                                    setContentViewStep('PLAYER');
                                    setReturnToTab('SESSION');
                                    setFullScreen(true);
                                    onTabChange('MCQ');
                                    setSeasonContentSelection(null);
                                }}
                                className="p-3 bg-white border-2 border-slate-100 hover:border-purple-500 hover:bg-purple-50 rounded-2xl flex flex-col items-center justify-center gap-2 group transition-all shadow-sm"
                            >
                                <CheckSquare size={20} className="text-purple-500 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-xs text-slate-700 group-hover:text-purple-700">Practice MCQs</span>
                            </button>
                            <button 
                                onClick={() => setSeasonContentSelection(null)}
                                className="p-3 bg-slate-100 hover:bg-slate-200 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all font-bold text-xs text-slate-500"
                            >
                                <X size={20} />
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};
