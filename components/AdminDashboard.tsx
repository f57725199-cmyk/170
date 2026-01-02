
import React, { useEffect, useState, useRef } from 'react';
import { User, ViewState, SystemSettings, Subject, Chapter, MCQItem, RecoveryRequest, ActivityLogEntry, LeaderboardEntry, RecycleBinItem, Stream, Board, ClassLevel, GiftCode, SubscriptionPlan, CreditPackage, WatermarkConfig } from '../types';
import { Users, Search, Trash2, Save, X, Eye, Shield, Megaphone, CheckCircle, ListChecks, Database, FileText, Monitor, Sparkles, Banknote, BrainCircuit, AlertOctagon, ArrowLeft, Key, Bell, ShieldCheck, Lock, Globe, Layers, Zap, PenTool, RefreshCw, RotateCcw, Plus, LogOut, Download, Upload, CreditCard, Ticket, Video, Image as ImageIcon, Type, Link, FileJson, Activity, AlertTriangle, Gift, Book, Mail, Edit3, MessageSquare, ShoppingBag, Cloud, Rocket, Code2, Layers as LayersIcon, Wifi, WifiOff, Copy, Crown, Gamepad2, Calendar } from 'lucide-react';
import { getSubjectsList, DEFAULT_SUBJECTS } from '../constants';
import { fetchChapters, fetchLessonContent } from '../services/gemini';
import { saveChapterData, bulkSaveLinks, checkFirebaseConnection, saveSystemSettings, subscribeToUsers, rtdb, saveUserToLive, db, getChapterData, auth } from '../firebase'; // IMPORT FIREBASE
import { ref, set, onValue, update, remove } from "firebase/database";
import { doc, deleteDoc, setDoc } from "firebase/firestore";
import { SimpleRichTextEditor } from './SimpleRichTextEditor';
import { UniversalChatV2 as UniversalChat } from './UniversalChatV2';
import { ImageCropper } from './ImageCropper';
import { SyllabusStructure } from './SyllabusStructure';
import { DEFAULT_SYLLABUS, MonthlySyllabus } from '../syllabus_data';
import { CustomAlert } from './CustomDialogs';
// @ts-ignore
import JSZip from 'jszip';

interface Props {
  onNavigate: (view: ViewState) => void;
  settings?: SystemSettings;
  onUpdateSettings?: (s: SystemSettings) => void;
  onImpersonate?: (user: User) => void;
  logActivity: (action: string, details: string) => void;
}

// --- TAB DEFINITIONS ---
type AdminTab = 
  | 'DASHBOARD' 
  | 'USERS' 
  | 'SUBSCRIPTION_MANAGER'
  | 'CODES'
  | 'SUBJECTS_MGR'
  | 'LEADERBOARD' 
  | 'NOTICES' 
  | 'DATABASE'
  | 'DEPLOY'         
  | 'ACCESS' 
  | 'LOGS' 
  | 'DEMAND' 
  | 'RECYCLE' 
  | 'SYLLABUS_MANAGER' 
  | 'SESSION_MANAGER'
  | 'CONTENT_PDF' 
  | 'CONTENT_VIDEO'
  | 'CONTENT_MCQ' 
  | 'CONTENT_TEST' 
      /* | 'CONTENT_NOTES' - REMOVED */
  | 'SUPPORT_CHAT' // NEW TAB
  | 'BULK_UPLOAD'    
  | 'CONFIG_GENERAL' 
  | 'CONFIG_SECURITY' 
  | 'CONFIG_VISIBILITY' 
  | 'CONFIG_AI' 
  | 'CONFIG_ADS' 
  | 'CONFIG_GAME'
  | 'CONFIG_PAYMENT'
  | 'CONFIG_EXTERNAL_APPS'
  | 'PRICING_MGMT'
  | 'SUBSCRIPTION_PLANS_EDITOR'
  | 'CONFIG_REWARDS'
  | 'FEATURED_CONTENT'; // New Tab

interface ContentConfig {
    freeLink?: string;
    premiumLink?: string;
    freeVideoLink?: string;
    premiumVideoLink?: string;
    freeNotesHtml?: string;
    premiumNotesHtml?: string;
    videoCreditsCost?: number;
    price?: number;
    ultraPdfLink?: string;
    ultraPdfPrice?: number;
    watermarkText?: string; // NEW: Watermark Text
    watermarkConfig?: WatermarkConfig; // NEW: Full Config
    videoPlaylist?: {title: string, url: string, price?: number}[]; // Updated for 10-slot editor
    manualMcqData?: MCQItem[];
    weeklyTestMcqData?: MCQItem[];
}

export const AdminDashboard: React.FC<Props> = ({ onNavigate, settings, onUpdateSettings, onImpersonate, logActivity }) => {
  // --- GLOBAL STATE ---
  const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  
  // NOTIFICATION STATE
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});
  const prevUsersRef = useRef<User[]>([]);

  // --- DATA LISTS ---
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinItem[]>([]);
  const [recoveryRequests, setRecoveryRequests] = useState<RecoveryRequest[]>([]);
  const [demands, setDemands] = useState<{id:string, details:string, timestamp:string}[]>([]);
  const [giftCodes, setGiftCodes] = useState<GiftCode[]>([]);

  // --- DATABASE EDITOR ---
  const [dbKey, setDbKey] = useState('nst_users');
  const [dbContent, setDbContent] = useState('');

  // Calculate Online Users (Active in last 5 mins)
  // Fix: Added check for negative diff (future timestamps) to prevent ghost users
  const onlineCount = users.filter(u => {
      if (!u || !u.lastActiveTime) return false;
      try {
          const diff = Date.now() - new Date(u.lastActiveTime).getTime();
          // Must be positive (past) AND less than 5 mins
          return diff >= 0 && diff < 5 * 60 * 1000;
      } catch(e) { return false; }
  }).length;

  // --- IMAGE CROPPER STATE ---
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // --- SETTINGS STATE ---
  const [localSettings, setLocalSettings] = useState<SystemSettings>(settings || {
      appName: 'IDEAL INSPIRATION CLASSES',
      themeColor: '#3b82f6',
      maintenanceMode: false,
      maintenanceMessage: 'We are upgrading our servers.',
      customCSS: '',
      apiKeys: [],
      adminCode: '', adminEmail: '', adminPhones: [{id: '1', number: '8227070298', name: 'Admin', isDefault: true}], footerText: 'Developed by Nadim Anwar',
      welcomeTitle: 'Unlock Smart Learning', 
      welcomeMessage: 'Experience the power of AI-driven education. IIC AI filters out the noise of traditional textbooks to deliver only the essential, high-yield topics you need for success. Study smarter, not harder.',
      termsText: 'By using this app, you agree to our terms. Content is for personal use only. Sharing accounts may lead to a permanent ban.', supportEmail: 'support@iic.com', aiModel: 'gemini-2.5-flash',
      aiInstruction: '',
      marqueeLines: ["Welcome to IIC ONLINE CLASSES"],
      liveMessage1: '', liveMessage2: '',
      wheelRewards: [0,1,2,5],
      chatCost: 1, dailyReward: 3, signupBonus: 2,
      isChatEnabled: true, isGameEnabled: true, allowSignup: true, loginMessage: '',
      gameCost: 0, spinLimitUltra: 10, spinLimitBasic: 5, spinLimitFree: 2,
      allowedClasses: ['6', '7', '8', '9', '10', '11', '12'],
      allowedBoards: ['CBSE', 'BSEB'], allowedStreams: ['Science', 'Commerce', 'Arts'],
      hiddenSubjects: [], storageCapacity: '100 GB',
      isPaymentEnabled: true, upiId: '', upiName: '', qrCodeUrl: '', paymentInstructions: '',
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
      startupAd: { enabled: false, duration: 3, title: "IIC Premium", features: ["Notes", "MCQ"], bgColor: "#1e293b", textColor: "#ffffff" }
  });

  // SYNC WITH PROP UPDATES (Ensure Admin sees live changes)
  useEffect(() => {
      if (settings) {
          setLocalSettings(prev => ({ ...prev, ...settings }));
      }
  }, [settings]);

  // --- PACKAGE MANAGER STATE ---
  const [newPkgName, setNewPkgName] = useState('');
  const [newPkgPrice, setNewPkgPrice] = useState('');
  const [newPkgCredits, setNewPkgCredits] = useState('');

  // --- CONTENT SELECTION STATE ---
  const [selBoard, setSelBoard] = useState<Board>('CBSE');
  const [selClass, setSelClass] = useState<ClassLevel>('10');
  const [selStream, setSelStream] = useState<Stream>('Science');
  const [selSubject, setSelSubject] = useState<Subject | null>(null);
  const [selChapters, setSelChapters] = useState<Chapter[]>([]);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  
  // --- BULK UPLOAD STATE ---
  const [bulkData, setBulkData] = useState<Record<string, {free: string, premium: string, price: number}>>({});

  // --- EDITING STATE ---
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(false);
  const [editConfig, setEditConfig] = useState<ContentConfig>({ freeLink: '', premiumLink: '', price: 0 });
  const [videoPlaylist, setVideoPlaylist] = useState<{title: string, url: string, price?: number}[]>([]);
  const [editingMcqs, setEditingMcqs] = useState<MCQItem[]>([]);
  const [editingTestMcqs, setEditingTestMcqs] = useState<MCQItem[]>([]);
  const [importText, setImportText] = useState('');
  
  // --- PRICING MANAGEMENT STATE ---
  const [editingPlanIdx, setEditingPlanIdx] = useState<number | null>(null);
  const [editingPkg, setEditingPkg] = useState<{id: string, name: string, credits: number, price: number} | null>(null);
  
  // --- USER EDIT MODAL STATE ---
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editUserCredits, setEditUserCredits] = useState(0);
  const [editUserPass, setEditUserPass] = useState('');
  const [dmText, setDmText] = useState('');
  const [dmUser, setDmUser] = useState<User | null>(null);
  const [giftType, setGiftType] = useState<'NONE' | 'CREDITS' | 'SUBSCRIPTION' | 'ANIMATION'>('NONE');
  const [giftValue, setGiftValue] = useState<string | number>('');
  const [giftDuration, setGiftDuration] = useState(24); // Hours
  const [editSubscriptionTier, setEditSubscriptionTier] = useState<'FREE' | 'WEEKLY' | 'MONTHLY' | 'YEARLY' | 'LIFETIME'>('FREE');
  const [editSubscriptionLevel, setEditSubscriptionLevel] = useState<'BASIC' | 'ULTRA'>('BASIC');
  const [editSubscriptionDays, setEditSubscriptionDays] = useState(30);
  const [editSubscriptionPrice, setEditSubscriptionPrice] = useState(999);
  
  // SUBSCRIPTION PRICES (ADMIN CUSTOMIZABLE)
  const [subPrices, setSubPrices] = useState<{WEEKLY: number, MONTHLY: number, YEARLY: number, LIFETIME: number}>({
      WEEKLY: 49,
      MONTHLY: 199,
      YEARLY: 999,
      LIFETIME: 4999
  });

  // --- GIFT CODE STATE ---
  const [newCodeAmount, setNewCodeAmount] = useState(10);
  const [newCodeCount, setNewCodeCount] = useState(1);
  const [newCodeMaxUses, setNewCodeMaxUses] = useState(1); // Default 1 (Single Use)

  // --- SUBJECT MANAGER STATE ---
  const [customSubjects, setCustomSubjects] = useState<any>({});
  const [newSubName, setNewSubName] = useState('');
  const [newSubIcon, setNewSubIcon] = useState('book');
  const [newSubColor, setNewSubColor] = useState('bg-slate-50 text-slate-600');

  // --- WEEKLY TEST CREATION STATE ---
  const [testName, setTestName] = useState('');
  const [testDesc, setTestDesc] = useState('');
  const [testDuration, setTestDuration] = useState(120);
  const [testPassScore, setTestPassScore] = useState(50);
  const [testSelectedSubjects, setTestSelectedSubjects] = useState<string[]>([]);
  const [testSelectedChapters, setTestSelectedChapters] = useState<string[]>([]);
  const [testClassLevel, setTestClassLevel] = useState<ClassLevel>('10');

  // --- FIREBASE MANAGER STATE ---
  const [customFirebaseJson, setCustomFirebaseJson] = useState('');
  
  const handleSaveFirebaseConfig = () => {
      try {
          const parsed = JSON.parse(customFirebaseJson);
          if (!parsed.apiKey || !parsed.authDomain) {
              alert("Invalid Config! Must contain apiKey and authDomain.");
              return;
          }
          if (confirm("⚠️ Switching Database will reload the app.\n\nMake sure you have copied the correct config!")) {
              localStorage.setItem('nst_firebase_config', JSON.stringify(parsed));
              window.location.reload();
          }
      } catch (e) {
          alert("Invalid JSON format. Please copy exactly from Firebase Console.");
      }
  };

  const handleResetFirebase = () => {
      if (confirm("Reset to Default Database? App will reload.")) {
          localStorage.removeItem('nst_firebase_config');
          window.location.reload();
      }
  };

  // --- WEEKLY TEST SAVE HANDLER (NEW) ---
  const handleSaveWeeklyTest = () => {
      if (!testName || editingTestMcqs.length === 0) {
          alert("Please provide a Test Name and add at least one question.");
          return;
      }

      const newTest = {
          id: `test-${Date.now()}`,
          name: testName,
          description: testDesc,
          isActive: true,
          classLevel: testClassLevel,
          questions: editingTestMcqs,
          totalQuestions: editingTestMcqs.length,
          passingScore: testPassScore,
          createdAt: new Date().toISOString(),
          durationMinutes: testDuration,
          selectedSubjects: testSelectedSubjects,
          selectedChapters: testSelectedChapters,
          autoSubmitEnabled: true
      };

      const updatedTests = [...(localSettings.weeklyTests || []), newTest];
      setLocalSettings({...localSettings, weeklyTests: updatedTests});
      
      // Save immediately
      localStorage.setItem('nst_system_settings', JSON.stringify({...localSettings, weeklyTests: updatedTests}));
      
      // Reset Form
      setTestName('');
      setTestDesc('');
      setEditingTestMcqs([]);
      setTestSelectedSubjects([]);
      setTestSelectedChapters([]);
      alert("✅ Weekly Test Created Successfully!");
  };

  // SELF-HEAL ADMIN PERMISSIONS (Ensure Firestore Document Exists for Rules)
  useEffect(() => {
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
          if (currentUser) {
              const adminData = { 
                  role: 'ADMIN', 
                  id: currentUser.uid, 
                  name: currentUser.displayName || 'Admin',
                  email: currentUser.email || 'admin@iic.com',
                  lastLoginDate: new Date().toISOString()
              };

              // 1. Fix Firestore Permissions
              const adminDocRef = doc(db, "users", currentUser.uid);
              setDoc(adminDocRef, adminData, { merge: true })
                  .then(() => console.log("✅ Admin Permissions Fixed in Firestore"))
                  .catch(e => console.error("Admin Self-Heal Firestore Error:", e));

              // 2. Fix RTDB Permissions (Critical for Fallback)
              const adminRtdbRef = ref(rtdb, `users/${currentUser.uid}`);
              update(adminRtdbRef, adminData)
                   .then(() => console.log("✅ Admin Permissions Fixed in RTDB"))
                   .catch(e => console.error("Admin Self-Heal RTDB Error:", e));
          }
      });
      return () => unsubscribe();
  }, []);

  // --- INITIAL LOAD & AUTO REFRESH ---
  useEffect(() => {
      loadData();
      
      // Initial Check
      setIsFirebaseConnected(checkFirebaseConnection());
      
      const interval = setInterval(() => {
          loadData();
          // Poll Connection Status
          setIsFirebaseConnected(checkFirebaseConnection());
      }, 5000); 

      // SUBSCRIBE TO USERS (Live Sync)
      const unsubUsers = subscribeToUsers((cloudUsers) => {
          if (cloudUsers && cloudUsers.length > 0) {
              // 1. Detect New Users (Real-time)
              const prevUsers = prevUsersRef.current;
              if (prevUsers.length > 0) { 
                  const newUsers = cloudUsers.filter(u => !prevUsers.some(p => p.id === u.id));
                  if (newUsers.length > 0) {
                      const names = newUsers.map(u => u.name).join(', ');
                      setAlertConfig({
                          isOpen: true, 
                          message: `🎉 New Student Registered: ${names}`
                      });
                  }
              }

              // 2. Sort by CreatedAt DESC (Newest First)
              const sortedUsers = [...cloudUsers].sort((a,b) => {
                  const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                  const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                  return dateB - dateA;
              });

              setUsers(sortedUsers);
              prevUsersRef.current = sortedUsers;
              localStorage.setItem('nst_users', JSON.stringify(sortedUsers));
          }
      });

      // SUBSCRIBE TO RECOVERY REQUESTS (Live Sync)
      const reqRef = ref(rtdb, 'recovery_requests');
      const unsubReqs = onValue(reqRef, (snapshot) => {
          const data = snapshot.val();
          if (data) {
              const reqList: RecoveryRequest[] = Object.values(data);
              setRecoveryRequests(reqList.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
              setRecoveryRequests([]);
          }
      });

      return () => {
          clearInterval(interval);
          unsubUsers();
          unsubReqs();
      };
  }, []);

  useEffect(() => {
      if (activeTab === 'DATABASE') {
          setDbContent(localStorage.getItem(dbKey) || '');
      }
  }, [activeTab, dbKey]);

  // Clear selections when switching main tabs
  useEffect(() => {
      if (!['SYLLABUS_MANAGER', 'CONTENT_PDF', 'CONTENT_VIDEO', 'CONTENT_MCQ', 'CONTENT_TEST', 'CONTENT_NOTES', 'BULK_UPLOAD'].includes(activeTab)) {
          setSelSubject(null);
          setEditingChapterId(null);
      }
  }, [activeTab]);

  const handleCropComplete = (croppedImage: string) => {
      setLocalSettings({ ...localSettings, appLogo: croppedImage });
      setCropImageSrc(null);
  };

  const loadData = () => {
      const storedUsersStr = localStorage.getItem('nst_users');
      if (storedUsersStr) setUsers(JSON.parse(storedUsersStr));
      
      const demandStr = localStorage.getItem('nst_demand_requests');
      if (demandStr) setDemands(JSON.parse(demandStr));

      // const reqStr = localStorage.getItem('nst_recovery_requests');
      // if (reqStr) setRecoveryRequests(JSON.parse(reqStr));

      const logsStr = localStorage.getItem('nst_activity_log');
      if (logsStr) setLogs(JSON.parse(logsStr));

      const codesStr = localStorage.getItem('nst_admin_codes');
      if (codesStr) setGiftCodes(JSON.parse(codesStr));

      const subStr = localStorage.getItem('nst_custom_subjects_pool');
      if (subStr) setCustomSubjects(JSON.parse(subStr));

      const binStr = localStorage.getItem('nst_recycle_bin');
      if (binStr) {
          const binItems: RecycleBinItem[] = JSON.parse(binStr);
          const now = new Date();
          const validItems = binItems.filter(item => new Date(item.expiresAt) > now);
          if (validItems.length !== binItems.length) {
              localStorage.setItem('nst_recycle_bin', JSON.stringify(validItems));
          }
          setRecycleBin(validItems);
      }
  };

  // --- SESSION MANAGER STATE ---
  const [sessionData, setSessionData] = useState<Record<string, MonthlySyllabus[]>>(DEFAULT_SYLLABUS);
  const [sessionJson, setSessionJson] = useState('');
  const [isEditingSession, setIsEditingSession] = useState(false);

  useEffect(() => {
    const storedSyllabus = localStorage.getItem('nst_syllabus_data');
    if (storedSyllabus) {
        try {
            const parsed = JSON.parse(storedSyllabus);
            setSessionData(parsed);
        } catch(e) {}
    }
  }, []);

  const handleSaveSession = () => {
      try {
          const parsed = JSON.parse(sessionJson);
          setSessionData(parsed);
          localStorage.setItem('nst_syllabus_data', JSON.stringify(parsed));
          // TODO: Sync to Firebase if needed
          if (isFirebaseConnected) {
             // saveSyllabusData(parsed); // Need to implement this in firebase.ts if required
          }
          setIsEditingSession(false);
          alert("Session Structure Updated!");
      } catch (e) {
          alert("Invalid JSON format. Please check syntax.");
      }
  };

  // --- SETTINGS HANDLERS ---
  const handleSaveSettings = () => {
      if (onUpdateSettings) {
          onUpdateSettings(localSettings);
          localStorage.setItem('nst_system_settings', JSON.stringify(localSettings));
          
          // SYNC TO FIREBASE
          if (isFirebaseConnected) {
             saveSystemSettings(localSettings);
          }
          
          logActivity("SETTINGS_UPDATE", "Updated system settings");
          alert("Settings Saved to Cloud!");
      }
  };

  const toggleSetting = (key: keyof SystemSettings) => {
      const newVal = !localSettings[key];
      const updated = { ...localSettings, [key]: newVal };
      setLocalSettings(updated);
      if(onUpdateSettings) onUpdateSettings(updated);
      localStorage.setItem('nst_system_settings', JSON.stringify(updated));
      logActivity("SETTINGS_TOGGLED", `Toggled ${key} to ${newVal}`);
  };

  const toggleItemInList = <T extends string>(list: T[] | undefined, item: T): T[] => {
      const current = list || [];
      return current.includes(item) ? current.filter(i => i !== item) : [...current, item];
  };

  // --- DEPLOYMENT HANDLER (ZIP GENERATOR - VERSIONED) ---
  const handleDownloadSource = async () => {
      const zip = new JSZip();
      
      // 1. Gather Data & Add Version
      const currentData: any = {};
      const dataVersion = Date.now().toString(); // New Version ID
      currentData['nst_data_version'] = dataVersion;

      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('nst_')) {
              const rawValue = localStorage.getItem(key);
              try {
                  currentData[key] = JSON.parse(rawValue || 'null');
              } catch (e) {
                  currentData[key] = rawValue;
              }
          }
      }

      // 2. Project Config
      const packageJson = {
        "name": "nst-ai-app",
        "private": true,
        "version": "3.1.0",
        "type": "module",
        "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
        "dependencies": {
          "@google/genai": "^1.33.0",
          "lucide-react": "^0.344.0",
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "react-markdown": "^9.0.1",
          "remark-math": "^6.0.0",
          "rehype-katex": "^7.0.0",
          "katex": "^0.16.9",
          "jszip": "^3.10.1",
          "firebase": "^10.8.0"
        },
        "devDependencies": {
          "@types/react": "^18.2.66",
          "@types/react-dom": "^18.2.22",
          "@vitejs/plugin-react": "^4.2.1",
          "autoprefixer": "^10.4.18",
          "postcss": "^8.4.35",
          "tailwindcss": "^3.4.1",
          "typescript": "^5.2.2",
          "vite": "^5.2.0"
        }
      };

      const tsConfig = {
        "compilerOptions": {
          "target": "ES2020",
          "useDefineForClassFields": true,
          "lib": ["ES2020", "DOM", "DOM.Iterable"],
          "module": "ESNext",
          "skipLibCheck": true,
          "moduleResolution": "bundler",
          "allowImportingTsExtensions": true,
          "resolveJsonModule": true,
          "isolatedModules": true,
          "noEmit": true,
          "jsx": "react-jsx",
          "strict": true,
          "noUnusedLocals": true,
          "noUnusedParameters": true,
          "noFallthroughCasesInSwitch": true
        },
        "include": ["src"],
        "references": [{ "path": "./tsconfig.node.json" }]
      };

      const viteConfig = `
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
      `;

      const tailwindConfig = `
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
      `;

      const postcssConfig = `export default { plugins: { tailwindcss: {}, autoprefixer: {}, }, }`;

      const indexHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>NST AI App</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
      `;

      // 3. Add Config Files
      zip.file("package.json", JSON.stringify(packageJson, null, 2));
      zip.file("tsconfig.json", JSON.stringify(tsConfig, null, 2));
      zip.file("vite.config.ts", viteConfig);
      zip.file("tailwind.config.js", tailwindConfig);
      zip.file("postcss.config.js", postcssConfig);
      zip.file("index.html", indexHtml);
      zip.file("README.md", `# NST AI Assistant\nDeployed Version: ${dataVersion}`);
      
      // 4. Source Files with AUTO UPDATE LOGIC
      const src = zip.folder("src");
      src?.file("initialData.json", JSON.stringify(currentData, null, 2));
      
      const restoreScript = `
        export const loadInitialData = () => {
            try {
                // @ts-ignore
                import data from './initialData.json';
                
                const currentVersion = localStorage.getItem('nst_data_version');
                const newVersion = data['nst_data_version'];
                
                // If this is a new deployment (new version found in code) OR no data exists
                // We overwrite LocalStorage with the Admin's deployed data
                if (!currentVersion || (newVersion && Number(newVersion) > Number(currentVersion))) {
                    console.log("New Admin Data Detected! Updating App...");
                    
                    // Preserve Student's User ID/Progress if possible (Merge Strategy)
                    const currentUser = localStorage.getItem('nst_current_user');
                    const userHistory = localStorage.getItem('nst_user_history');
                    
                    // Clear old data to prevent conflicts
                    localStorage.clear();

                    // Load new Admin Data
                    Object.keys(data).forEach(key => {
                        const val = data[key];
                        const storedValue = (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val;
                        localStorage.setItem(key, storedValue);
                    });
                    
                    // Restore Student Login if it exists
                    if (currentUser) localStorage.setItem('nst_current_user', currentUser);
                    if (userHistory) localStorage.setItem('nst_user_history', userHistory);

                    console.log("App Updated Successfully to version " + newVersion);
                    
                    // Reload page to apply changes cleanly
                    window.location.reload();
                }
            } catch (e) { console.log("No initial data found"); }
        };
      `;
      src?.file("restoreData.ts", restoreScript);
      
      src?.file("main.tsx", `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nimport './index.css';\nimport { loadInitialData } from './restoreData';\n\n// Run Data Sync before App Mounts\nloadInitialData();\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);`);
      
      src?.file("index.css", `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n/* Paste your custom CSS here */`);

      // Generate Zip
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `NST_App_Live_Update_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      alert("✅ UPDATE PACKAGE READY!\n\n1. Upload this ZIP to Vercel.\n2. ALL Students will get the new PDF links automatically.");
  };

  // --- RECYCLE BIN HANDLERS ---
  const softDelete = (type: RecycleBinItem['type'], name: string, data: any, originalKey?: string, originalId?: string) => {
      if (!window.confirm(`DELETE "${name}"?\n(Moved to Recycle Bin for 90 days)`)) return false;

      const newItem: RecycleBinItem = {
          id: Date.now().toString(),
          originalId: originalId || Date.now().toString(),
          type,
          name,
          data,
          deletedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          restoreKey: originalKey
      };

      const newBin = [...recycleBin, newItem];
      setRecycleBin(newBin);
      localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      return true;
  };

  const handleRestoreItem = (item: RecycleBinItem) => {
      if (!window.confirm(`Restore "${item.name}"?`)) return;

      if (item.type === 'USER') {
          const stored = localStorage.getItem('nst_users');
          const users: User[] = stored ? JSON.parse(stored) : [];
          if (!users.some(u => u.id === item.data.id)) {
              users.push(item.data);
              localStorage.setItem('nst_users', JSON.stringify(users));
          } else {
              alert("User ID already exists. Cannot restore.");
              return;
          }
      } else if (item.type === 'MCQ_BATCH' && item.restoreKey) {
          const stored = localStorage.getItem(item.restoreKey);
          const current = stored ? JSON.parse(stored) : {};
          const isTest = item.data.isTest;
          if (isTest) {
              current.weeklyTestMcqData = [...(current.weeklyTestMcqData || []), ...item.data.mcqs];
          } else {
              current.manualMcqData = [...(current.manualMcqData || []), ...item.data.mcqs];
          }
          localStorage.setItem(item.restoreKey, JSON.stringify(current));
          if (isFirebaseConnected) saveChapterData(item.restoreKey, current);

      } else if (item.restoreKey) {
          if (item.type === 'CHAPTER') {
              const listStr = localStorage.getItem(item.restoreKey);
              const list = listStr ? JSON.parse(listStr) : [];
              list.push(item.data);
              localStorage.setItem(item.restoreKey, JSON.stringify(list));
          } else {
              localStorage.setItem(item.restoreKey, JSON.stringify(item.data));
          }
      }

      const newBin = recycleBin.filter(i => i.id !== item.id);
      setRecycleBin(newBin);
      localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      alert("Item Restored!");
      loadData(); 
  };

  const handlePermanentDelete = (id: string) => {
      if (window.confirm("PERMANENTLY DELETE? This cannot be undone.")) {
          const newBin = recycleBin.filter(i => i.id !== id);
          setRecycleBin(newBin);
          localStorage.setItem('nst_recycle_bin', JSON.stringify(newBin));
      }
  };

  // --- USER MANAGEMENT (Enhanced) ---
  const deleteUser = async (userId: string) => {
      const userToDelete = users.find(u => u.id === userId);
      if (!userToDelete) return;
      if (softDelete('USER', userToDelete.name, userToDelete, undefined, userToDelete.id)) {
          // Local Update
          const updated = users.filter(u => u.id !== userId);
          setUsers(updated);
          localStorage.setItem('nst_users', JSON.stringify(updated));
          
          // Cloud Update
          if (isFirebaseConnected) {
              try {
                  // 1. Delete from Firestore
                  await deleteDoc(doc(db, "users", userId));
                  // 2. Delete from Realtime Database (CRITICAL FIX: Prevent Reappearing)
                  await remove(ref(rtdb, `users/${userId}`));
              } catch(e) { console.error("Cloud Delete Error:", e); }
          }

          logActivity("USER_DELETE", `Moved user ${userId} to Recycle Bin`);
      }
  };

  const openEditUser = (user: User) => {
      setEditingUser(user);
      setEditUserCredits(user.credits);
      setEditUserPass(user.password);
      setEditSubscriptionTier(user.subscriptionTier || 'FREE');
      setEditSubscriptionLevel(user.subscriptionLevel || 'BASIC');
      setEditSubscriptionDays(30);
      setEditSubscriptionPrice(user.subscriptionPrice || 999);
  };

  const saveEditedUser = async () => {
      if (!editingUser) return;
      const endDate = editSubscriptionTier === 'FREE' ? undefined : new Date(Date.now() + editSubscriptionDays * 24 * 60 * 60 * 1000).toISOString();
      const updatedUser = { 
          ...editingUser, 
          credits: editUserCredits, 
          password: editUserPass,
          subscriptionTier: editSubscriptionTier,
          subscriptionLevel: editSubscriptionLevel,
          subscriptionEndDate: endDate,
          subscriptionPrice: editSubscriptionPrice,
          grantedByAdmin: true,
          isPremium: editSubscriptionTier !== 'FREE'
      };
      const updatedList = users.map(u => u.id === editingUser.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));

      // Cloud Sync
      if (isFirebaseConnected) {
          await saveUserToLive(updatedUser);
      }

      setEditingUser(null);
      alert(`✅ ${editingUser.name} now has ${editSubscriptionTier} subscription until ${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}`);
  };

  const sendDirectMessage = async () => {
      if (!dmUser || !dmText) return;
      
      let giftPayload = undefined;
      if (giftType !== 'NONE') {
          giftPayload = {
              type: giftType,
              value: giftValue,
              durationHours: giftDuration
          };
      }

      const newMsg = { 
          id: `msg-${Date.now()}`, 
          text: dmText, 
          date: new Date().toISOString(), 
          read: false,
          type: giftType !== 'NONE' ? 'GIFT' : 'TEXT',
          gift: giftPayload,
          isClaimed: false
      };

      const updatedUser = { ...dmUser, inbox: [newMsg, ...(dmUser.inbox || [])] };
      const updatedList = users.map(u => u.id === dmUser.id ? updatedUser : u);
      setUsers(updatedList);
      localStorage.setItem('nst_users', JSON.stringify(updatedList));
      
      // Cloud Sync
      if (isFirebaseConnected) {
          await saveUserToLive(updatedUser);
      }

      setDmUser(null);
      setDmText('');
      setGiftType('NONE');
      alert("Message & Gift Sent!");
  };

  // --- GIFT CODE MANAGER (New) ---
  const generateCodes = () => {
      const newCodes: GiftCode[] = [];
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      
      for (let i = 0; i < newCodeCount; i++) {
          // Generate 20-char random mixed case string
          let code = '';
          for (let j = 0; j < 20; j++) {
              code += chars.charAt(Math.floor(Math.random() * chars.length));
          }

          const newGiftCode: GiftCode = {
              id: Date.now().toString() + i,
              code,
              amount: newCodeAmount,
              createdAt: new Date().toISOString(),
              isRedeemed: false,
              generatedBy: 'ADMIN',
              maxUses: newCodeMaxUses,
              usedCount: 0,
              redeemedBy: []
          };
          newCodes.push(newGiftCode);
          set(ref(rtdb, `redeem_codes/${code}`), newGiftCode); // कोड क्लाउड पर बनेगा
      }
      const updated = [...newCodes, ...giftCodes];
      setGiftCodes(updated);
      localStorage.setItem('nst_admin_codes', JSON.stringify(updated));
      alert(`${newCodeCount} Codes Generated! (Max Uses: ${newCodeMaxUses})`);
  };

  const deleteCode = (id: string) => {
      const updated = giftCodes.filter(c => c.id !== id);
      setGiftCodes(updated);
      localStorage.setItem('nst_admin_codes', JSON.stringify(updated));
  };

  // --- SUBJECT MANAGER (New) ---
  const addSubject = () => {
      if (!newSubName) return;
      const id = newSubName.toLowerCase().replace(/\s+/g, '');
      const newSubject = { id, name: newSubName, icon: newSubIcon, color: newSubColor };
      const updatedPool = { ...DEFAULT_SUBJECTS, ...customSubjects, [id]: newSubject };
      setCustomSubjects(updatedPool); // This only stores custom ones technically in state, but logic handles merge
      localStorage.setItem('nst_custom_subjects_pool', JSON.stringify(updatedPool));
      setNewSubName('');
      alert("Subject Added!");
  };

  // --- PACKAGE MANAGER (New) ---
  const addPackage = () => {
      if (!newPkgName || !newPkgPrice || !newPkgCredits) return;
      const newPkg = {
          id: `pkg-${Date.now()}`,
          name: newPkgName,
          price: Number(newPkgPrice),
          credits: Number(newPkgCredits)
      };
      const currentPkgs = localSettings.packages || [];
      const updatedPkgs = [...currentPkgs, newPkg];
      setLocalSettings({ ...localSettings, packages: updatedPkgs });
      setNewPkgName(''); setNewPkgPrice(''); setNewPkgCredits('');
  };

  const removePackage = (id: string) => {
      const currentPkgs = localSettings.packages || [];
      setLocalSettings({ ...localSettings, packages: currentPkgs.filter(p => p.id !== id) });
  };

  // --- CONTENT & SYLLABUS LOGIC ---
  const handleSubjectClick = async (s: Subject) => {
      setSelSubject(s);
      setIsLoadingChapters(true);
      try {
          const ch = await fetchChapters(selBoard, selClass, selStream, s, 'English');
          setSelChapters(ch);
          
          if (activeTab === 'BULK_UPLOAD') {
              const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
              const tempBulk: any = {};
              ch.forEach(c => {
                  const key = `nst_content_${selBoard}_${selClass}${streamKey}_${s.name}_${c.id}`;
                  const stored = localStorage.getItem(key);
                  if (stored) {
                      const d = JSON.parse(stored);
                      tempBulk[c.id] = { free: d.freeLink || '', premium: d.premiumLink || '', price: d.price || 5 };
                  } else {
                      tempBulk[c.id] = { free: '', premium: '', price: 5 };
                  }
              });
              setBulkData(tempBulk);
          }

      } catch (e) { console.error(e); setSelChapters([]); }
      setIsLoadingChapters(false);
  };

  const loadChapterContent = async (chId: string) => {
      setEditingChapterId(chId); 
      setIsContentLoading(true); // Lock inputs
      
      // STRICT KEY MATCHING (Must match VideoPlaylistView logic)
      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject?.name}_${chId}`;
      
      // 1. Try Local First (Instant Load)
      const stored = localStorage.getItem(key);
      if (stored) {
          const data = JSON.parse(stored);
          applyContentData(data);
      } else {
          // Default State
          setEditConfig({ freeLink: '', premiumLink: '', price: 5 });
          setEditingMcqs([]);
          setEditingTestMcqs([]);
          setVideoPlaylist([]);
      }

      // 2. Fetch from Cloud (Background Sync to ensure Persistence)
      if (isFirebaseConnected) {
          try {
              const cloudData = await getChapterData(key);
              if (cloudData) {
                  // Update LocalStorage & State with Cloud Data (Source of Truth)
                  localStorage.setItem(key, JSON.stringify(cloudData));
                  applyContentData(cloudData);
              }
          } catch(e) { console.error("Cloud Fetch Error", e); }
      }
      setIsContentLoading(false); // Unlock inputs
  };

  const applyContentData = (data: any) => {
      setEditConfig(data);
      setEditingMcqs(data.manualMcqData || []);
      setEditingTestMcqs(data.weeklyTestMcqData || []);
      setVideoPlaylist(data.videoPlaylist || []);
  };

  // --- UPDATED SAVE FUNCTION (WRITES TO FIREBASE) ---
  const saveChapterContent = () => {
      if (!editingChapterId || !selSubject) return;
      // STRICT KEY MATCHING (Must match VideoPlaylistView logic)
      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject.name}_${editingChapterId}`;
      const existing = localStorage.getItem(key);
      const existingData = existing ? JSON.parse(existing) : {};
      
      const newData = {
          ...existingData,
          freeLink: editConfig.freeLink,
          premiumLink: editConfig.premiumLink,
          freeVideoLink: editConfig.freeVideoLink,
          premiumVideoLink: editConfig.premiumVideoLink,
          videoCreditsCost: editConfig.videoCreditsCost,
          price: editConfig.price,
          ultraPdfLink: editConfig.ultraPdfLink,
          ultraPdfPrice: editConfig.ultraPdfPrice,
          watermarkText: editConfig.watermarkText,
          watermarkConfig: editConfig.watermarkConfig,
          manualMcqData: editingMcqs,
          weeklyTestMcqData: editingTestMcqs,
          videoPlaylist: videoPlaylist
      };
      
      // Save locally AND to Firebase
      localStorage.setItem(key, JSON.stringify(newData));
      if (isFirebaseConnected) {
          saveChapterData(key, newData); // <--- FIREBASE SAVE
          alert("✅ Content Saved to Firebase Database!");
      } else {
          alert("⚠️ Saved Locally ONLY. Firebase is NOT Connected. Check services/firebase.ts");
      }
  };

  // --- UPDATED BULK SAVE FUNCTION (WRITES TO FIREBASE) ---
  const saveBulkData = async () => {
      if (!selSubject) return;
      const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
      
      const updates: Record<string, any> = {};

      Object.keys(bulkData).forEach(chId => {
          const d = bulkData[chId];
          const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject.name}_${chId}`;
          const existing = localStorage.getItem(key);
          const existingData = existing ? JSON.parse(existing) : {};
          
          const newData = {
              ...existingData,
              freeLink: d.free,
              premiumLink: d.premium,
              price: d.price
          };
          localStorage.setItem(key, JSON.stringify(newData));
          updates[key] = newData;
      });

      if (isFirebaseConnected) {
          await bulkSaveLinks(updates); 
          alert(`✅ Saved links for ${Object.keys(bulkData).length} chapters to CLOUD!\n\nStudents will see these updates instantly without redownloading the app.`);
      } else {
          alert("⚠️ Saved Locally ONLY. Please Configure Firebase in services/firebase.ts to enable Cloud Sync.");
      }
  };

  const saveSyllabusList = () => {
      if (!selSubject) return;
      const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
      const cacheKey = `nst_custom_chapters_${selBoard}-${selClass}${streamKey}-${selSubject.name}-English`;
      localStorage.setItem(cacheKey, JSON.stringify(selChapters));
      // Save Hindi fallback
      const cacheKeyHindi = `nst_custom_chapters_${selBoard}-${selClass}${streamKey}-${selSubject.name}-Hindi`;
      localStorage.setItem(cacheKeyHindi, JSON.stringify(selChapters));
      alert("Syllabus Structure Saved!");
  };

  const deleteChapter = (idx: number) => {
      const ch = selChapters[idx];
      const streamKey = (selClass === '11' || selClass === '12') ? `-${selStream}` : '';
      const cacheKey = `nst_custom_chapters_${selBoard}-${selClass}${streamKey}-${selSubject?.name}-English`;
      
      if (softDelete('CHAPTER', ch.title, ch, cacheKey)) {
          const updated = selChapters.filter((_, i) => i !== idx);
          setSelChapters(updated);
      }
  };

  // --- MCQ EDITING HELPERS ---
  const updateMcq = (isTest: boolean, idx: number, field: keyof MCQItem, val: any) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = [...list];
      updated[idx] = { ...updated[idx], [field]: val };
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };
  const updateMcqOption = (isTest: boolean, qIdx: number, oIdx: number, val: string) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = [...list];
      updated[qIdx].options[oIdx] = val;
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };
  const addMcq = (isTest: boolean) => {
      const newItem: MCQItem = { question: 'New Question', options: ['A','B','C','D'], correctAnswer: 0, explanation: '' };
      isTest ? setEditingTestMcqs([...editingTestMcqs, newItem]) : setEditingMcqs([...editingMcqs, newItem]);
  };
  const removeMcq = (isTest: boolean, idx: number) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      const updated = list.filter((_, i) => i !== idx);
      isTest ? setEditingTestMcqs(updated) : setEditingMcqs(updated);
  };

  const deleteAllMcqs = (isTest: boolean) => {
      const list = isTest ? editingTestMcqs : editingMcqs;
      if (list.length === 0) return;
      
      if (!window.confirm(`DELETE ALL ${list.length} Questions?\nThey will be moved to Recycle Bin.`)) return;

      const streamKey = (selClass === '11' || selClass === '12') && selStream ? `-${selStream}` : '';
      const key = `nst_content_${selBoard}_${selClass}${streamKey}_${selSubject?.name}_${editingChapterId}`;
      
      if (softDelete('MCQ_BATCH', `${isTest ? 'Test' : 'Practice'} MCQs (${list.length}) - ${selSubject?.name}`, { mcqs: list, isTest }, key)) {
          isTest ? setEditingTestMcqs([]) : setEditingMcqs([]);
      }
  };

  // --- GOOGLE SHEET IMPORT HANDLER (ROBUST) ---
  const handleGoogleSheetImport = (isTest: boolean) => {
      if (!importText.trim()) {
          alert("Please paste data first!");
          return;
      }

      try {
          const rawText = importText.trim();
          let newQuestions: MCQItem[] = [];

          // MODE A: Tab-Separated (Excel/Sheets/Copy-Paste) - PREFERRED
          if (rawText.includes('\t')) {
              const rows = rawText.split('\n').filter(r => r.trim());
              newQuestions = rows.map((row, idx) => {
                  let cols = row.split('\t');
                  
                  // Handle mixed CSV fallback
                  if (cols.length < 3 && row.includes(',')) cols = row.split(',');

                  cols = cols.map(c => c.trim());

                  // Flexible Column Check (Min: Q + 4 Opts + Ans = 6)
                  if (cols.length < 6) {
                      throw new Error(`Row ${idx + 1} invalid. Found ${cols.length} columns. Expected at least 6 (Q, Opts, Ans).`);
                  }

                  // Parse Answer (1-4 or A-D)
                  let ansIdx = parseInt(cols[5]) - 1;
                  if (isNaN(ansIdx)) {
                      const map: any = { 'A': 0, 'B': 1, 'C': 2, 'D': 3, 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
                      if (map[cols[5]] !== undefined) ansIdx = map[cols[5]];
                  }

                  return {
                      question: cols[0],
                      options: [cols[1], cols[2], cols[3], cols[4]],
                      correctAnswer: (ansIdx >= 0 && ansIdx <= 3) ? ansIdx : 0, // Default to A if invalid
                      explanation: cols[6] || ''
                  };
              });
          } 
          // MODE B: Vertical Block Format (Flexible for Long Explanation)
          // Format: Q \n Opts(4) \n Ans \n Exp (Multi-line)
          else {
              const lines = rawText.split('\n').map(l => l.trim()).filter(l => l);
              let i = 0;
              
              while (i + 5 < lines.length) {
                  const q = lines[i];
                  const opts = [lines[i+1], lines[i+2], lines[i+3], lines[i+4]];
                  
                  // Clean Answer Line (remove "Answer:", "Ans:", etc)
                  let ansRaw = lines[i+5].replace(/^(Answer|Ans|Correct)[:\s-]*/i, '').trim();
                  
                  // Parse Answer (1-4 or A-D)
                  let ansIdx = parseInt(ansRaw) - 1;
                  if (isNaN(ansIdx)) {
                      // Handle A,B,C,D or Option A...
                      const firstChar = ansRaw.charAt(0).toUpperCase();
                      const map: any = { 'A': 0, 'B': 1, 'C': 2, 'D': 3 };
                      if (map[firstChar] !== undefined) ansIdx = map[firstChar];
                  }

                  // Parse Explanation (Multi-line support)
                  // Consume lines until we see a "New Question" pattern or End of File
                  let expLines = [];
                  let nextIndex = i + 6;
                  
                  while (nextIndex < lines.length) {
                      const line = lines[nextIndex];
                      
                      // Pattern to detect START of next question:
                      // 1. Starts with number + dot/paren (e.g. "10.", "10)")
                      // 2. Starts with "Q" + number (e.g. "Q1", "Q.1")
                      // 3. Starts with "Question"
                      const isNewQuestion = /^(Q\d+|Question|\d+[\.)])\s/.test(line);
                      
                      if (isNewQuestion) break; 
                      
                      expLines.push(line);
                      nextIndex++;
                  }

                  newQuestions.push({
                      question: q,
                      options: opts,
                      correctAnswer: (ansIdx >= 0 && ansIdx <= 3) ? ansIdx : 0,
                      explanation: expLines.join('\n')
                  });
                  
                  i = nextIndex;
              }
          }

          if (newQuestions.length === 0) {
              throw new Error("No valid questions detected. Use Tab-Separated columns OR Vertical Blocks.");
          }

          if (isTest) {
              setEditingTestMcqs(prev => [...prev, ...newQuestions]);
          } else {
              setEditingMcqs(prev => [...prev, ...newQuestions]);
          }
          
          setImportText('');
          alert(`Success! ${newQuestions.length} questions imported.`);

      } catch (error: any) {
          alert("Import Failed: " + error.message);
      }
  };

  // --- ACCESS REQUEST HANDLERS ---
  const handleApproveRequest = async (req: RecoveryRequest) => {
      // 1. Update Request Status in RTDB
      const reqRef = ref(rtdb, `recovery_requests/${req.id}`);
      await update(reqRef, { status: 'RESOLVED' });

      // 2. Enable Passwordless Login for User
      const userToUpdate = users.find(u => u.id === req.id);
      if (userToUpdate) {
          const updatedUser = { ...userToUpdate, isPasswordless: true };
          // Save to Local & Cloud
          if (isFirebaseConnected) {
              await saveUserToLive(updatedUser);
          }
      }
      
      alert(`Access Approved for ${req.name}. They can now login without password.`);
  };

  // --- SUB-COMPONENTS (RENDER HELPERS) ---
  const DashboardCard = ({ icon: Icon, label, onClick, color, count }: any) => (
      <button onClick={onClick} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 bg-white border-slate-200 hover:border-${color}-400 hover:bg-${color}-50`}>
          <div className={`p-3 rounded-full bg-${color}-100 text-${color}-600`}>
              <Icon size={24} />
          </div>
          <span className="font-bold text-xs uppercase text-slate-600">{label}</span>
          {count !== undefined && <span className={`text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-500`}>{count}</span>}
      </button>
  );

  const SubjectSelector = () => {
      // 1. BOARD BUTTONS
      const renderBoards = () => (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {['CBSE', 'BSEB'].map(b => (
                  <button 
                      key={b}
                      onClick={() => setSelBoard(b as Board)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selBoard === b ? 'bg-slate-800 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                      {b}
                  </button>
              ))}
          </div>
      );

      // 2. CLASS BUTTONS (Explicit List)
      const renderClasses = () => (
          <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Class</p>
              <div className="flex flex-wrap gap-2">
                  {['6','7','8','9','10','11','12', 'COMPETITION'].map(c => (
                      <button 
                          key={c}
                          onClick={() => setSelClass(c as ClassLevel)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${selClass === c ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 scale-110' : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'}`}
                          title={c === 'COMPETITION' ? 'Competitive Exam' : `Class ${c}`}
                      >
                          {c === 'COMPETITION' ? '🏆' : c}
                      </button>
                  ))}
              </div>
          </div>
      );

      // 3. STREAM BUTTONS (Conditional)
      const renderStreams = () => {
          if (!['11', '12'].includes(selClass)) return null;
          return (
              <div className="mb-4 animate-in fade-in slide-in-from-left-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Stream</p>
                  <div className="flex gap-2">
                      {['Science', 'Commerce', 'Arts'].map(s => (
                          <button 
                              key={s}
                              onClick={() => setSelStream(s as Stream)}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${selStream === s ? 'bg-purple-600 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-600 hover:bg-purple-50'}`}
                          >
                              {s}
                          </button>
                      ))}
                  </div>
              </div>
          );
      };

      // 4. SUBJECT BUTTONS
      const renderSubjects = () => (
          <div className="mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Select Subject</p>
              <div className="flex flex-wrap gap-2">
                  {getSubjectsList(selClass, selStream).map(s => (
                      <button 
                          key={s.id} 
                          onClick={() => handleSubjectClick(s)}
                          className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 ${selSubject?.id === s.id ? 'bg-green-600 text-white border-green-600 shadow-md scale-105' : 'bg-white border-slate-200 text-slate-700 hover:bg-green-50'}`}
                      >
                          {selSubject?.id === s.id && <CheckCircle size={12} />}
                          {s.name}
                      </button>
                  ))}
              </div>
          </div>
      );

      return (
          <div className="mb-8 bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-inner">
              {renderBoards()}
              {renderClasses()}
              {renderStreams()}
              {renderSubjects()}
              
              {isLoadingChapters && <div className="text-slate-500 text-sm font-bold py-4 animate-pulse text-center">Loading Chapters...</div>}
          </div>
      );
  };

  // --- MAIN RENDER ---
  return (
    <div className="pb-20 bg-slate-50 min-h-screen">
      
      {/* 1. DASHBOARD HOME */}
      {activeTab === 'DASHBOARD' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6 animate-in fade-in">
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                      <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg"><Shield size={20} /></div>
                      <div>
                          <h2 className="font-black text-slate-800 text-lg leading-none">Admin Console</h2>
                          <div className="flex items-center gap-2 mt-1">
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Control System</p>
                              
                              {/* ONLINE USERS */}
                              <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200" title="Active Users (5m)">
                                  <div className="relative">
                                      <Users size={10} className="text-slate-500" />
                                      <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full border border-white animate-pulse"></div>
                                  </div>
                                  <span className="text-[9px] font-bold text-slate-600">{onlineCount} Online</span>
                              </div>

                              {/* FIREBASE STATUS INDICATOR */}
                              {isFirebaseConnected ? (
                                  <span className="flex items-center gap-1 bg-green-100 text-green-700 text-[9px] px-2 py-0.5 rounded-full font-bold">
                                      <Wifi size={10} /> Online
                                  </span>
                              ) : (
                                  <span className="flex items-center gap-1 bg-red-100 text-red-700 text-[9px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                                      <WifiOff size={10} /> Disconnected (Check Config)
                                  </span>
                              )}
                          </div>
                      </div>
                  </div>
                  <button onClick={handleSaveSettings} className="bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"><Save size={16} /> Save Settings</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  <DashboardCard icon={Users} label="Users" onClick={() => setActiveTab('USERS')} color="blue" count={users.length} />
                  <DashboardCard icon={CreditCard} label="Subscriptions" onClick={() => setActiveTab('SUBSCRIPTION_MANAGER')} color="purple" />
                  <DashboardCard icon={Crown} label="Plans Manager" onClick={() => setActiveTab('SUBSCRIPTION_PLANS_EDITOR')} color="blue" />
                  <DashboardCard icon={Gift} label="Gift Codes" onClick={() => setActiveTab('CODES')} color="pink" />
                  <DashboardCard icon={Book} label="Subjects" onClick={() => setActiveTab('SUBJECTS_MGR')} color="emerald" />
                  <DashboardCard icon={Zap} label="Featured Shortcuts" onClick={() => setActiveTab('FEATURED_CONTENT')} color="yellow" />
                  <DashboardCard icon={MessageSquare} label="Support Chat" onClick={() => setActiveTab('SUPPORT_CHAT')} color="indigo" /> 
                  <DashboardCard icon={Megaphone} label="Demands" onClick={() => setActiveTab('DEMAND')} color="orange" count={demands.length} />
                  <DashboardCard icon={Key} label="Login Reqs" onClick={() => setActiveTab('ACCESS')} color="purple" count={recoveryRequests.filter(r => r.status === 'PENDING').length} />
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>
                  
                  <DashboardCard icon={Calendar} label="Session Structure" onClick={() => setActiveTab('SESSION_MANAGER')} color="teal" />
                  <DashboardCard icon={ListChecks} label="Chapters List" onClick={() => setActiveTab('SYLLABUS_MANAGER')} color="indigo" />
                  <DashboardCard icon={LayersIcon} label="Bulk Upload" onClick={() => setActiveTab('BULK_UPLOAD')} color="red" />
                  <DashboardCard icon={FileText} label="PDF Material" onClick={() => setActiveTab('CONTENT_PDF')} color="cyan" />
                  <DashboardCard icon={Video} label="Video Lectures" onClick={() => setActiveTab('CONTENT_VIDEO')} color="rose" />
                  <DashboardCard icon={CheckCircle} label="Practice MCQs" onClick={() => setActiveTab('CONTENT_MCQ')} color="purple" />
                  {/* <DashboardCard icon={FileJson} label="Rich Notes (HTML)" onClick={() => setActiveTab('CONTENT_NOTES')} color="teal" /> - REMOVED */}
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>

                  <DashboardCard icon={Monitor} label="General" onClick={() => setActiveTab('CONFIG_GENERAL')} color="blue" />
                  <DashboardCard icon={ShieldCheck} label="Security" onClick={() => setActiveTab('CONFIG_SECURITY')} color="red" />
                  <DashboardCard icon={Eye} label="Visibility" onClick={() => setActiveTab('CONFIG_VISIBILITY')} color="cyan" />
                  <DashboardCard icon={BrainCircuit} label="AI Brain" onClick={() => setActiveTab('CONFIG_AI')} color="violet" />
                  <DashboardCard icon={Sparkles} label="Ads Config" onClick={() => setActiveTab('CONFIG_ADS')} color="rose" />
                  <DashboardCard icon={Gamepad2} label="Game Config" onClick={() => setActiveTab('CONFIG_GAME')} color="orange" />
                  <DashboardCard icon={Banknote} label="Payment" onClick={() => setActiveTab('CONFIG_PAYMENT')} color="emerald" />
                  <DashboardCard icon={Globe} label="External Apps" onClick={() => setActiveTab('CONFIG_EXTERNAL_APPS')} color="indigo" />
                  <DashboardCard icon={Gift} label="Engagement Rewards" onClick={() => setActiveTab('CONFIG_REWARDS')} color="rose" />
                  <DashboardCard icon={ShoppingBag} label="💰 Pricing" onClick={() => setActiveTab('PRICING_MGMT')} color="yellow" />
                  
                  <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6 h-px bg-slate-100 my-2"></div>

                  <DashboardCard icon={Cloud} label="Deploy App" onClick={() => setActiveTab('DEPLOY')} color="sky" />
                  <DashboardCard icon={Database} label="Database" onClick={() => setActiveTab('DATABASE')} color="gray" />
                  <DashboardCard icon={Trash2} label="Recycle Bin" onClick={() => setActiveTab('RECYCLE')} color="red" count={recycleBin.length} />
                  <DashboardCard icon={LogOut} label="Exit" onClick={() => onNavigate('STUDENT_DASHBOARD')} color="slate" />
              </div>
          </div>
      )}

      {/* --- SUPPORT CHAT TAB (NEW) --- */}
      {activeTab === 'SUPPORT_CHAT' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Live Support Chat</h3>
              </div>
              <div className="h-[75vh]">
                   {/* We pass a dummy currentUser because Admin logic handles it inside UniversalChat */}
                   <UniversalChat 
                      currentUser={{id: 'admin', name: 'Admin', role: 'ADMIN', credits: 0, classLevel: '10', board: 'CBSE', stream: 'Science', email: 'admin@iic.com', password: '', createdAt: '', streak: 0, lastActiveTime: ''}} 
                      onUserUpdate={() => {}} 
                      isAdminView={true} 
                      settings={localSettings} 
                   />
              </div>
          </div>
      )}

      {/* --- FEATURED CONTENT SHORTCUTS --- */}
      {activeTab === 'FEATURED_CONTENT' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Home Screen Shortcuts</h3>
              </div>
              
              <div className="mb-6">
                  <label className="text-xs font-bold uppercase text-slate-500 block mb-1">Section Title (Question)</label>
                  <input 
                      type="text" 
                      value={localSettings.featuredSectionTitle || ''} 
                      onChange={e => setLocalSettings({...localSettings, featuredSectionTitle: e.target.value})} 
                      placeholder="e.g., What do you want to learn today?" 
                      className="w-full p-3 border rounded-xl font-bold text-slate-800"
                  />
                  <div className="mt-2 text-right">
                      <button onClick={handleSaveSettings} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold">Update Title</button>
                  </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 mb-8">
                  <h4 className="font-bold text-blue-900 mb-4">Add New Shortcut (Max 4)</h4>
                  
                  {/* Selector Reuse */}
                  <SubjectSelector />

                  {selSubject && (
                      <div className="space-y-4">
                          <div className="bg-white p-3 rounded-xl border border-blue-200">
                              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Select Chapter</p>
                              <select 
                                  onChange={e => {
                                      const ch = selChapters.find(c => c.id === e.target.value);
                                      if (ch) {
                                          // Add logic
                                          if ((localSettings.featuredItems?.length || 0) >= 4) {
                                              alert("Max 4 items allowed. Please delete one first.");
                                              return;
                                          }
                                          const type = prompt("Content Type? (MCQ / PDF / VIDEO)", "MCQ");
                                          if (!type) return;
                                          const cleanType = type.toUpperCase().trim();
                                          if (!['MCQ', 'PDF', 'VIDEO'].includes(cleanType)) {
                                              alert("Invalid Type. Use MCQ, PDF, or VIDEO");
                                              return;
                                          }

                                          const newItem = {
                                              id: `feat-${Date.now()}`,
                                              title: ch.title,
                                              subtitle: `${selClass} • ${selSubject.name}`,
                                              board: selBoard,
                                              classLevel: selClass,
                                              stream: selStream,
                                              subject: selSubject,
                                              chapter: ch,
                                              type: cleanType as any
                                          };

                                          const updated = [...(localSettings.featuredItems || []), newItem];
                                          setLocalSettings({...localSettings, featuredItems: updated});
                                          // Save immediately to preview
                                          localStorage.setItem('nst_system_settings', JSON.stringify({...localSettings, featuredItems: updated}));
                                      }
                                  }}
                                  className="w-full p-2 border rounded-lg"
                              >
                                  <option value="">-- Choose Chapter --</option>
                                  {selChapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                              </select>
                          </div>
                      </div>
                  )}
              </div>

              <div className="space-y-3">
                  <h4 className="font-bold text-slate-800">Active Shortcuts</h4>
                  {(!localSettings.featuredItems || localSettings.featuredItems.length === 0) && <p className="text-slate-400 text-sm">No shortcuts added.</p>}
                  {localSettings.featuredItems?.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                          <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs ${item.type === 'MCQ' ? 'bg-purple-100 text-purple-600' : item.type === 'PDF' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                                  {item.type}
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">{item.title}</p>
                                  <p className="text-xs text-slate-500">{item.subtitle} ({item.board})</p>
                              </div>
                          </div>
                          <button onClick={() => {
                              const updated = localSettings.featuredItems!.filter((_, i) => i !== idx);
                              setLocalSettings({...localSettings, featuredItems: updated});
                          }} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={18} /></button>
                      </div>
                  ))}
              </div>
              
              <button onClick={handleSaveSettings} className="w-full mt-6 bg-green-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-green-700">Save Changes & Publish</button>
          </div>
      )}

      {/* --- BULK UPLOAD TAB (NEW) --- */}
      {activeTab === 'BULK_UPLOAD' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Daily Bulk Upload</h3>
              </div>
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 mb-6 text-sm text-yellow-800">
                  <strong>Instructions:</strong> Paste your links here. If Firebase is configured, clicking Save will sync for ALL students instantly. No need to redeploy.
              </div>
              
              <SubjectSelector />

              {selSubject && selChapters.length > 0 && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-100 p-3 rounded-lg font-bold text-slate-600 text-xs uppercase">
                          <div className="w-8">#</div>
                          <div className="flex-1">Chapter</div>
                          <div className="w-1/3">Premium Link (Paid)</div>
                          <div className="w-16">Price</div>
                      </div>
                      
                      {selChapters.map((ch, idx) => {
                          const data = bulkData[ch.id] || { free: '', premium: '', price: 5 };
                          return (
                              <div key={ch.id} className="flex gap-2 items-center">
                                  <div className="w-8 text-center text-xs font-bold text-slate-400">{idx + 1}</div>
                                  <div className="flex-1 text-sm font-bold text-slate-700 truncate">{ch.title}</div>
                                  <div className="w-1/3">
                                      <input 
                                          type="text" 
                                          placeholder="Paste Premium PDF Link..." 
                                          value={data.premium}
                                          onChange={e => setBulkData({...bulkData, [ch.id]: { ...data, premium: e.target.value }})}
                                          className="w-full p-2 border border-purple-200 bg-purple-50 rounded text-xs focus:ring-1 focus:ring-purple-500 outline-none"
                                      />
                                  </div>
                                  <div className="w-16">
                                      <input 
                                          type="number" 
                                          value={data.price}
                                          onChange={e => setBulkData({...bulkData, [ch.id]: { ...data, price: Number(e.target.value) }})}
                                          className="w-full p-2 border border-slate-200 rounded text-xs text-center font-bold"
                                      />
                                  </div>
                              </div>
                          );
                      })}

                      <div className="pt-6 border-t mt-4">
                          <button onClick={saveBulkData} className="w-full py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2">
                              <Save size={20} /> Save All & Sync
                          </button>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* SESSION MANAGER (New) */}
      {activeTab === 'SESSION_MANAGER' && (
          <div className="bg-white p-0 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right overflow-hidden h-[85vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-white">
                  <div className="flex items-center gap-4">
                      <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                      <h3 className="text-xl font-black text-teal-800">Session Structure Manager</h3>
                  </div>
                  {/* Class Selector for Preview */}
                  <div className="flex gap-2">
                       {['9','10','11','12'].map(c => (
                           <button key={c} onClick={() => setSelClass(c as ClassLevel)} className={`px-3 py-1 rounded-lg font-bold text-xs ${selClass === c ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Class {c}</button>
                       ))}
                  </div>
              </div>

              {/* SESSION CONTROLS */}
              <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Session Start Date</label>
                          <input 
                              type="date" 
                              value={localSettings.sessionStartDate ? localSettings.sessionStartDate.split('T')[0] : ''} 
                              onChange={e => setLocalSettings({...localSettings, sessionStartDate: new Date(e.target.value).toISOString()})}
                              className="p-2 border rounded-lg text-sm font-bold text-slate-700 bg-white"
                          />
                      </div>
                      <p className="text-[10px] text-slate-400 max-w-xs">
                          Changing this will reset the monthly locking schedule for all students.
                      </p>
                  </div>
                  <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow hover:bg-blue-700">
                      Save Start Date
                  </button>
              </div>

              {/* SPLIT VIEW: EDITOR & PREVIEW */}
              <div className="flex-1 flex overflow-hidden">
                  {isEditingSession ? (
                      <div className="flex-1 p-4 bg-slate-900 flex flex-col">
                          <div className="flex justify-between items-center mb-2 text-slate-400">
                               <p className="text-xs font-mono">Edit JSON Structure directly</p>
                               <div className="flex gap-2">
                                   <button onClick={() => setIsEditingSession(false)} className="px-3 py-1 bg-slate-700 rounded text-xs font-bold hover:bg-slate-600">Cancel</button>
                                   <button onClick={handleSaveSession} className="px-3 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700">Save JSON</button>
                               </div>
                          </div>
                          <textarea 
                              value={sessionJson} 
                              onChange={e => setSessionJson(e.target.value)} 
                              className="flex-1 bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-xl border border-slate-700 outline-none resize-none"
                              spellCheck={false}
                          />
                      </div>
                  ) : (
                      <div className="flex-1 relative">
                          <SyllabusStructure 
                                user={{...users[0] || {}, classLevel: selClass}} // Mock user with selected class
                                isAdmin={true}
                                startDate={localSettings.sessionStartDate}
                                onEdit={() => {
                                    setSessionJson(JSON.stringify(sessionData, null, 2));
                                    setIsEditingSession(true);
                                }}
                          />
                      </div>
                  )}
              </div>
          </div>
      )}

      {/* 2. SYLLABUS MANAGER */}
      {activeTab === 'SYLLABUS_MANAGER' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-indigo-800">Syllabus Manager</h3>
              </div>
              <SubjectSelector />
              {selSubject && (
                  <div className="space-y-4">
                      <div className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                          <h4 className="font-bold text-indigo-900">Chapters: {selSubject.name}</h4>
                          <div className="flex gap-2">
                              <button onClick={() => setSelChapters([...selChapters, { id: `manual-${Date.now()}`, title: 'New Chapter' }])} className="px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 font-bold rounded-lg text-xs">+ Add Chapter</button>
                              <button onClick={saveSyllabusList} className="px-3 py-1.5 bg-indigo-600 text-white font-bold rounded-lg text-xs shadow">Save List</button>
                          </div>
                      </div>
                      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                          {selChapters.map((ch, idx) => (
                              <div key={ch.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="w-6 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                                  <input 
                                      type="text" 
                                      value={ch.title} 
                                      onChange={(e) => { const up = [...selChapters]; up[idx].title = e.target.value; setSelChapters(up); }}
                                      className="flex-1 p-2 border border-slate-200 rounded text-sm font-medium focus:border-indigo-500 outline-none"
                                  />
                                  
                                  {/* LOCK TOGGLE */}
                                  <button 
                                      onClick={() => {
                                          const up = [...selChapters];
                                          // Toggle 'isLocked' property
                                          // @ts-ignore
                                          up[idx].isLocked = !up[idx].isLocked;
                                          setSelChapters(up);
                                      }}
                                      className={`p-2 rounded-lg transition-colors ${
                                          // @ts-ignore
                                          ch.isLocked ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400 hover:text-slate-600'
                                      }`}
                                      title={
                                          // @ts-ignore
                                          ch.isLocked ? "Unlock Chapter" : "Lock Chapter"
                                      }
                                  >
                                      {/* @ts-ignore */}
                                      {ch.isLocked ? <Lock size={16} /> : <Eye size={16} />}
                                  </button>

                                  <button onClick={() => deleteChapter(idx)} className="p-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* 3. CONTENT MANAGERS (PDF, MCQ, TEST, NOTES) */}
      {['CONTENT_PDF', 'CONTENT_VIDEO', 'CONTENT_MCQ', 'CONTENT_TEST'].includes(activeTab) && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">
                      {activeTab === 'CONTENT_PDF' ? 'PDF Study Material' : activeTab === 'CONTENT_VIDEO' ? 'Video Lectures' : activeTab === 'CONTENT_MCQ' ? 'Practice MCQs' : 'Weekly Tests - Multi-Subject'}
                  </h3>
              </div>
              {activeTab !== 'CONTENT_TEST' && <SubjectSelector />}
              
              {/* WEEKLY TEST CREATION UI */}
              {activeTab === 'CONTENT_TEST' && (
                  <div className="space-y-6 bg-gradient-to-br from-orange-50 to-red-50 p-6 rounded-2xl border border-orange-200">
                      {/* Test Metadata */}
                      <div className="space-y-3">
                          <input type="text" placeholder="Test Name" value={testName} onChange={e => setTestName(e.target.value)} className="w-full p-3 border border-orange-200 rounded-xl font-bold text-lg" />
                          <textarea placeholder="Test Description" value={testDesc} onChange={e => setTestDesc(e.target.value)} className="w-full p-3 border border-orange-200 rounded-xl h-20" />
                          <div className="grid grid-cols-3 gap-3">
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Class</label>
                                  <select value={testClassLevel} onChange={e => setTestClassLevel(e.target.value as ClassLevel)} className="w-full p-2 border border-orange-200 rounded-lg font-bold">
                                      {['6','7','8','9','10','11','12'].map(c => <option key={c} value={c}>Class {c}</option>)}
                                  </select>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Duration (mins)</label>
                                  <input type="number" value={testDuration} onChange={e => setTestDuration(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg font-bold" min="30" max="300" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-orange-600 uppercase block mb-1">Pass Score %</label>
                                  <input type="number" value={testPassScore} onChange={e => setTestPassScore(Number(e.target.value))} className="w-full p-2 border border-orange-200 rounded-lg font-bold" min="0" max="100" />
                              </div>
                          </div>
                      </div>

                      {/* Subject & Chapter Selection (Enhanced) */}
                      <div className="border-t border-orange-200 pt-4">
                          <p className="font-bold text-orange-700 mb-3">📚 Select Content (Multi-Subject)</p>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                              {getSubjectsList(testClassLevel, null).map(s => {
                                  const isSel = testSelectedSubjects.includes(s.id);
                                  return (
                                      <div key={s.id} className={`p-2 rounded-lg border flex flex-col ${isSel ? 'bg-orange-50 border-orange-300' : 'bg-white border-slate-200'}`}>
                                          <button onClick={() => setTestSelectedSubjects(isSel ? testSelectedSubjects.filter(x => x !== s.id) : [...testSelectedSubjects, s.id])} className="flex items-center gap-2 font-bold text-xs text-slate-800 w-full mb-1">
                                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSel ? 'bg-orange-600 border-orange-600 text-white' : 'bg-white border-slate-300'}`}>
                                                  {isSel && <CheckCircle size={10} />}
                                              </div>
                                              {s.name}
                                          </button>
                                          
                                          {/* Load Chapters Button */}
                                          {isSel && (
                                              <button 
                                                  onClick={async () => {
                                                      const ch = await fetchChapters(localSettings.allowedBoards?.[0] || 'CBSE', testClassLevel, 'Science', s, 'English');
                                                      // This is a simplified way to just "show" chapters for selection. 
                                                      // In a real app, we'd store these chapters in a map keyed by subjectId.
                                                      // For this prototype, we'll prompt the user or use a simple modal (simulated).
                                                      const selectedChs = window.prompt(`Enter Chapter IDs for ${s.name} (comma separated) or leave blank for ALL:\n\nAvailable:\n${ch.map((c,i) => `${i+1}. ${c.title}`).join('\n')}`);
                                                      if (selectedChs) {
                                                          const indexes = selectedChs.split(',').map(x => parseInt(x.trim()) - 1);
                                                          const ids = indexes.map(i => ch[i]?.id).filter(Boolean);
                                                          setTestSelectedChapters(prev => [...prev, ...ids]);
                                                          alert(`Added ${ids.length} chapters from ${s.name}`);
                                                      }
                                                  }}
                                                  className="text-[9px] text-blue-600 underline text-left pl-6"
                                              >
                                                  Select Specific Chapters
                                              </button>
                                          )}
                                      </div>
                                  );
                              })}
                          </div>
                          {testSelectedChapters.length > 0 && <p className="text-xs text-green-600 font-bold mb-2">✅ {testSelectedChapters.length} specific chapters selected across subjects.</p>}
                      </div>

                      {/* Questions Section */}
                      <div className="border-t border-orange-200 pt-4">
                          {/* GOOGLE SHEETS IMPORT FOR WEEKLY TEST */}
                          <div className="bg-gradient-to-r from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200 shadow-sm mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-orange-100 p-2 rounded text-orange-700">
                                      <Database size={18} />
                                  </div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">Bulk Import Questions (Google Sheets)</h4>
                                      <p className="text-[10px] text-slate-500">Copy cells from Excel/Sheets and paste below</p>
                                  </div>
                              </div>

                              <div className="bg-white/50 p-2 rounded-lg text-[10px] text-slate-600 mb-2 border border-orange-100 font-mono">
                                  <strong>Supported Formats:</strong><br/>
                                  1. Copy from Excel (7 Columns): Q | Opt A | Opt B | Opt C | Opt D | Ans(1-4) | Exp<br/>
                                  2. Vertical List: Q \n 4 Options \n Answer \n Explanation (Multi-line). <br/>
                                  *Note: For multi-line explanation, ensure next Question starts with "1.", "2." etc.
                              </div>

                              <textarea 
                                  value={importText} 
                                  onChange={e => setImportText(e.target.value)}
                                  placeholder={`Example:
What is 2+2?    3       4       5       6       2       The answer is 4
Capital of India?       Mumbai  Delhi   Kolkata Chennai 2       Delhi is the capital`}
                                  className="w-full h-24 p-2 border border-orange-200 rounded-lg text-xs font-mono focus:ring-2 focus:ring-orange-500 outline-none mb-2"
                              />
                              
                              <div className="flex gap-2">
                                  <button 
                                      onClick={() => setImportText('')} 
                                      className="flex-1 bg-white border border-orange-200 text-slate-600 py-2 rounded-lg font-bold text-xs hover:bg-orange-50"
                                  >
                                      Clear
                                  </button>
                                  <button 
                                      onClick={() => handleGoogleSheetImport(true)} 
                                      className="flex-[2] bg-orange-600 hover:bg-orange-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow"
                                  >
                                      <Upload size={14} /> Import to Test
                                  </button>
                              </div>
                          </div>

                          <div className="flex justify-between items-center mb-3">
                              <p className="font-bold text-orange-700">📝 Questions ({editingTestMcqs.length})</p>
                              <button onClick={() => addMcq(true)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700">+ Add Question</button>
                          </div>
                          <div className="space-y-3 max-h-[40vh] overflow-y-auto bg-white p-3 rounded-lg border border-orange-200">
                              {editingTestMcqs.map((q, idx) => (
                                  <div key={idx} className="p-3 bg-orange-50 border border-orange-100 rounded-lg">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="font-bold text-orange-700">Q{idx+1}</span>
                                          <button onClick={() => removeMcq(true, idx)} className="text-red-500 hover:text-red-700"><Trash2 size={14} /></button>
                                      </div>
                                      <p className="text-sm font-medium text-slate-700 truncate">{q.question}</p>
                                      <p className="text-xs text-slate-500 mt-1">A) {q.options[q.correctAnswer]}</p>
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Save Button */}
                      <button onClick={handleSaveWeeklyTest} className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white font-black py-4 rounded-xl shadow-lg hover:shadow-xl text-lg">
                          ✅ Create Weekly Test ({editingTestMcqs.length} Questions)
                      </button>

                      {/* Existing Tests */}
                      {localSettings.weeklyTests && localSettings.weeklyTests.length > 0 && (
                          <div className="border-t border-orange-200 pt-4">
                              <p className="font-bold text-orange-700 mb-3">✅ Active Tests</p>
                              <div className="space-y-2 max-h-[30vh] overflow-y-auto">
                                  {localSettings.weeklyTests.map(t => (
                                      <div key={t.id} className="bg-white p-3 rounded-lg border border-green-200 flex justify-between items-center">
                                          <div>
                                              <p className="font-bold text-slate-800">{t.name}</p>
                                              <p className="text-xs text-slate-500">Class {t.classLevel} • {t.totalQuestions} Qs • {t.durationMinutes}min</p>
                                          </div>
                                          <button onClick={() => {const updated = localSettings.weeklyTests!.filter(x => x.id !== t.id); setLocalSettings({...localSettings, weeklyTests: updated});}} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>
              )}

              {/* LIST VIEW (for PDF/VIDEO/MCQ) */}
              {selSubject && !editingChapterId && activeTab !== 'CONTENT_TEST' && (
                  <div className="grid gap-2 max-h-[60vh] overflow-y-auto">
                      {selChapters.map((ch) => (
                          <div key={ch.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                              <span className="font-bold text-slate-700 text-sm">{ch.title}</span>
                              <button onClick={() => loadChapterContent(ch.id)} className="px-4 py-2 bg-blue-100 text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-200">
                                  {activeTab === 'CONTENT_PDF' ? 'Edit Links' : activeTab === 'CONTENT_VIDEO' ? 'Manage Videos' : 'Manage Questions'}
                              </button>
                          </div>
                      ))}
                  </div>
              )}

              {/* EDITOR VIEW (for PDF/VIDEO/MCQ) */}
              {editingChapterId && activeTab !== 'CONTENT_TEST' && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 animate-in slide-in-from-right">
                      <div className="flex justify-between items-center mb-4 border-b border-slate-200 pb-4">
                          <div>
                              <h4 className="font-black text-slate-800 text-lg">{selChapters.find(c => c.id === editingChapterId)?.title}</h4>
                              <p className="text-xs text-slate-500">Editing Content</p>
                          </div>
                          <button onClick={() => setEditingChapterId(null)} className="text-xs font-bold text-slate-400 hover:text-slate-600">Close Editor</button>
                      </div>
                      
                      {isContentLoading ? (
                          <div className="flex items-center justify-center h-40">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-800"></div>
                          </div>
                      ) : (
                      <>
                      {/* PDF EDITOR */}
                      {activeTab === 'CONTENT_PDF' && (
                          <div className="space-y-6">
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Free PDF Link</label>
                                  <div className="flex items-center bg-white border rounded-xl overflow-hidden">
                                      <div className="bg-slate-100 p-3"><Link size={16} className="text-slate-400" /></div>
                                      <input type="text" value={editConfig.freeLink || ''} onChange={e => setEditConfig({...editConfig, freeLink: e.target.value})} className="flex-1 p-3 outline-none text-sm" placeholder="https://drive.google.com..." />
                                  </div>
                              </div>
                              <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Premium PDF Link</label>
                                  <div className="flex items-center bg-white border rounded-xl overflow-hidden">
                                      <div className="bg-slate-100 p-3"><Link size={16} className="text-purple-400" /></div>
                                      <input type="text" value={editConfig.premiumLink || ''} onChange={e => setEditConfig({...editConfig, premiumLink: e.target.value})} className="flex-1 p-3 outline-none text-sm" placeholder="https://..." />
                                  </div>
                              </div>
                               <div>
                                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Ultra PDF Link</label>
                                  <div className="flex items-center bg-white border rounded-xl overflow-hidden border-indigo-200">
                                      <div className="bg-indigo-50 p-3"><Link size={16} className="text-indigo-400" /></div>
                                      <input type="text" value={editConfig.ultraPdfLink || ''} onChange={e => setEditConfig({...editConfig, ultraPdfLink: e.target.value})} className="flex-1 p-3 outline-none text-sm" placeholder="https://..." />
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1">Cost: 10 Coins (Default) or set Custom Price below</p>
                                  <input type="number" value={editConfig.ultraPdfPrice || 10} onChange={e => setEditConfig({...editConfig, ultraPdfPrice: Number(e.target.value)})} className="w-20 p-2 border rounded mt-1 text-xs" />
                               </div>

                               {/* WATERMARK DESIGNER */}
                               <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-white space-y-6">
                                  <div className="flex items-center gap-2 mb-2">
                                      <PenTool className="text-purple-400" size={20} />
                                      <h4 className="font-bold text-lg">Watermark Designer</h4>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      {/* CONTROLS */}
                                      <div className="space-y-4">
                                          <div>
                                              <label className="text-[10px] font-bold text-slate-400 uppercase">Text</label>
                                              <input 
                                                  type="text" 
                                                  value={editConfig.watermarkConfig?.text || editConfig.watermarkText || ''} 
                                                  onChange={e => {
                                                      const newText = e.target.value;
                                                      // Sync legacy field for compatibility
                                                      const newConfig = { 
                                                          ...(editConfig.watermarkConfig || { opacity: 0.3, color: '#000000', backgroundColor: 'transparent', fontSize: 20, isRepeating: true, positionX: 50, positionY: 50, rotation: -45 }), 
                                                          text: newText 
                                                      };
                                                      setEditConfig({...editConfig, watermarkText: newText, watermarkConfig: newConfig});
                                                  }}
                                                  className="w-full p-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white font-mono"
                                                  placeholder="Watermark Text" 
                                              />
                                          </div>

                                          <div className="flex gap-2">
                                              <button 
                                                  onClick={() => setEditConfig({
                                                      ...editConfig, 
                                                      watermarkConfig: { ...editConfig.watermarkConfig!, isRepeating: true }
                                                  })}
                                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${editConfig.watermarkConfig?.isRepeating !== false ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                              >
                                                  🔁 Repeat (All Over)
                                              </button>
                                              <button 
                                                  onClick={() => setEditConfig({
                                                      ...editConfig, 
                                                      watermarkConfig: { ...editConfig.watermarkConfig!, isRepeating: false, opacity: 1, backgroundColor: '#000000', color: '#ffffff', rotation: 0 }
                                                  })}
                                                  className={`flex-1 py-2 text-xs font-bold rounded-lg border ${editConfig.watermarkConfig?.isRepeating === false ? 'bg-purple-600 border-purple-500' : 'bg-slate-900 border-slate-600 text-slate-400'}`}
                                              >
                                                  🎯 Fixed (Redact)
                                              </button>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Opacity ({((editConfig.watermarkConfig?.opacity || 0.3)*100).toFixed(0)}%)</label>
                                                  <input 
                                                      type="range" min="0" max="1" step="0.1" 
                                                      value={editConfig.watermarkConfig?.opacity ?? 0.3} 
                                                      onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, opacity: parseFloat(e.target.value)}})}
                                                      className="w-full accent-purple-500"
                                                  />
                                              </div>
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Size ({editConfig.watermarkConfig?.fontSize ?? 20}px)</label>
                                                  <input 
                                                      type="range" min="10" max="100" step="2" 
                                                      value={editConfig.watermarkConfig?.fontSize ?? 20} 
                                                      onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, fontSize: parseInt(e.target.value)}})}
                                                      className="w-full accent-purple-500"
                                                  />
                                              </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Text Color</label>
                                                  <input type="color" value={editConfig.watermarkConfig?.color || '#000000'} onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, color: e.target.value}})} className="w-full h-8 rounded bg-transparent border border-slate-600" />
                                              </div>
                                              <div>
                                                  <label className="text-[10px] font-bold text-slate-400 uppercase">Background</label>
                                                  <div className="flex gap-2">
                                                       <input type="color" value={editConfig.watermarkConfig?.backgroundColor === 'transparent' ? '#000000' : editConfig.watermarkConfig?.backgroundColor} onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, backgroundColor: e.target.value}})} className="w-8 h-8 rounded bg-transparent border border-slate-600" />
                                                       <button onClick={() => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, backgroundColor: 'transparent'}})} className="text-[10px] bg-slate-700 px-2 rounded text-slate-300">None</button>
                                                  </div>
                                              </div>
                                          </div>

                                          {/* POSITIONING CONTROLS (Only for Fixed) */}
                                          {editConfig.watermarkConfig?.isRepeating === false && (
                                              <div className="bg-slate-900 p-3 rounded-lg border border-slate-600">
                                                  <p className="text-[10px] font-bold text-purple-400 uppercase mb-2">Positioning (Use Sliders)</p>
                                                  <div className="space-y-2">
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-xs text-slate-400 w-4">X</span>
                                                          <input 
                                                              type="range" min="0" max="100" 
                                                              value={editConfig.watermarkConfig?.positionX ?? 50} 
                                                              onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, positionX: parseInt(e.target.value)}})}
                                                              className="flex-1 accent-blue-500"
                                                          />
                                                          <span className="text-xs text-slate-400 w-8">{editConfig.watermarkConfig?.positionX}%</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-xs text-slate-400 w-4">Y</span>
                                                          <input 
                                                              type="range" min="0" max="100" 
                                                              value={editConfig.watermarkConfig?.positionY ?? 50} 
                                                              onChange={e => setEditConfig({...editConfig, watermarkConfig: {...editConfig.watermarkConfig!, positionY: parseInt(e.target.value)}})}
                                                              className="flex-1 accent-blue-500"
                                                          />
                                                          <span className="text-xs text-slate-400 w-8">{editConfig.watermarkConfig?.positionY}%</span>
                                                      </div>
                                                  </div>
                                              </div>
                                          )}
                                      </div>

                                      {/* LIVE PREVIEW BOX */}
                                      <div className="relative bg-slate-900 border-2 border-slate-600 rounded-xl overflow-hidden aspect-[9/16] shadow-inner flex items-center justify-center">
                                          <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
                                              <FileText size={64} className="text-slate-500" />
                                              <span className="absolute mt-20 text-slate-500 font-bold">PDF PREVIEW</span>
                                          </div>
                                          
                                          {editConfig.watermarkConfig?.isRepeating !== false ? (
                                              /* REPEATING PREVIEW */
                                              <div className="w-full h-full flex flex-col items-center justify-center gap-12 overflow-hidden opacity-100">
                                                  {Array.from({length: 6}).map((_, i) => (
                                                      <div key={i} style={{ transform: `rotate(${editConfig.watermarkConfig?.rotation ?? -45}deg)` }}>
                                                          <span style={{
                                                              color: editConfig.watermarkConfig?.color || '#000000',
                                                              backgroundColor: editConfig.watermarkConfig?.backgroundColor || 'transparent',
                                                              opacity: editConfig.watermarkConfig?.opacity ?? 0.3,
                                                              fontSize: `${(editConfig.watermarkConfig?.fontSize ?? 20) / 2}px`, // Scaled down for preview
                                                              padding: '4px 12px',
                                                              fontWeight: '900',
                                                              textTransform: 'uppercase'
                                                          }}>
                                                              {editConfig.watermarkConfig?.text || 'WATERMARK'}
                                                          </span>
                                                      </div>
                                                  ))}
                                              </div>
                                          ) : (
                                              /* FIXED POSITION PREVIEW */
                                              <div 
                                                  className="absolute px-4 py-2 font-black uppercase tracking-widest shadow-xl whitespace-nowrap"
                                                  style={{
                                                      left: `${editConfig.watermarkConfig?.positionX ?? 50}%`,
                                                      top: `${editConfig.watermarkConfig?.positionY ?? 50}%`,
                                                      transform: 'translate(-50%, -50%)',
                                                      color: editConfig.watermarkConfig?.color || '#ffffff',
                                                      backgroundColor: editConfig.watermarkConfig?.backgroundColor || '#000000',
                                                      opacity: editConfig.watermarkConfig?.opacity ?? 1,
                                                      fontSize: `${(editConfig.watermarkConfig?.fontSize ?? 20) / 1.5}px` // Scaled
                                                  }}
                                              >
                                                  {editConfig.watermarkConfig?.text || 'REDACTED'}
                                              </div>
                                          )}
                                      </div>
                                  </div>
                               </div>

                              <button onClick={saveChapterContent} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow hover:bg-blue-700">Save PDF Links & Watermark</button>
                          </div>
                      )}

                      {/* VIDEO EDITOR (10 FIXED SLOTS) */}
                      {activeTab === 'CONTENT_VIDEO' && (
                          <div className="space-y-6 bg-gradient-to-br from-rose-50 to-pink-50 p-6 rounded-xl border border-rose-200">
                              <div className="flex items-center gap-2 mb-3">
                                  <Video size={20} className="text-rose-600" />
                                  <h4 className="font-bold text-rose-900">Video Playlist Manager (10 Slots)</h4>
                              </div>
                              
                              <p className="text-xs text-rose-700 mb-4 bg-white p-2 rounded border border-rose-100">
                                  Enter YouTube or Google Drive links. Set Price to 0 for Free videos.
                              </p>

                              <div className="space-y-3">
                                  {Array.from({length: 10}).map((_, i) => {
                                      // Ensure valid object structure with optional price defaulting
                                      const existing = videoPlaylist[i];
                                      const vid = existing && typeof existing === 'object' ? existing : {title: '', url: '', price: 5};
                                      
                                      return (
                                          <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-rose-100">
                                              <span className="w-20 text-center text-xs font-bold text-rose-500 bg-rose-50 rounded py-2">Video {i + 1}</span>
                                              
                                              <input 
                                                  type="text" 
                                                  value={vid.url || ''} 
                                                  onChange={(e) => {
                                                      const updated = [...videoPlaylist];
                                                      while(updated.length <= i) updated.push({title:'', url:'', price:5});
                                                      const current = updated[i] || {title: '', url: '', price: 5};
                                                      updated[i] = {...current, url: e.target.value};
                                                      setVideoPlaylist(updated);
                                                  }}
                                                  placeholder="https://youtu.be/..."
                                                  className="flex-[2] p-2 border border-slate-200 rounded text-xs font-mono text-blue-600" 
                                              />
                                              
                                              <div className="w-20">
                                                  <input 
                                                      type="number" 
                                                      value={vid.price !== undefined ? vid.price : 5} 
                                                      onChange={(e) => {
                                                          const updated = [...videoPlaylist];
                                                          while(updated.length <= i) updated.push({title:'', url:'', price:5});
                                                          const current = updated[i] || {title: '', url: '', price: 5};
                                                          updated[i] = {...current, price: Number(e.target.value)};
                                                          setVideoPlaylist(updated);
                                                      }}
                                                      className="w-full p-2 border border-slate-200 rounded text-xs text-center font-bold" 
                                                      placeholder="Price"
                                                  />
                                              </div>
                                          </div>
                                      );
                                  })}
                              </div>

                              <button onClick={saveChapterContent} className="w-full bg-rose-600 text-white font-bold py-3 rounded-xl shadow hover:bg-rose-700 transition">💾 Save Videos</button>
                          </div>
                      )}

                      {/* MCQ / TEST EDITOR */}
                      {(activeTab === 'CONTENT_MCQ' || activeTab === 'CONTENT_TEST') && (
                          <div className="space-y-4">
                              {/* GOOGLE SHEETS IMPORT */}
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200 shadow-sm">
                                  <div className="flex items-center gap-2 mb-3">
                                      <div className="bg-green-100 p-2 rounded text-green-700">
                                          <Database size={18} />
                                      </div>
                                      <div>
                                          <h4 className="font-bold text-slate-800 text-sm">Bulk Import from Google Sheets</h4>
                                          <p className="text-[10px] text-slate-500">Copy cells from Excel/Sheets and paste below</p>
                                      </div>
                                  </div>

                                  <div className="bg-slate-50 p-2 rounded-lg text-[10px] text-slate-600 mb-2 border border-slate-200 font-mono">
                                      <strong>Supported Formats:</strong><br/>
                                      1. Copy from Excel (7 Columns): Q | Opt A | Opt B | Opt C | Opt D | Ans(1-4) | Exp<br/>
                                      2. Vertical List: Q \n 4 Options \n Answer \n Explanation (Multi-line). <br/>
                                      *Note: For multi-line explanation, ensure next Question starts with "1.", "2." etc.
                                  </div>

                                  <textarea 
                                      value={importText} 
                                      onChange={e => setImportText(e.target.value)}
                                      placeholder={`Example:
What is 2+2?    3       4       5       6       2       The answer is 4
Capital of India?       Mumbai  Delhi   Kolkata Chennai 2       Delhi is the capital`}
                                      className="w-full h-24 p-2 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-green-500 outline-none mb-2"
                                  />
                                  
                                  <div className="flex gap-2">
                                      <button 
                                          onClick={() => setImportText('')} 
                                          className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-lg font-bold text-xs hover:bg-slate-200"
                                      >
                                          Clear
                                      </button>
                                      <button 
                                          onClick={() => handleGoogleSheetImport(activeTab === 'CONTENT_TEST')} 
                                          className="flex-[2] bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-2 shadow"
                                      >
                                          <Upload size={14} /> Import & Add
                                      </button>
                                  </div>
                              </div>

                          {/* AI GENERATOR */}
                          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-xl border border-purple-200 shadow-sm mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                  <div className="bg-purple-100 p-2 rounded text-purple-700"><Sparkles size={18} /></div>
                                  <div>
                                      <h4 className="font-bold text-slate-800 text-sm">AI Question Generator</h4>
                                      <p className="text-[10px] text-slate-500">Generate high-quality questions automatically</p>
                                  </div>
                              </div>
                              <button 
                                  onClick={async () => {
                                      if (!selSubject) { alert("Please select a subject first."); return; }
                                      const count = prompt("How many questions?", "10");
                                      if (!count) return;
                                      const instructions = prompt("Any specific instructions? (e.g. 'Hard level', 'Focus on formulas')", "");
                                      
                                      // Temporarily override instruction in local storage if needed, or pass it
                                      // Since fetchLessonContent reads from localStorage settings, we can prepend to prompt logic there, 
                                      // BUT fetchLessonContent is hardcoded to read 'aiInstruction'.
                                      // A better way is to pass it.
                                      // I will update fetchLessonContent to accept an override or just rely on 'aiInstruction' settings.
                                      // However, to keep it simple without changing gemini.ts signature too much (it has many params), 
                                      // I'll assume standard generation or use a clever trick:
                                      // We will call fetchLessonContent but we need to pass the "chapter" context.
                                      
                                      const targetChapter = activeTab === 'CONTENT_TEST' 
                                          ? { id: 'test-gen', title: testName || 'General Test', description: '' } 
                                          : selChapters.find(c => c.id === editingChapterId) || { id: 'gen', title: 'General', description: '' };

                                      if (activeTab === 'CONTENT_TEST' && !testName) {
                                          if(!confirm("No Test Name set. AI will generate general questions. Continue?")) return;
                                      }

                                      setIsContentLoading(true);
                                      try {
                                          // We use a Hack: Temporarily set the AI Instruction in settings, then restore it?
                                          // Or we update gemini.ts. 
                                          // Let's rely on the existing fetchLessonContent which handles MCQ generation.
                                          // It requires: board, classLevel, stream, subject, chapter, language, type...
                                          
                                          // Inject instruction into title/subtitle if possible? No.
                                          // I will just rely on the standard prompt for now, or update gemini.ts in next step if needed.
                                          // Wait, I can update gemini.ts to accept 'promptOverride'.
                                          // For now, let's try standard generation.
                                          
                                          const content = await fetchLessonContent(
                                              selBoard, selClass, selStream, selSubject, 
                                              targetChapter, 
                                              'English', 
                                              'MCQ_ANALYSIS', 
                                              0, true, parseInt(count),
                                              instructions || "",
                                              true
                                          );
                                          
                                          if (content.mcqData && content.mcqData.length > 0) {
                                              if (activeTab === 'CONTENT_TEST') {
                                                  setEditingTestMcqs(prev => [...prev, ...content.mcqData!]);
                                              } else {
                                                  setEditingMcqs(prev => [...prev, ...content.mcqData!]);
                                              }
                                              alert(`✅ Generated ${content.mcqData.length} Questions!`);
                                          } else {
                                              alert("AI could not generate questions. Please try again.");
                                          }
                                      } catch (e: any) {
                                          alert("AI Error: " + e.message);
                                      }
                                      setIsContentLoading(false);
                                  }}
                                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-bold text-xs shadow-lg flex items-center justify-center gap-2"
                              >
                                  <BrainCircuit size={16} /> Generate with AI
                              </button>
                          </div>

                              <div className="flex justify-between items-center mb-2">
                                  <span className="font-bold text-slate-700">Total Questions: {(activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs).length}</span>
                                  <div className="flex gap-2">
                                      <button onClick={() => deleteAllMcqs(activeTab === 'CONTENT_TEST')} className="bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors">Delete All</button>
                                      <button onClick={() => addMcq(activeTab === 'CONTENT_TEST')} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">+ Add Question</button>
                                  <button 
                                      onClick={() => {
                                          const list = activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs;
                                          if (list.length === 0) { alert("No questions to copy!"); return; }
                                          
                                          // Format: Question \t OptA \t OptB \t OptC \t OptD \t AnswerIndex(1-4) \t Explanation
                                          const text = list.map(q => {
                                              return `${q.question}\t${q.options[0]}\t${q.options[1]}\t${q.options[2]}\t${q.options[3]}\t${q.correctAnswer + 1}\t${q.explanation || ''}`;
                                          }).join('\n');
                                          
                                          navigator.clipboard.writeText(text);
                                          alert(`✅ Copied ${list.length} questions to clipboard!\n\nPaste directly into Google Sheets or Excel.`);
                                      }}
                                      className="bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 flex items-center gap-1"
                                  >
                                      <Copy size={14} /> Copy for Sheets
                                  </button>
                                  <button onClick={() => addMcq(activeTab === 'CONTENT_TEST')} className="bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-50">+ Add Question</button>
                                      <button onClick={saveChapterContent} className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-blue-700">Save All</button>
                                  </div>
                              </div>
                              
                              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 pb-10">
                                  {(activeTab === 'CONTENT_TEST' ? editingTestMcqs : editingMcqs).map((q, idx) => (
                                      <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative group">
                                          <button onClick={() => removeMcq(activeTab === 'CONTENT_TEST', idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                          <div className="flex gap-2 mb-2">
                                              <span className="bg-slate-100 text-slate-500 font-bold w-6 h-6 flex items-center justify-center rounded text-xs mt-1">{idx + 1}</span>
                                              <textarea 
                                                  value={q.question} 
                                                  onChange={e => updateMcq(activeTab === 'CONTENT_TEST', idx, 'question', e.target.value)} 
                                                  className="flex-1 p-2 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none resize-none" 
                                                  rows={2} 
                                                  placeholder="Type question here..." 
                                              />
                                          </div>
                                          <div className="grid grid-cols-2 gap-3 ml-8">
                                              {q.options.map((opt, oIdx) => (
                                                  <div key={oIdx} className="flex items-center gap-2">
                                                      <input 
                                                          type="radio" 
                                                          name={`q-${activeTab}-${idx}`} 
                                                          checked={q.correctAnswer === oIdx} 
                                                          onChange={() => updateMcq(activeTab === 'CONTENT_TEST', idx, 'correctAnswer', oIdx)}
                                                          className="accent-green-600"
                                                      />
                                                      <input 
                                                          type="text" 
                                                          value={opt} 
                                                          onChange={e => updateMcqOption(activeTab === 'CONTENT_TEST', idx, oIdx, e.target.value)}
                                                          className={`w-full p-1.5 border rounded text-xs ${q.correctAnswer === oIdx ? 'border-green-300 bg-green-50 text-green-800 font-bold' : 'border-slate-200'}`}
                                                          placeholder={`Option ${String.fromCharCode(65+oIdx)}`}
                                                      />
                                                  </div>
                                              ))}
                                          </div>
                                          <div className="ml-8 mt-2">
                                              <input 
                                                  type="text" 
                                                  value={q.explanation} 
                                                  onChange={e => updateMcq(activeTab === 'CONTENT_TEST', idx, 'explanation', e.target.value)}
                                                  className="w-full p-2 border border-dashed border-slate-300 rounded text-xs text-slate-600 bg-slate-50"
                                                  placeholder="Explanation (Optional)"
                                              />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                      </>
                      )}
                  </div>
              )}
          </div>
      )}

      {/* 4. SETTINGS TABS */}
      {activeTab.startsWith('CONFIG_') && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Settings: {activeTab.replace('CONFIG_', '')}</h3>
              </div>
              <div className="max-w-2xl space-y-6">
                  {/* GENERAL */}
                  {activeTab === 'CONFIG_GENERAL' && (
                      <>
                          {/* LOGO UPLOAD */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4">
                              <label className="text-xs font-bold uppercase text-slate-500 block mb-2">App Logo</label>
                              <div className="flex items-center gap-4">
                                  <div className="w-20 h-20 bg-white rounded-full border border-slate-300 flex items-center justify-center overflow-hidden">
                                      {localSettings.appLogo ? (
                                          <img src={localSettings.appLogo} alt="Logo" className="w-full h-full object-contain" />
                                      ) : (
                                          <span className="text-xs text-slate-400 font-bold">{localSettings.appShortName || 'IIC'}</span>
                                      )}
                                  </div>
                                  <div className="flex-1">
                                      <input 
                                          type="file" 
                                          accept="image/*"
                                          onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) {
                                                  // Check size (e.g., max 2MB before crop)
                                                  if (file.size > 2 * 1024 * 1024) {
                                                      alert("Image too large! Please select an image under 2MB.");
                                                      return;
                                                  }
                                                  const reader = new FileReader();
                                                  reader.onloadend = () => {
                                                      setCropImageSrc(reader.result as string);
                                                  };
                                                  reader.readAsDataURL(file);
                                              }
                                          }}
                                          className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                      />
                                      <p className="text-[10px] text-slate-400 mt-1">Recommended: Square PNG/JPG</p>
                                  </div>
                                  {localSettings.appLogo && (
                                      <button 
                                          onClick={() => setLocalSettings({...localSettings, appLogo: undefined})}
                                          className="text-red-500 hover:text-red-700 p-2"
                                          title="Remove Logo"
                                      >
                                          <Trash2 size={20} />
                                      </button>
                                  )}
                              </div>
                          </div>

                          <div><label className="text-xs font-bold uppercase text-slate-500">App Name (Long)</label><input type="text" value={localSettings.appName} onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IDEAL INSPIRATION CLASSES" /></div>
                          <div className="grid grid-cols-2 gap-3">
                              <div><label className="text-xs font-bold uppercase text-slate-500">App Short Name</label><input type="text" value={localSettings.appShortName || 'IIC'} onChange={e => setLocalSettings({...localSettings, appShortName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IIC" /></div>
                              <div><label className="text-xs font-bold uppercase text-slate-500">AI Assistant Name</label><input type="text" value={localSettings.aiName || 'IIC AI'} onChange={e => setLocalSettings({...localSettings, aiName: e.target.value})} className="w-full p-3 border rounded-xl" placeholder="IIC AI" /></div>
                          </div>
                          
                          {/* CHAT MODE SELECTOR */}
                          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200">
                              <label className="text-xs font-bold uppercase text-indigo-800 mb-2 block">Chat System Mode</label>
                              <div className="grid grid-cols-3 gap-2">
                                  {['PRIVATE_ONLY', 'UNIVERSAL_ONLY', 'BOTH'].map(mode => (
                                      <button 
                                          key={mode} 
                                          onClick={() => setLocalSettings({...localSettings, chatMode: mode as any})}
                                          className={`py-2 rounded-lg text-xs font-bold border transition-all ${localSettings.chatMode === mode ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-indigo-100 hover:bg-indigo-50'}`}
                                      >
                                          {mode.replace('_', ' ')}
                                      </button>
                                  ))}
                              </div>
                          </div>

                          <div><label className="text-xs font-bold uppercase text-slate-500">Login Screen Message</label><input type="text" value={localSettings.loginMessage} onChange={e => setLocalSettings({...localSettings, loginMessage: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          
                          <div>
                              <label className="text-xs font-bold uppercase text-slate-500">Home Screen Notice</label>
                              <textarea 
                                  value={localSettings.noticeText || ''} 
                                  onChange={e => setLocalSettings({...localSettings, noticeText: e.target.value})} 
                                  className="w-full p-3 border rounded-xl h-24"
                                  placeholder="Write a notice for students..." 
                              />
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Support Chat Cost</label>
                                  <input type="number" value={localSettings.chatCost} onChange={e => setLocalSettings({...localSettings, chatCost: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Cooldown (Hours)</label>
                                  <input type="number" value={localSettings.chatCooldownHours || 0} onChange={e => setLocalSettings({...localSettings, chatCooldownHours: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                          </div>
                          
                          {/* NEW: Extra Settings */}
                          <div className="grid grid-cols-2 gap-3 mt-3">
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Name Change Cost</label>
                                  <input type="number" value={localSettings.nameChangeCost ?? 10} onChange={e => setLocalSettings({...localSettings, nameChangeCost: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                              <div>
                                  <label className="text-xs font-bold uppercase text-slate-500">Chat Edit Time (Mins)</label>
                                  <input type="number" value={localSettings.chatEditTimeLimit ?? 15} onChange={e => setLocalSettings({...localSettings, chatEditTimeLimit: Number(e.target.value)})} className="w-full p-3 border rounded-xl" />
                              </div>
                          </div>

                          {/* NEW: POPUP CONTROLS */}
                          <div className="grid grid-cols-2 gap-3 mb-4">
                              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                  <div><p className="font-bold text-slate-700 text-sm">Welcome Popup</p><p className="text-[10px] text-slate-400">Show on startup</p></div>
                                  <input type="checkbox" checked={localSettings.showWelcomePopup !== false} onChange={() => toggleSetting('showWelcomePopup')} className="w-5 h-5 accent-blue-600" />
                              </div>
                              <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200">
                                  <div><p className="font-bold text-slate-700 text-sm">Terms Popup</p><p className="text-[10px] text-slate-400">Show terms agreement</p></div>
                                  <input type="checkbox" checked={localSettings.showTermsPopup !== false} onChange={() => toggleSetting('showTermsPopup')} className="w-5 h-5 accent-blue-600" />
                              </div>
                          </div>

                          <div className="flex items-center justify-between bg-red-50 p-4 rounded-xl border border-red-100">
                              <div><p className="font-bold text-red-800">Maintenance Mode</p><p className="text-xs text-red-600">Lock app for users</p></div>
                              <input type="checkbox" checked={localSettings.maintenanceMode} onChange={() => toggleSetting('maintenanceMode')} className="w-6 h-6 accent-red-600" />
                          </div>
                      </>
                  )}
                  {/* SECURITY */}
                  {activeTab === 'CONFIG_SECURITY' && (
                      <>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Admin Email</label><input type="text" value={localSettings.adminEmail || ''} onChange={e => setLocalSettings({...localSettings, adminEmail: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Admin Login Code</label><input type="text" value={localSettings.adminCode || ''} onChange={e => setLocalSettings({...localSettings, adminCode: e.target.value})} className="w-full p-3 border rounded-xl" /></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">API Keys (Comma Separated)</label><textarea value={localSettings.apiKeys.join(',')} onChange={e => setLocalSettings({...localSettings, apiKeys: e.target.value.split(',')})} className="w-full p-3 border rounded-xl h-32" /></div>
                      
                          {/* FIREBASE MANAGER */}
                          <div className="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
                              <h4 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                                  <Database size={18} /> Switch Database Connection
                              </h4>
                              <p className="text-xs text-orange-700 mb-4">
                                  Paste your new Firebase Configuration JSON here to switch the app's backend. 
                                  Useful for white-labeling or migrating data.
                              </p>
                              <textarea 
                                  value={customFirebaseJson} 
                                  onChange={e => setCustomFirebaseJson(e.target.value)} 
                                  className="w-full p-3 border border-orange-200 rounded-xl h-32 font-mono text-xs mb-3"
                                  placeholder='{ "apiKey": "...", "authDomain": "...", ... }'
                              />
                              <div className="flex gap-2">
                                  <button onClick={handleSaveFirebaseConfig} className="flex-1 bg-orange-600 text-white font-bold py-2 rounded-lg hover:bg-orange-700">
                                      Connect New Database
                                  </button>
                                  <button onClick={handleResetFirebase} className="px-4 py-2 bg-slate-200 text-slate-600 font-bold rounded-lg hover:bg-slate-300">
                                      Reset Default
                                  </button>
                              </div>
                          </div>
                      </>
                  )}
                  {/* VISIBILITY */}
                  {activeTab === 'CONFIG_VISIBILITY' && (
                      <div className="space-y-4">
                          <div>
                              <p className="font-bold text-slate-700 mb-2">Allowed Classes</p>
                              <div className="flex flex-wrap gap-2">
                                  {['6','7','8','9','10','11','12'].map(c => (
                                      <button key={c} onClick={() => setLocalSettings({...localSettings, allowedClasses: toggleItemInList(localSettings.allowedClasses, c as any)})} className={`px-4 py-2 rounded-lg border font-bold ${localSettings.allowedClasses?.includes(c as any) ? 'bg-blue-600 text-white' : 'bg-white'}`}>{c}</button>
                                  ))}
                              </div>
                          </div>
                      </div>
                  )}
                  {/* AI & ADS & PAYMENT */}
                  {activeTab === 'CONFIG_AI' && (
                       <>
                          <div><label className="text-xs font-bold uppercase text-slate-500">AI Model</label><select value={localSettings.aiModel} onChange={e => setLocalSettings({...localSettings, aiModel: e.target.value})} className="w-full p-3 border rounded-xl"><option value="gemini-2.5-flash">Gemini Flash</option><option value="gemini-pro">Gemini Pro</option></select></div>
                          <div><label className="text-xs font-bold uppercase text-slate-500">Custom System Instruction</label><textarea value={localSettings.aiInstruction || ''} onChange={e => setLocalSettings({...localSettings, aiInstruction: e.target.value})} className="w-full p-3 border rounded-xl h-32" placeholder="You are a helpful teacher..." /></div>
                       </>
                  )}
                  {activeTab === 'CONFIG_PAYMENT' && (
                       <>
                          <div className="flex items-center justify-between bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                              <div><p className="font-bold text-emerald-800">Enable Payments</p><p className="text-xs text-emerald-600">Show buy options to students</p></div>
                              <input type="checkbox" checked={localSettings.isPaymentEnabled} onChange={() => toggleSetting('isPaymentEnabled')} className="w-6 h-6 accent-emerald-600" />
                          </div>
                          <p className="text-xs font-bold text-slate-500">💡 Manage admin phones in "General Settings" → Admin Phone Numbers</p>
                          
                          {/* PACKAGE MANAGER */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4">
                              <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><ShoppingBag size={18} /> Store Packages Manager</h4>
                              
                              <div className="grid gap-3 mb-6">
                                  {(!localSettings.packages || localSettings.packages.length === 0) && <p className="text-xs text-slate-400">No packages defined. Default list will be shown to users.</p>}
                                  {localSettings.packages?.map(pkg => (
                                      <div key={pkg.id} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                                          <div>
                                              <p className="font-bold text-sm text-slate-800">{pkg.name}</p>
                                              <p className="text-xs text-slate-500">₹{pkg.price} = {pkg.credits} Credits</p>
                                          </div>
                                          <button onClick={() => removePackage(pkg.id)} className="text-red-400 hover:text-red-600 p-2"><Trash2 size={16} /></button>
                                      </div>
                                  ))}
                              </div>

                              <div className="flex gap-2 items-end">
                                  <div className="flex-1">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Name</label>
                                      <input type="text" placeholder="Pro Pack" value={newPkgName} onChange={e => setNewPkgName(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Price (₹)</label>
                                      <input type="number" placeholder="99" value={newPkgPrice} onChange={e => setNewPkgPrice(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <div className="w-20">
                                      <label className="text-[10px] font-bold uppercase text-slate-400">Credits</label>
                                      <input type="number" placeholder="50" value={newPkgCredits} onChange={e => setNewPkgCredits(e.target.value)} className="w-full p-2 border rounded-lg text-sm" />
                                  </div>
                                  <button onClick={addPackage} className="bg-emerald-600 text-white p-2 rounded-lg h-[38px] w-[38px] flex items-center justify-center hover:bg-emerald-700 shadow"><Plus size={20} /></button>
                              </div>
                          </div>
                       </>
                  )}
                  {activeTab === 'CONFIG_ADS' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                           <div className="flex items-center justify-between mb-4">
                               <span className="font-bold">Startup Popup Ad</span>
                               <input type="checkbox" checked={localSettings.startupAd?.enabled} onChange={() => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, enabled: !localSettings.startupAd?.enabled}})} className="w-5 h-5 accent-blue-600" />
                           </div>
                           <input type="text" value={localSettings.startupAd?.title} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, title: e.target.value}})} className="w-full p-2 border rounded mb-2" placeholder="Ad Title" />
                           <div className="grid grid-cols-2 gap-2">
                               <input type="color" value={localSettings.startupAd?.bgColor} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, bgColor: e.target.value}})} className="w-full h-10 p-1 border rounded" />
                               <input type="color" value={localSettings.startupAd?.textColor} onChange={e => setLocalSettings({...localSettings, startupAd: {...localSettings.startupAd!, textColor: e.target.value}})} className="w-full h-10 p-1 border rounded" />
                           </div>
                       </div>
                  )}
                  {activeTab === 'CONFIG_GAME' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2"><Gamepad2 size={18} /> Spin Wheel Configuration</h4>
                           
                           <div>
                               <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Game Cost (Credits)</label>
                               <input type="number" value={localSettings.gameCost} onChange={e => setLocalSettings({...localSettings, gameCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                               <p className="text-[10px] text-slate-400">Set 0 for free entry within daily limits.</p>
                           </div>

                           <div className="grid grid-cols-3 gap-4 pt-2">
                               <div>
                                   <label className="text-xs font-bold text-purple-600 uppercase block mb-1">Ultra Limit</label>
                                   <input type="number" value={localSettings.spinLimitUltra} onChange={e => setLocalSettings({...localSettings, spinLimitUltra: Number(e.target.value)})} className="w-full p-2 border border-purple-200 bg-purple-50 rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Real Users</p>
                               </div>
                               <div>
                                   <label className="text-xs font-bold text-blue-600 uppercase block mb-1">Basic Limit</label>
                                   <input type="number" value={localSettings.spinLimitBasic} onChange={e => setLocalSettings({...localSettings, spinLimitBasic: Number(e.target.value)})} className="w-full p-2 border border-blue-200 bg-blue-50 rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Real Users</p>
                               </div>
                               <div>
                                   <label className="text-xs font-bold text-slate-600 uppercase block mb-1">Normal/Free</label>
                                   <input type="number" value={localSettings.spinLimitFree} onChange={e => setLocalSettings({...localSettings, spinLimitFree: Number(e.target.value)})} className="w-full p-2 border border-slate-200 bg-white rounded-lg font-bold" />
                                   <p className="text-[9px] text-slate-400">Others</p>
                               </div>
                           </div>
                       </div>
                  )}
                  {activeTab === 'CONFIG_EXTERNAL_APPS' && (
                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2"><Globe size={18} /> Manage External Apps</h4>
                          <p className="text-xs text-slate-500 mb-4">Add up to 4 apps/websites. These will appear in the Student Dashboard.</p>
                          
                          <div className="space-y-3 mb-6">
                              {(localSettings.externalApps || []).map((app, idx) => (
                                  <div key={app.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                                      <div className="flex justify-between items-start">
                                          <span className="font-bold text-sm text-slate-800">{app.name}</span>
                                          <button onClick={() => {
                                              const updated = localSettings.externalApps!.filter((_, i) => i !== idx);
                                              setLocalSettings({...localSettings, externalApps: updated});
                                          }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                      </div>
                                      <p className="text-[10px] text-blue-600 truncate">{app.url}</p>
                                      
                                      <div className="flex gap-2 text-xs items-center">
                                          <label className="flex items-center gap-1 font-bold text-slate-600">
                                              <input 
                                                  type="checkbox" 
                                                  checked={app.isLocked} 
                                                  onChange={e => {
                                                      const updated = [...localSettings.externalApps!];
                                                      updated[idx].isLocked = e.target.checked;
                                                      setLocalSettings({...localSettings, externalApps: updated});
                                                  }} 
                                              /> Lock
                                          </label>
                                          <div className="flex items-center gap-1 ml-auto">
                                              <span className="font-bold text-slate-500">Price:</span>
                                              <input 
                                                  type="number" 
                                                  value={app.creditCost} 
                                                  onChange={e => {
                                                      const updated = [...localSettings.externalApps!];
                                                      updated[idx].creditCost = Number(e.target.value);
                                                      setLocalSettings({...localSettings, externalApps: updated});
                                                  }} 
                                                  className="w-16 p-1 border rounded text-center font-bold"
                                              />
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>

                          {(localSettings.externalApps?.length || 0) < 20 && (
                              <button 
                                  onClick={() => {
                                      const newApp = {
                                          id: `app-${Date.now()}`,
                                          name: 'New App',
                                          url: 'https://google.com',
                                          isLocked: false,
                                          creditCost: 0
                                      };
                                      setLocalSettings({...localSettings, externalApps: [...(localSettings.externalApps || []), newApp]});
                                  }}
                                  className="w-full py-2 bg-indigo-100 text-indigo-700 font-bold rounded-xl border border-indigo-200 hover:bg-indigo-200 dashed"
                              >
                                  + Add App Slot
                              </button>
                          )}
                          
                          {(localSettings.externalApps || []).length > 0 && (
                              <div className="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-100 text-xs text-yellow-800">
                                  <strong>Edit Names/URLs:</strong> You can edit the details directly in the input fields above (Wait, I need to add inputs for name/url editing).
                              </div>
                          )}
                          
                          {/* EDITING INPUTS FOR EACH APP */}
                          {(localSettings.externalApps || []).map((app, idx) => (
                              <div key={`edit-${app.id}`} className="mt-2 bg-white p-2 rounded border border-slate-100">
                                  <div className="grid grid-cols-1 gap-2">
                                      <input 
                                          type="text" 
                                          value={app.name} 
                                          onChange={e => {
                                               const updated = [...localSettings.externalApps!];
                                               updated[idx].name = e.target.value;
                                               setLocalSettings({...localSettings, externalApps: updated});
                                          }} 
                                          className="w-full p-2 border rounded text-xs font-bold" 
                                          placeholder="App Name"
                                      />
                                      <input 
                                          type="text" 
                                          value={app.url} 
                                          onChange={e => {
                                               const updated = [...localSettings.externalApps!];
                                               updated[idx].url = e.target.value;
                                               setLocalSettings({...localSettings, externalApps: updated});
                                          }} 
                                          className="w-full p-2 border rounded text-xs font-mono text-blue-600" 
                                          placeholder="https://..."
                                      />
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  {activeTab === 'CONFIG_REWARDS' && (
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                           <h4 className="font-bold text-slate-800 flex items-center gap-2"><Gift size={18} /> Engagement Rewards (Padhai karo aur rewards jito)</h4>
                           <p className="text-xs text-slate-500">
                               Configure rewards for students based on their daily study time.
                               <br/>Time is tracked when student is online and active.
                           </p>
                           
                           <div className="space-y-4">
                               {localSettings.engagementRewards?.map((reward, idx) => (
                                   <div key={reward.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                       <div className="flex justify-between items-center mb-3">
                                            <div className="flex items-center gap-2">
                                                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                                    {(reward.seconds / 60).toFixed(0)} Mins
                                                </span>
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${reward.type === 'COINS' ? 'bg-yellow-100 text-yellow-700' : 'bg-purple-100 text-purple-700'}`}>
                                                    {reward.type}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <label className="flex items-center gap-1 text-xs font-bold text-slate-600">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={reward.enabled} 
                                                        onChange={e => {
                                                            const updated = [...(localSettings.engagementRewards || [])];
                                                            updated[idx].enabled = e.target.checked;
                                                            setLocalSettings({...localSettings, engagementRewards: updated});
                                                        }}
                                                    /> Active
                                                </label>
                                                <button onClick={() => {
                                                    const updated = localSettings.engagementRewards!.filter((_, i) => i !== idx);
                                                    setLocalSettings({...localSettings, engagementRewards: updated});
                                                }} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                                            </div>
                                       </div>
                                       
                                       <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                           <div>
                                               <label className="text-[10px] font-bold text-slate-400 uppercase">Time (Seconds)</label>
                                               <input 
                                                   type="number" 
                                                   value={reward.seconds} 
                                                   onChange={e => {
                                                       const updated = [...(localSettings.engagementRewards || [])];
                                                       updated[idx].seconds = Number(e.target.value);
                                                       setLocalSettings({...localSettings, engagementRewards: updated});
                                                   }} 
                                                   className="w-full p-2 border rounded-lg text-sm"
                                               />
                                               <p className="text-[9px] text-slate-400 text-right">={(reward.seconds / 60).toFixed(1)} mins</p>
                                           </div>
                                           <div>
                                               <label className="text-[10px] font-bold text-slate-400 uppercase">Display Label</label>
                                               <input 
                                                   type="text" 
                                                   value={reward.label} 
                                                   onChange={e => {
                                                       const updated = [...(localSettings.engagementRewards || [])];
                                                       updated[idx].label = e.target.value;
                                                       setLocalSettings({...localSettings, engagementRewards: updated});
                                                   }} 
                                                   className="w-full p-2 border rounded-lg text-sm"
                                               />
                                           </div>
                                       </div>

                                       <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                           <div className="flex gap-4 mb-2">
                                               <label className="flex items-center gap-1 text-xs">
                                                   <input 
                                                       type="radio" 
                                                       checked={reward.type === 'COINS'} 
                                                       onChange={() => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].type = 'COINS';
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }}
                                                   /> Coins
                                               </label>
                                               <label className="flex items-center gap-1 text-xs">
                                                   <input 
                                                       type="radio" 
                                                       checked={reward.type === 'SUBSCRIPTION'} 
                                                       onChange={() => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].type = 'SUBSCRIPTION';
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }}
                                                   /> Subscription
                                               </label>
                                           </div>

                                           {reward.type === 'COINS' ? (
                                               <div>
                                                   <label className="text-[10px] font-bold text-slate-400 uppercase">Coin Amount</label>
                                                   <input 
                                                       type="number" 
                                                       value={reward.amount || 0} 
                                                       onChange={e => {
                                                           const updated = [...(localSettings.engagementRewards || [])];
                                                           updated[idx].amount = Number(e.target.value);
                                                           setLocalSettings({...localSettings, engagementRewards: updated});
                                                       }} 
                                                       className="w-full p-2 border rounded-lg text-sm"
                                                   />
                                               </div>
                                           ) : (
                                               <div className="grid grid-cols-3 gap-2">
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Tier</label>
                                                       <select 
                                                           value={reward.subTier} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               // @ts-ignore
                                                               updated[idx].subTier = e.target.value;
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-xs"
                                                       >
                                                           <option value="WEEKLY">Weekly</option>
                                                           <option value="MONTHLY">Monthly</option>
                                                           <option value="LIFETIME">Lifetime</option>
                                                       </select>
                                                   </div>
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Level</label>
                                                       <select 
                                                           value={reward.subLevel} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               // @ts-ignore
                                                               updated[idx].subLevel = e.target.value;
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-xs"
                                                       >
                                                           <option value="BASIC">Basic</option>
                                                           <option value="ULTRA">Ultra</option>
                                                       </select>
                                                   </div>
                                                   <div>
                                                       <label className="text-[10px] font-bold text-slate-400 uppercase">Duration (Hrs)</label>
                                                       <input 
                                                           type="number" 
                                                           value={reward.durationHours || 4} 
                                                           onChange={e => {
                                                               const updated = [...(localSettings.engagementRewards || [])];
                                                               updated[idx].durationHours = Number(e.target.value);
                                                               setLocalSettings({...localSettings, engagementRewards: updated});
                                                           }} 
                                                           className="w-full p-2 border rounded-lg text-sm"
                                                       />
                                                   </div>
                                               </div>
                                           )}
                                       </div>
                                   </div>
                               ))}
                               
                               <button 
                                   onClick={() => {
                                       const newReward = {
                                           id: `rew-def-${Date.now()}`,
                                           seconds: 60,
                                           type: 'COINS',
                                           amount: 1,
                                           label: '1 Min Reward',
                                           enabled: true
                                       };
                                       setLocalSettings({
                                           ...localSettings, 
                                           // @ts-ignore
                                           engagementRewards: [...(localSettings.engagementRewards || []), newReward]
                                       });
                                   }}
                                   className="w-full py-3 border-2 border-dashed border-slate-300 text-slate-500 font-bold rounded-xl hover:bg-slate-50 hover:border-slate-400 hover:text-slate-600 transition"
                               >
                                   + Add New Reward Milestone
                               </button>
                           </div>
                       </div>
                  )}
              </div>
              <div className="mt-8 flex gap-2 border-t pt-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="flex-1 py-3 text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200">← Back to Dashboard</button>
                  <button onClick={handleSaveSettings} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl shadow-lg hover:bg-green-700 flex items-center justify-center gap-2"><Save size={16} /> Save Settings</button>
              </div>
          </div>
      )}

      {/* --- DEPLOYMENT TAB (New) --- */}
      {activeTab === 'DEPLOY' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Deployment & Blueprint</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* APP BLUEPRINT */}
                  <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 flex flex-col justify-between">
                      <div>
                          <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
                              <Code2 size={24} />
                          </div>
                          <h4 className="text-xl font-black text-blue-900 mb-2">Download Live Update</h4>
                          <p className="text-sm text-blue-700 leading-relaxed mb-6">
                              This will generate a <strong>New ZIP</strong> containing your latest Admin Changes.
                              <br/><br/>
                              Upload this to Vercel, and students will receive the update automatically next time they open the app.
                          </p>
                      </div>
                      <button onClick={handleDownloadSource} className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2">
                          <Download size={20} /> Download Source (ZIP)
                      </button>
                  </div>

                  {/* DEPLOYMENT GUIDE */}
                  <div className="bg-slate-900 p-6 rounded-3xl border border-slate-700 text-white flex flex-col justify-between">
                      <div>
                          <div className="w-12 h-12 bg-slate-800 text-white rounded-xl flex items-center justify-center mb-4 border border-slate-700">
                              <Rocket size={24} />
                          </div>
                          <h4 className="text-xl font-black text-white mb-2">How to Update?</h4>
                          <ul className="text-sm text-slate-400 space-y-3 mb-6 list-decimal pl-4">
                              <li>Make changes in Admin Panel (Add Chapters/Notices).</li>
                              <li>Click <strong>Download Source</strong> on left.</li>
                              <li>Upload the new ZIP to GitHub/Vercel.</li>
                              <li>Done! All students get updated data instantly.</li>
                          </ul>
                      </div>
                      <div className="text-[10px] bg-slate-800 p-3 rounded-xl border border-slate-700 text-slate-400 text-center">
                          <span className="font-bold text-green-400">SYNC ACTIVE:</span> V3.1 Auto-Sync Enabled.
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* 5. UTILITY TABS */}
      {activeTab === 'DEMAND' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">User Demands</h3></div>
              <div className="space-y-3">
                  {demands.length === 0 && <p className="text-slate-400">No demands yet.</p>}
                  {demands.map((d, i) => (
                      <div key={i} className="p-4 border rounded-xl bg-slate-50 flex justify-between items-start">
                          <div>
                              <p className="font-bold text-slate-800">{d.details}</p>
                              <p className="text-xs text-slate-400 mt-1">{new Date(d.timestamp).toLocaleString()}</p>
                          </div>
                          <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">{d.id}</span>
                      </div>
                  ))}
              </div>
          </div>
      )}
      
      {activeTab === 'ACCESS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Login Requests</h3></div>
              <div className="space-y-3">
                  {recoveryRequests.filter(r => r.status === 'PENDING').length === 0 && <p className="text-slate-400">No pending requests.</p>}
                  {recoveryRequests.filter(r => r.status === 'PENDING').map((req) => (
                      <div key={req.id} className="p-4 border rounded-xl bg-slate-50 flex justify-between items-center">
                          <div><p className="font-bold text-slate-800">{req.name}</p><p className="text-xs text-slate-500 font-mono">{req.mobile} • {req.id}</p></div>
                          <button onClick={() => handleApproveRequest(req)} className="bg-green-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow hover:bg-green-700">Approve Access</button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {activeTab === 'DATABASE' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Database Viewer</h3></div>
              <div className="bg-slate-900 rounded-xl p-4">
                  <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
                      {['nst_users', 'nst_system_settings', 'nst_activity_log', 'nst_iic_posts', 'nst_leaderboard'].map(k => (
                          <button key={k} onClick={() => setDbKey(k)} className={`px-3 py-1 rounded text-xs font-mono whitespace-nowrap ${dbKey === k ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}>{k}</button>
                      ))}
                  </div>
                  <textarea value={dbContent} onChange={e => setDbContent(e.target.value)} className="w-full h-96 bg-slate-950 text-green-400 font-mono text-xs p-4 rounded-lg focus:outline-none border border-slate-800 resize-none" spellCheck={false} />
                  <button onClick={() => { localStorage.setItem(dbKey, dbContent); alert("Database Updated Forcefully!"); }} className="mt-4 bg-red-600 text-white px-6 py-3 rounded-lg font-bold w-full hover:bg-red-700">⚠️ SAVE CHANGES (DANGEROUS)</button>
              </div>
          </div>
      )}

      {/* --- GIFT CODES TAB --- */}
      {activeTab === 'CODES' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Gift Code Generator</h3>
              </div>
              
              <div className="bg-pink-50 p-6 rounded-2xl border border-pink-100 mb-8">
                  <div className="flex flex-wrap gap-4 items-end">
                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Credits Amount</label>
                          <input type="number" value={newCodeAmount} onChange={e => setNewCodeAmount(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-32 font-bold" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Quantity</label>
                          <input type="number" value={newCodeCount} onChange={e => setNewCodeCount(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-32 font-bold" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-pink-700 uppercase block mb-1">Max Uses (Users)</label>
                          <input type="number" value={newCodeMaxUses} onChange={e => setNewCodeMaxUses(Number(e.target.value))} className="p-3 rounded-xl border border-pink-200 w-32 font-bold" min="1" />
                      </div>
                      <button onClick={generateCodes} className="bg-pink-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-pink-700 flex items-center gap-2">
                          <Gift size={20} /> Generate Codes
                      </button>
                  </div>
              </div>

              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr className="border-b"><th className="p-3">Code</th><th className="p-3">Amount</th><th className="p-3">Status</th><th className="p-3 text-right">Action</th></tr></thead>
                      <tbody>
                          {giftCodes.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-slate-400">No codes generated yet.</td></tr>}
                          {giftCodes.map(code => (
                              <tr key={code.id} className="border-b last:border-0 hover:bg-slate-50">
                                  <td className="p-3 font-mono font-bold text-slate-700 flex items-center gap-2">
                                      {code.code}
                                      <button onClick={() => { navigator.clipboard.writeText(code.code); alert("Code Copied!"); }} className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-blue-600 transition-colors" title="Copy Code">
                                          <Copy size={14} />
                                      </button>
                                  </td>
                                  <td className="p-3 font-bold text-pink-600">{code.amount} CR</td>
                                  <td className="p-3">
                                      {code.isRedeemed ? (
                                          <span className="bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold">Fully Redeemed</span>
                                      ) : (
                                          <span className="bg-green-100 text-green-600 px-2 py-1 rounded text-xs font-bold">
                                              Active ({code.usedCount || 0}/{code.maxUses || 1})
                                          </span>
                                      )}
                                  </td>
                                  <td className="p-3 text-right"><button onClick={() => deleteCode(code.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button></td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* ... (Rest of AdminDashboard remains unchanged) ... */}
      
      {/* ... (Previous code continues for SUBJECTS_MGR, USERS, RECYCLE etc...) */}
      {activeTab === 'SUBJECTS_MGR' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Custom Subject Manager</h3>
              </div>

              <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-8">
                  <div className="flex flex-wrap gap-4 items-end">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-emerald-700 uppercase block mb-1">Subject Name</label>
                          <input type="text" value={newSubName} onChange={e => setNewSubName(e.target.value)} placeholder="e.g. Physical Education" className="p-3 rounded-xl border border-emerald-200 w-full" />
                      </div>
                      <div className="flex-1">
                          <label className="text-xs font-bold text-emerald-700 uppercase block mb-1">Icon Style</label>
                          <select value={newSubIcon} onChange={e => setNewSubIcon(e.target.value)} className="p-3 rounded-xl border border-emerald-200 w-full bg-white">
                              <option value="book">Book</option>
                              <option value="science">Flask</option>
                              <option value="math">Calculator</option>
                              <option value="globe">Globe</option>
                              <option value="computer">Computer</option>
                              <option value="active">Activity</option>
                          </select>
                      </div>
                      <button onClick={addSubject} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-700">
                          Add Subject
                      </button>
                  </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.values({...DEFAULT_SUBJECTS, ...customSubjects}).map((sub: any) => (
                      <div key={sub.id} className="p-4 border rounded-xl flex items-center gap-3 bg-white">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sub.color}`}>
                              <Book size={20} />
                          </div>
                          <div>
                              <p className="font-bold text-sm">{sub.name}</p>
                              <p className="text-[10px] text-slate-400 uppercase">{sub.id}</p>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- SUBSCRIPTION PLANS EDITOR --- */}
      {activeTab === 'SUBSCRIPTION_PLANS_EDITOR' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-right">
              <div className="flex items-center gap-4 mb-6">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Edit Subscription Plans</h3>
              </div>
              
              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  {localSettings.subscriptionPlans?.map((plan, idx) => (
                      <div key={plan.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                          <div className="flex justify-between mb-2">
                              <h4 className="font-bold text-slate-800">{plan.name} Plan</h4>
                              <button onClick={() => {
                                  const updated = localSettings.subscriptionPlans!.filter((_, i) => i !== idx);
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="text-red-500 hover:text-red-700"><Trash2 size={16} /></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 mb-3">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Duration</label>
                                  <input type="text" value={plan.duration} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].duration = e.target.value;
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm bg-white" placeholder="e.g. 7 Days" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Popular Tag</label>
                                  <select value={plan.popular ? 'yes' : 'no'} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].popular = e.target.value === 'yes';
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm bg-white">
                                      <option value="no">No</option>
                                      <option value="yes">Yes</option>
                                  </select>
                              </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 bg-white p-3 rounded-xl border border-slate-100 mb-3">
                              <div>
                                  <p className="text-[10px] font-bold text-blue-600 mb-1 uppercase">Basic (MCQ+Notes)</p>
                                  <label className="text-[9px] text-slate-400 block">Sale Price</label>
                                  <input type="number" value={plan.basicPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].basicPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded mb-1 text-sm font-bold" />
                                  
                                  <label className="text-[9px] text-slate-400 block">Real Price</label>
                                  <input type="number" value={plan.basicOriginalPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].basicOriginalPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded text-xs text-slate-500" />
                              </div>
                              <div>
                                  <p className="text-[10px] font-bold text-purple-600 mb-1 uppercase">Ultra (PDF+Video)</p>
                                  <label className="text-[9px] text-slate-400 block">Sale Price</label>
                                  <input type="number" value={plan.ultraPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].ultraPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded mb-1 text-sm font-bold" />
                                  
                                  <label className="text-[9px] text-slate-400 block">Real Price</label>
                                  <input type="number" value={plan.ultraOriginalPrice} onChange={e => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[idx].ultraOriginalPrice = Number(e.target.value);
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-1.5 border rounded text-xs text-slate-500" />
                              </div>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-500">Features (comma separated)</label>
                              <input type="text" value={plan.features?.join(', ')} onChange={e => {
                                  const updated = [...localSettings.subscriptionPlans!];
                                  updated[idx].features = e.target.value.split(',').map(f => f.trim());
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="w-full p-2 border rounded-lg text-sm" />
                          </div>
                          <div className="flex gap-2 mt-3">
                              <label className="flex items-center gap-2"><input type="checkbox" checked={plan.popular} onChange={e => {
                                  const updated = [...localSettings.subscriptionPlans!];
                                  updated[idx].popular = e.target.checked;
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} /> <span className="text-xs font-bold">Mark as Popular</span></label>
                              <button onClick={() => {
                                  const updated = localSettings.subscriptionPlans!.filter((_, i) => i !== idx);
                                  setLocalSettings({...localSettings, subscriptionPlans: updated});
                              }} className="ml-auto text-red-500 hover:text-red-700 font-bold"><Trash2 size={16} /></button>
                          </div>
                      </div>
                  ))}
              </div>
              
              <div className="mt-6 pt-4 border-t flex gap-2">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-lg">← Back</button>
                  <button onClick={handleSaveSettings} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold">💾 Save Plans</button>
              </div>
          </div>
      )}

      {/* --- SUBSCRIPTION MANAGER TAB (NEW) --- */}
      {activeTab === 'SUBSCRIPTION_MANAGER' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6 border-b pb-4">
                  <button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button>
                  <h3 className="text-xl font-black text-slate-800">Subscription Manager</h3>
                  <div className="ml-auto flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold">
                          👑 {users.filter(u => u.subscriptionTier && u.subscriptionTier !== 'FREE').length} Premium Users
                      </span>
                  </div>
              </div>

              <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="Search by Name, Email or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-purple-500" />
              </div>

              <div className="grid gap-4">
                  {users.filter(u => u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
                      <div key={u.id} className={`p-4 rounded-xl border-2 ${u.subscriptionTier === 'LIFETIME' ? 'border-yellow-300 bg-yellow-50' : u.subscriptionTier === 'YEARLY' ? 'border-purple-300 bg-purple-50' : u.subscriptionTier === 'MONTHLY' ? 'border-blue-300 bg-blue-50' : u.subscriptionTier === 'WEEKLY' ? 'border-green-300 bg-green-50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-start justify-between mb-3">
                              <div>
                                  <p className="font-bold text-slate-800">{u.name}</p>
                                  <p className="text-xs text-slate-500">{u.email} • ID: {u.id}</p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  u.subscriptionTier === 'LIFETIME' ? 'bg-yellow-200 text-yellow-800' :
                                  u.subscriptionTier === 'YEARLY' ? 'bg-purple-200 text-purple-800' :
                                  u.subscriptionTier === 'MONTHLY' ? 'bg-blue-200 text-blue-800' :
                                  u.subscriptionTier === 'WEEKLY' ? 'bg-green-200 text-green-800' :
                                  'bg-slate-200 text-slate-700'
                              }`}>
                                  {u.subscriptionTier === 'LIFETIME' ? '🌟 LIFETIME' : u.subscriptionTier === 'YEARLY' ? '📅 YEARLY' : u.subscriptionTier === 'MONTHLY' ? '📆 MONTHLY' : u.subscriptionTier === 'WEEKLY' ? '⏰ WEEKLY' : 'FREE'}
                              </span>
                          </div>

                          <div className="grid grid-cols-4 gap-3 mb-3 text-xs">
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Credits</p>
                                  <p className="font-black text-blue-600">{u.credits || 0}</p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Price (₹)</p>
                                  <p className="font-black text-slate-800">₹{u.subscriptionPrice || 0}</p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Expires</p>
                                  <p className="font-black text-slate-800">{u.subscriptionEndDate ? new Date(u.subscriptionEndDate).toLocaleDateString() : '—'}</p>
                              </div>
                              <div className="bg-white p-2 rounded border border-slate-200">
                                  <p className="text-slate-500 font-bold uppercase">Admin Grant</p>
                                  <p className="font-black text-slate-800">{u.grantedByAdmin ? '✅' : '—'}</p>
                              </div>
                          </div>

                          <button 
                              onClick={() => openEditUser(u)}
                              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-2 rounded-lg font-bold text-xs hover:shadow-lg transition"
                          >
                              ⚙️ Manage Subscription
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      )}

      {/* --- USERS TAB (Enhanced) --- */}
      {activeTab === 'USERS' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">User Management</h3></div>
              <div className="relative mb-6">
                  <Search className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input type="text" placeholder="Search by Name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500"><tr className="uppercase text-xs"><th className="p-4">User</th><th className="p-4">Credits</th><th className="p-4">Role</th><th className="p-4 text-right">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {users.filter(u => u && (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id?.includes(searchTerm))).map(u => {
                              if (!u) return null;
                              return (
                              <tr key={u.id || Math.random()} className="hover:bg-slate-50 transition-colors">
                                  <td className="p-4"><p className="font-bold text-slate-800">{u.name || 'Unknown'}</p><p className="text-xs text-slate-400 font-mono">{u.id || 'No ID'}</p></td>
                                  <td className="p-4 font-bold text-blue-600">{u.credits || 0}</td>
                                  <td className="p-4"><span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role || 'STUDENT'}</span></td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      {u.role !== 'ADMIN' && (
                                          <>
                                              <button onClick={() => setDmUser(u)} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg" title="Message"><MessageSquare size={16} /></button>
                                              <button onClick={() => openEditUser(u)} className="p-2 text-slate-400 hover:text-orange-600 bg-slate-50 rounded-lg" title="Edit"><Edit3 size={16} /></button>
                                              <button onClick={() => onImpersonate && onImpersonate(u)} className="p-2 text-slate-400 hover:text-green-600 bg-slate-50 rounded-lg" title="Login as User"><Eye size={16} /></button>
                                              <button onClick={() => deleteUser(u.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                                          </>
                                      )}
                                  </td>
                              </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4">Edit User: {editingUser.name}</h3>
                  <div className="space-y-4">
                      {/* CREDITS */}
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">💎 Credits</label>
                          <input type="number" value={editUserCredits} onChange={e => setEditUserCredits(Number(e.target.value))} className="w-full p-2 border rounded-lg" />
                      </div>
                      
                      {/* PASSWORD */}
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">🔐 Password</label>
                          <input type="text" value={editUserPass} onChange={e => setEditUserPass(e.target.value)} className="w-full p-2 border rounded-lg" />
                      </div>

                      {/* SUBSCRIPTION TIER */}
                      <div className="border-t pt-3">
                          <label className="text-xs font-bold text-slate-500 uppercase">👑 Grant Subscription</label>
                          <div className="grid grid-cols-2 gap-2 mt-2">
                              <button onClick={() => setEditSubscriptionTier('FREE')} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'FREE' ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'}`}>FREE</button>
                              <button onClick={() => setEditSubscriptionTier('WEEKLY')} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'WEEKLY' ? 'bg-green-200 text-green-800' : 'bg-green-50 text-green-600'}`}>⏰ WEEKLY</button>
                              <button onClick={() => setEditSubscriptionTier('MONTHLY')} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'MONTHLY' ? 'bg-blue-200 text-blue-800' : 'bg-blue-50 text-blue-600'}`}>📆 MONTHLY</button>
                              <button onClick={() => setEditSubscriptionTier('YEARLY')} className={`p-2 rounded font-bold text-xs ${editSubscriptionTier === 'YEARLY' ? 'bg-purple-200 text-purple-800' : 'bg-purple-50 text-purple-600'}`}>📅 YEARLY</button>
                          </div>
                          <button onClick={() => setEditSubscriptionTier('LIFETIME')} className={`w-full p-2 mt-2 rounded font-bold text-xs ${editSubscriptionTier === 'LIFETIME' ? 'bg-yellow-200 text-yellow-800' : 'bg-yellow-50 text-yellow-600'}`}>🌟 LIFETIME</button>
                      </div>

                      {/* SUBSCRIPTION LEVEL */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div className="mt-2">
                              <label className="text-xs font-bold text-slate-500 uppercase">Level (For Real Users)</label>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                  <button onClick={() => setEditSubscriptionLevel('BASIC')} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'BASIC' ? 'bg-blue-100 border-blue-300 text-blue-800' : 'bg-white border-slate-200'}`}>BASIC</button>
                                  <button onClick={() => setEditSubscriptionLevel('ULTRA')} className={`p-2 rounded font-bold text-xs border ${editSubscriptionLevel === 'ULTRA' ? 'bg-purple-100 border-purple-300 text-purple-800' : 'bg-white border-slate-200'}`}>ULTRA</button>
                              </div>
                          </div>
                      )}

                      {/* SUBSCRIPTION DAYS */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">📅 Duration (Days)</label>
                              <input type="number" min="1" value={editSubscriptionDays} onChange={e => setEditSubscriptionDays(Number(e.target.value))} className="w-full p-2 border rounded-lg" />
                              <p className="text-[10px] text-slate-500 mt-1">Expires: {new Date(Date.now() + editSubscriptionDays * 24 * 60 * 60 * 1000).toLocaleDateString()}</p>
                          </div>
                      )}

                      {/* SUBSCRIPTION PRICE */}
                      {editSubscriptionTier !== 'FREE' && (
                          <div>
                              <label className="text-xs font-bold text-slate-500 uppercase">💰 Subscription Price (₹)</label>
                              <input type="number" value={editSubscriptionPrice} onChange={e => setEditSubscriptionPrice(Number(e.target.value))} className="w-full p-2 border rounded-lg" />
                              <p className="text-[10px] text-slate-500 mt-1">Free grant set to ₹{editSubscriptionPrice} for reference</p>
                          </div>
                      )}

                      {/* BUTTONS */}
                      <div className="flex gap-2 pt-4 border-t">
                          <button onClick={() => setEditingUser(null)} className="flex-1 py-2 text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                          <button onClick={saveEditedUser} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700">✅ Grant Subscription</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* --- DM USER MODAL WITH GIFT --- */}
      {dmUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl animate-in fade-in max-h-[90vh] overflow-y-auto">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Gift className="text-pink-500" /> Gift & Message
                  </h3>
                  <p className="text-xs text-slate-500 mb-2">To: <span className="font-bold text-slate-800">{dmUser.name}</span></p>
                  
                  <textarea 
                      value={dmText} 
                      onChange={e => setDmText(e.target.value)} 
                      className="w-full h-24 p-3 border rounded-xl mb-4 text-sm" 
                      placeholder="Write a message..." 
                  />

                  <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 mb-4">
                      <label className="text-xs font-bold text-pink-700 uppercase block mb-2">Attach Gift</label>
                      <select 
                          value={giftType} 
                          onChange={e => setGiftType(e.target.value as any)} 
                          className="w-full p-2 border rounded-lg text-sm mb-2"
                      >
                          <option value="NONE">None</option>
                          <option value="CREDITS">Credits (Coins)</option>
                          <option value="SUBSCRIPTION">Subscription</option>
                          {/* <option value="ANIMATION">Unlock Animation</option> */}
                      </select>

                      {giftType === 'CREDITS' && (
                          <input 
                              type="number" 
                              placeholder="Amount (e.g. 100)" 
                              value={giftValue} 
                              onChange={e => setGiftValue(Number(e.target.value))} 
                              className="w-full p-2 border rounded-lg text-sm"
                          />
                      )}

                      {giftType === 'SUBSCRIPTION' && (
                          <div className="space-y-2">
                              <select 
                                  value={giftValue} 
                                  onChange={e => setGiftValue(e.target.value)} 
                                  className="w-full p-2 border rounded-lg text-sm"
                              >
                                  <option value="">Select Plan</option>
                                  <option value="WEEKLY_BASIC">Weekly Basic</option>
                                  <option value="WEEKLY_ULTRA">Weekly Ultra</option>
                                  <option value="MONTHLY_BASIC">Monthly Basic</option>
                                  <option value="MONTHLY_ULTRA">Monthly Ultra</option>
                                  <option value="YEARLY_BASIC">Yearly Basic</option>
                                  <option value="YEARLY_ULTRA">Yearly Ultra</option>
                              </select>
                              <div className="flex gap-2 items-center">
                                  <label className="text-xs text-slate-500">Duration (Hrs):</label>
                                  <input 
                                      type="number" 
                                      value={giftDuration} 
                                      onChange={e => setGiftDuration(Number(e.target.value))} 
                                      className="w-20 p-2 border rounded-lg text-sm"
                                  />
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="flex gap-2">
                      <button onClick={() => {setDmUser(null); setGiftType('NONE');}} className="flex-1 py-3 text-slate-500 font-bold bg-slate-100 rounded-xl">Cancel</button>
                      <button onClick={sendDirectMessage} className="flex-1 py-3 bg-pink-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-pink-700">
                          <Gift size={18} /> Send Gift
                      </button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'PRICING_MGMT' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">💰 Pricing Management</h3></div>
              
              {/* SUBSCRIPTION PLANS */}
              <div className="mb-8">
                  <h4 className="font-bold text-lg mb-4 text-slate-800">Subscription Plans</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(localSettings.subscriptionPlans || []).map((plan, idx) => (
                          <div key={plan.id} className="border rounded-xl p-4 hover:shadow-md transition-all">
                              <h5 className="font-bold text-slate-800">{plan.name}</h5>
                              <p className="text-xs text-slate-500 mb-2">{plan.duration}</p>
                              <div className="flex flex-col gap-1 mb-3">
                                  <div className="flex gap-2 items-center">
                                      <span className="text-xs font-bold text-slate-400 w-12">BASIC:</span>
                                      <span className="text-xl font-black text-blue-600">₹{plan.basicPrice}</span>
                                      {plan.basicOriginalPrice && <span className="text-xs line-through text-slate-400">₹{plan.basicOriginalPrice}</span>}
                                  </div>
                                  <div className="flex gap-2 items-center">
                                      <span className="text-xs font-bold text-slate-400 w-12">ULTRA:</span>
                                      <span className="text-xl font-black text-purple-600">₹{plan.ultraPrice}</span>
                                      {plan.ultraOriginalPrice && <span className="text-xs line-through text-slate-400">₹{plan.ultraOriginalPrice}</span>}
                                  </div>
                              </div>
                              <button onClick={() => setEditingPlanIdx(idx)} className="w-full py-2 bg-blue-100 text-blue-700 rounded font-bold text-sm hover:bg-blue-200">
                                  Edit
                              </button>
                          </div>
                      ))}
                  </div>
              </div>

                  {/* GLOBAL DEFAULT PRICING */}
              <div className="mb-8 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">Global Default Pricing <span className="text-[10px] bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full uppercase">Fallback</span></h4>
                  <div className="grid grid-cols-2 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Default Video Cost (Credits)</label>
                          <input type="number" value={localSettings.defaultVideoCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, defaultVideoCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Used if individual video price is not set.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Default PDF Cost (Credits)</label>
                          <input type="number" value={localSettings.defaultPdfCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, defaultPdfCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Used if individual PDF price is not set.</p>
                      </div>
                  </div>
              </div>

              {/* MCQ PRICING CONFIG */}
              <div className="mb-8 p-4 bg-purple-50 rounded-xl border border-purple-100">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">MCQ Settings <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full uppercase">Restrictions & Costs</span></h4>
                  <div className="bg-white p-3 rounded-lg border border-purple-100 mb-4 flex items-center justify-between">
                      <div>
                          <p className="font-bold text-slate-700 text-sm">MCQ Chapter Lock (100 Qs)</p>
                          <p className="text-[10px] text-slate-500">Require 100 solved MCQs to unlock next chapter.</p>
                      </div>
                      <input 
                          type="checkbox" 
                          checked={localSettings.enableMcqUnlockRestriction !== false} 
                          onChange={() => toggleSetting('enableMcqUnlockRestriction')} 
                          className="w-5 h-5 accent-purple-600" 
                      />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Test Entry Cost</label>
                          <input type="number" value={localSettings.mcqTestCost ?? 2} onChange={(e) => setLocalSettings({...localSettings, mcqTestCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to start a Premium Test.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">Analysis Cost</label>
                          <input type="number" value={localSettings.mcqAnalysisCost ?? 5} onChange={(e) => setLocalSettings({...localSettings, mcqAnalysisCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to unlock answers.</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500 uppercase">History View Cost</label>
                          <input type="number" value={localSettings.mcqHistoryCost ?? 1} onChange={(e) => setLocalSettings({...localSettings, mcqHistoryCost: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                          <p className="text-[10px] text-slate-400 mt-1">Cost to view past results.</p>
                      </div>
                  </div>
              </div>

              {/* FULL FEATURE PRICING MASTER LIST */}
              <div className="mb-8 p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-lg mb-4 text-slate-800 flex items-center gap-2">
                      <Banknote size={20} /> Master Pricing Control
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Helper to render price input */}
                      {[
                          { key: 'mcqTestCost', label: 'MCQ Test Entry', default: 2 },
                          { key: 'mcqAnalysisCost', label: 'MCQ Analysis Unlock', default: 5 },
                          { key: 'mcqHistoryCost', label: 'MCQ History View', default: 1 },
                          { key: 'defaultPdfCost', label: 'PDF Access', default: 5 },
                          { key: 'defaultVideoCost', label: 'Video Access', default: 5 },
                          { key: 'chatCost', label: 'Support Chat', default: 1 },
                          { key: 'gameCost', label: 'Spin Wheel', default: 0 },
                          { key: 'profileEditCost', label: 'Edit Profile (Free User)', default: 10 },
                      ].map((item) => (
                          <div key={item.key} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-center mb-2">
                                  <label className="text-xs font-bold text-slate-600 uppercase">{item.label}</label>
                                  {/* Toggle Switch Logic: Assuming 0 means "Off/Free" effectively, or we can use a separate boolean. 
                                      User said "coin off... lock laga dega". 
                                      We will use a checkbox that sets cost to 0 if unchecked, or restores default/input if checked? 
                                      Actually better to just have the input. If Admin sets 0, it's free. 
                                      If Admin sets -1 or similar, maybe locked? 
                                      Let's keep it simple: Just the cost input. 0 = Free. >0 = Paid.
                                  */}
                              </div>
                              <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-slate-400">🪙</span>
                                  <input 
                                      type="number" 
                                      // @ts-ignore
                                      value={localSettings[item.key] !== undefined ? localSettings[item.key] : item.default} 
                                      onChange={(e) => setLocalSettings({...localSettings, [item.key]: Number(e.target.value)})}
                                      className="w-full p-2 border rounded-lg font-bold text-slate-800"
                                      min="0"
                                  />
                              </div>
                              <p className="text-[9px] text-slate-400 mt-1">Set 0 to make FREE.</p>
                          </div>
                      ))}
                  </div>
              </div>

              {/* CREDIT PACKAGES */}
              <div>
                  <h4 className="font-bold text-lg mb-4 text-slate-800">Credit Packages</h4>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {localSettings.packages.map((pkg) => (
                          <div key={pkg.id} className="border rounded-xl p-3 hover:shadow-md transition-all text-center">
                              <h5 className="font-bold text-slate-800 text-sm">{pkg.name}</h5>
                              <p className="text-xs text-slate-500 my-1">{pkg.credits} CR</p>
                              <p className="text-lg font-black text-blue-600 mb-2">₹{pkg.price}</p>
                              <button onClick={() => setEditingPkg(pkg)} className="w-full py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200">
                                  Edit
                              </button>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {/* EDIT PLAN MODAL */}
      {editingPlanIdx !== null && localSettings.subscriptionPlans && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Edit Plan: {localSettings.subscriptionPlans[editingPlanIdx].name}</h3>
                  <div className="space-y-4">
                      <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="font-bold text-blue-800 text-xs mb-2 uppercase">Basic Tier (MCQ+Notes)</p>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Sale Price (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].basicPrice} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], basicPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Original (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].basicOriginalPrice || ''} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], basicOriginalPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                          </div>
                      </div>

                      <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
                          <p className="font-bold text-purple-800 text-xs mb-2 uppercase">Ultra Tier (PDF+Video)</p>
                          <div className="grid grid-cols-2 gap-2">
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Sale Price (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].ultraPrice} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], ultraPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500">Original (₹)</label>
                                  <input type="number" value={localSettings.subscriptionPlans[editingPlanIdx].ultraOriginalPrice || ''} onChange={(e) => {
                                      const updated = [...localSettings.subscriptionPlans!];
                                      updated[editingPlanIdx] = {...updated[editingPlanIdx], ultraOriginalPrice: Number(e.target.value)};
                                      setLocalSettings({...localSettings, subscriptionPlans: updated});
                                  }} className="w-full p-2 border rounded-lg text-sm" />
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingPlanIdx(null)} className="flex-1 py-2 text-slate-500">Cancel</button>
                      <button onClick={() => {handleSaveSettings(); setEditingPlanIdx(null);}} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* EDIT PACKAGE MODAL */}
      {editingPkg && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
              <div className="bg-white p-6 rounded-2xl w-full max-w-sm shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Edit Package: {editingPkg.name}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-500">Credits</label>
                          <input type="number" value={editingPkg.credits} onChange={(e) => setEditingPkg({...editingPkg, credits: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-500">Price (₹)</label>
                          <input type="number" value={editingPkg.price} onChange={(e) => setEditingPkg({...editingPkg, price: Number(e.target.value)})} className="w-full p-2 border rounded-lg" />
                      </div>
                  </div>
                  <div className="flex gap-2 mt-6">
                      <button onClick={() => setEditingPkg(null)} className="flex-1 py-2 text-slate-500">Cancel</button>
                      <button onClick={() => {
                          const updated = localSettings.packages.map(p => p.id === editingPkg.id ? editingPkg : p);
                          setLocalSettings({...localSettings, packages: updated});
                          handleSaveSettings();
                          setEditingPkg(null);
                      }} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-bold">Save</button>
                  </div>
              </div>
          </div>
      )}

      {activeTab === 'RECYCLE' && (
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4">
              <div className="flex items-center gap-4 mb-6"><button onClick={() => setActiveTab('DASHBOARD')} className="bg-slate-100 p-2 rounded-full hover:bg-slate-200"><ArrowLeft size={20} /></button><h3 className="text-xl font-black text-slate-800">Recycle Bin (90 Days)</h3></div>
              <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 border-b border-slate-100 text-slate-500"><tr className="uppercase text-xs"><th className="p-4">Item</th><th className="p-4">Type</th><th className="p-4">Deleted</th><th className="p-4 text-right">Actions</th></tr></thead>
                      <tbody className="divide-y divide-slate-50">
                          {recycleBin.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-400">Bin is empty.</td></tr>}
                          {recycleBin.map(item => (
                              <tr key={item.id} className="hover:bg-red-50 transition-colors">
                                  <td className="p-4 font-bold text-slate-700">{item.name}</td>
                                  <td className="p-4"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-500">{item.type}</span></td>
                                  <td className="p-4 text-xs text-slate-500">{new Date(item.deletedAt).toLocaleDateString()}</td>
                                  <td className="p-4 text-right flex justify-end gap-2">
                                      <button onClick={() => handleRestoreItem(item)} className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100"><RotateCcw size={16} /></button>
                                      <button onClick={() => handlePermanentDelete(item.id)} className="p-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"><X size={16} /></button>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      )}

      {/* CROPPER MODAL */}
      {cropImageSrc && (
          <ImageCropper 
              imageSrc={cropImageSrc} 
              onCropComplete={handleCropComplete} 
              onCancel={() => setCropImageSrc(null)} 
          />
      )}

      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />

    </div>
  );
};
