
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage, SystemSettings } from '../types';
import { Send, Trash2, Edit2, Shield, User as UserIcon, Lock, Clock, Coins, Crown, MessageCircle, AlertTriangle, Ban, ArrowLeft, Globe, ToggleRight, ToggleLeft, Palette, Sparkles, X } from 'lucide-react';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { CustomConfirm } from './CustomDialogs';
import { rtdb } from '../firebase';
import { ref, onValue, push, set, update, remove, get } from "firebase/database";

interface Props {
  currentUser: User;
  onUserUpdate: (user: User) => void;
  isAdminView?: boolean;
  settings?: SystemSettings; 
}

interface ChatSession {
    studentId: string;
    studentName: string;
    lastMessage?: string;
    timestamp?: number;
    unreadCount?: number;
}

export const UniversalChat: React.FC<Props> = ({ currentUser, onUserUpdate, isAdminView = false, settings }) => {
  const [activeTab, setActiveTab] = useState<'UNIVERSAL' | 'PRIVATE'>('UNIVERSAL');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Custom Dialog Config
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, msgId: string | null}>({isOpen: false, msgId: null});

  // Customization State (Admin/Ultra)
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [selectedAnimation, setSelectedAnimation] = useState('none');
  const [showStylePanel, setShowStylePanel] = useState(false);

  // Student Input State
  const [sendToAdmin, setSendToAdmin] = useState(false); // Toggle for 'BOTH' mode

  // ADMIN STATE
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  const CHAT_COST = settings?.chatCost ?? 1;
  const COOLDOWN_HOURS = settings?.chatCooldownHours ?? 6;
  const IS_ENABLED = settings?.isChatEnabled ?? true;
  const CHAT_MODE = settings?.chatMode || 'BOTH';
  const IS_FREE_MODE = CHAT_COST === 0;

  // INITIALIZE TAB BASED ON MODE
  useEffect(() => {
      if (CHAT_MODE === 'PRIVATE_ONLY') setActiveTab('PRIVATE');
      else if (CHAT_MODE === 'UNIVERSAL_ONLY') setActiveTab('UNIVERSAL');
      // If BOTH, default to UNIVERSAL or user choice. Default Universal.
  }, [CHAT_MODE]);

  // 1. SETUP LISTENER
  useEffect(() => {
      let chatPath = '';

      if (isAdminView) {
          if (activeTab === 'UNIVERSAL') {
              chatPath = 'universal_chat';
          } else {
              // PRIVATE MODE LISTENER (List of students)
              const chatsRef = ref(rtdb, 'chats');
              const unsub = onValue(chatsRef, (snapshot) => {
                  const data = snapshot.val();
                  if (data) {
                      const sessions: ChatSession[] = Object.keys(data).map(key => {
                          const msgs = data[key].messages;
                          const msgList = msgs ? Object.values(msgs) : [];
                          // @ts-ignore
                          const lastMsg = msgList.length > 0 ? msgList[msgList.length - 1] : null;
                          
                          return {
                              studentId: key,
                              studentName: data[key].studentName || 'Unknown Student', 
                              lastMessage: lastMsg ? lastMsg.text : '',
                              timestamp: lastMsg ? new Date(lastMsg.timestamp).getTime() : 0
                          };
                      });
                      setChatSessions(sessions.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)));
                  } else {
                      setChatSessions([]);
                  }
              });
              return () => unsub();
          }
      } else {
          // STUDENT VIEW
          if (activeTab === 'UNIVERSAL') {
              chatPath = 'universal_chat';
          } else {
              chatPath = `chats/${currentUser.id}/messages`;
          }
      }

      if (chatPath) {
          const chatRef = ref(rtdb, chatPath);
          const unsub = onValue(chatRef, (snapshot) => {
              const data = snapshot.val();
              if (data) {
                  const msgList: ChatMessage[] = Object.values(data); // For universal, data is list of msgs. For private (student view), same.
                  setMessages(msgList.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
              } else {
                  setMessages([]);
              }
          });
          return () => unsub();
      }
  }, [isAdminView, currentUser.id, activeTab]);

  // ADMIN: Listen to Selected Student Chat (Private Mode Drilldown)
  useEffect(() => {
      if (isAdminView && activeTab === 'PRIVATE' && selectedStudentId) {
          const chatRef = ref(rtdb, `chats/${selectedStudentId}/messages`);
          const unsub = onValue(chatRef, (snapshot) => {
              const data = snapshot.val();
              if (data) {
                  const msgList: ChatMessage[] = Object.values(data);
                  setMessages(msgList.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
              } else {
                  setMessages([]);
              }
          });
          return () => unsub();
      }
  }, [isAdminView, activeTab, selectedStudentId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab, selectedStudentId]);

  const canSendMessage = () => {
      if (currentUser.role === 'ADMIN') return { allowed: true };
      
      // BAN CHECK
      if (currentUser.isChatBanned) return { allowed: false, reason: "You are banned from chat." };

      if (!IS_ENABLED && activeTab === 'UNIVERSAL') return { allowed: false, reason: "Chat Disabled by Admin" };

      if (IS_FREE_MODE) return { allowed: true }; 

      if (currentUser.isPremium) return { allowed: true };
      
      // Credit Check
      if (currentUser.credits < CHAT_COST) return { allowed: false, reason: `Insufficient Credits (Need ${CHAT_COST})` };
      
      // Time Check
      if (currentUser.lastChatTime) {
          const lastTime = new Date(currentUser.lastChatTime).getTime();
          const now = Date.now();
          const diffHours = (now - lastTime) / (1000 * 60 * 60);
          if (diffHours < COOLDOWN_HOURS) return { allowed: false, reason: `Cooldown: Wait ${(COOLDOWN_HOURS - diffHours).toFixed(1)} hrs` };
      }
      
      return { allowed: true };
  };

  const handleSend = () => {
      if (!inputText.trim()) return;
      setErrorMsg(null);

      // Check Restrictions
      const check = canSendMessage();
      if (!check.allowed) {
          setErrorMsg(check.reason || "Restriction Active");
          return;
      }

      // Payment Check
      const needsPayment = currentUser.role !== 'ADMIN' && !currentUser.isPremium && !IS_FREE_MODE && CHAT_COST > 0;
      
      if (needsPayment) {
          if (currentUser.isAutoDeductEnabled) {
              processPaymentAndSend();
          } else {
              setShowConfirm(true);
          }
      } else {
          finalizeSend();
      }
  };

  const processPaymentAndSend = (enableAuto: boolean = false) => {
      const updatedUser = { 
          ...currentUser, 
          credits: currentUser.credits - CHAT_COST,
          lastChatTime: new Date().toISOString()
      };
      if (enableAuto) updatedUser.isAutoDeductEnabled = true;
      
      onUserUpdate(updatedUser);
      finalizeSend();
      setShowConfirm(false);
  };

  const finalizeSend = async () => {
      let targetPath = '';
      
      if (isAdminView) {
          if (activeTab === 'UNIVERSAL') targetPath = 'universal_chat';
          else if (selectedStudentId) targetPath = `chats/${selectedStudentId}/messages`;
          else return;
      } else {
          // Student Logic
          // Use toggle state 'sendToAdmin' only if mode is BOTH.
          // Otherwise, route based on current active tab (though student tabs are hidden if only 1 mode, logic matches)
          const isDirectToAdmin = CHAT_MODE === 'PRIVATE_ONLY' || (CHAT_MODE === 'BOTH' && sendToAdmin);
          
          if (isDirectToAdmin) {
              targetPath = `chats/${currentUser.id}/messages`;
          } else {
              targetPath = 'universal_chat';
          }
      }

      if (editingId) { // Edit Logic (simplified, assumes same path)
           const msgRef = ref(rtdb, `${targetPath}/${editingId}`);
           await update(msgRef, { text: inputText });
           setEditingId(null);
      } else {
          // NEW MESSAGE
          const newMsgRef = push(ref(rtdb, targetPath));
          const newMessage: ChatMessage = {
              id: newMsgRef.key as string,
              userId: currentUser.id,
              userName: currentUser.name,
              userRole: currentUser.role,
              // @ts-ignore - Injecting extra props for styling
              subscriptionTier: currentUser.subscriptionTier || 'FREE',
              // @ts-ignore
              subscriptionLevel: currentUser.subscriptionLevel || 'BASIC',
              // @ts-ignore
              color: selectedColor !== '#000000' ? selectedColor : undefined,
              // @ts-ignore
              animation: selectedAnimation !== 'none' ? selectedAnimation : undefined,
              text: inputText,
              timestamp: new Date().toISOString()
          };
          await set(newMsgRef, newMessage);

          // Update Meta Data (Student Name) if Private
          if (!isAdminView && (CHAT_MODE === 'PRIVATE_ONLY' || (CHAT_MODE === 'BOTH' && sendToAdmin))) {
               const metaRef = ref(rtdb, `chats/${currentUser.id}`);
               await update(metaRef, { studentName: currentUser.name });
          }
      }
      setInputText('');
  };

  // DELETE MESSAGE
  const requestDelete = (msgId: string) => {
      setDeleteConfirm({ isOpen: true, msgId });
  };

  const confirmDelete = async () => {
      if (deleteConfirm.msgId) {
          let targetPath = '';
          if (isAdminView) {
              if (activeTab === 'UNIVERSAL') targetPath = 'universal_chat';
              else if (selectedStudentId) targetPath = `chats/${selectedStudentId}/messages`;
          } else {
              if (activeTab === 'UNIVERSAL') targetPath = 'universal_chat';
              else targetPath = `chats/${currentUser.id}/messages`;
          }
          
          if (targetPath) {
              const msgRef = ref(rtdb, `${targetPath}/${deleteConfirm.msgId}`);
              await remove(msgRef);
          }
      }
      setDeleteConfirm({ isOpen: false, msgId: null });
  };

  const handleEdit = (msg: ChatMessage) => {
      setEditingId(msg.id);
      setInputText(msg.text);
  };

  const statusCheck = canSendMessage();

  // --- RENDER ADMIN LIST VIEW (PRIVATE TAB) ---
  if (isAdminView && activeTab === 'PRIVATE' && !selectedStudentId) {
      return (
          <div className="flex flex-col h-[80vh] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
               {/* TABS */}
               <div className="flex border-b border-slate-100">
                   <button onClick={() => setActiveTab('UNIVERSAL')} className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === 'UNIVERSAL' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}>
                       <Globe size={18} /> Group Chat
                   </button>
                   <button onClick={() => setActiveTab('PRIVATE')} className={`flex-1 py-4 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === 'PRIVATE' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-slate-500 hover:bg-slate-50'}`}>
                       <Shield size={18} /> Support Inbox
                   </button>
               </div>

               <div className="flex-1 overflow-y-auto p-2">
                   {chatSessions.length === 0 && <p className="text-center text-slate-400 py-10">No active support chats.</p>}
                   {chatSessions.map(session => (
                       <div key={session.studentId} onClick={() => setSelectedStudentId(session.studentId)} className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer rounded-lg flex justify-between items-center">
                           <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                                   <UserIcon size={20} />
                               </div>
                               <div>
                                   <p className="font-bold text-slate-700">{session.studentName}</p>
                                   <p className="text-xs text-slate-500 truncate w-48">{session.lastMessage}</p>
                               </div>
                           </div>
                           <div className="text-right">
                               <p className="text-[10px] text-slate-400">{new Date(session.timestamp || 0).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p>
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      );
  }

  // --- RENDER MAIN CHAT INTERFACE ---
  return (
    <div className={`flex flex-col h-[80vh] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 ${isAdminView ? '' : 'max-w-4xl mx-auto'}`}>
        {/* Header & Tabs */}
        <div>
            {/* TABS (Show if BOTH or Admin) */}
            {(CHAT_MODE === 'BOTH' || isAdminView) && (
                <div className="flex border-b border-slate-100">
                    {/* Admin always sees both, Student sees based on Mode */}
                    {(isAdminView || CHAT_MODE === 'BOTH' || CHAT_MODE === 'UNIVERSAL_ONLY') && (
                        <button 
                            onClick={() => { setActiveTab('UNIVERSAL'); setSelectedStudentId(null); }} 
                            className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-2 ${activeTab === 'UNIVERSAL' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Globe size={16} /> Global Group
                        </button>
                    )}
                    {(isAdminView || CHAT_MODE === 'BOTH' || CHAT_MODE === 'PRIVATE_ONLY') && (
                        <button 
                            onClick={() => setActiveTab('PRIVATE')} 
                            className={`flex-1 py-3 font-bold text-xs flex items-center justify-center gap-2 ${activeTab === 'PRIVATE' ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                            <Shield size={16} /> {isAdminView ? 'Support Inbox' : 'Admin Support'}
                        </button>
                    )}
                </div>
            )}

            <div className="bg-white border-b border-slate-100 p-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {isAdminView && selectedStudentId && <button onClick={() => setSelectedStudentId(null)} className="p-1 rounded-full hover:bg-slate-100"><ArrowLeft size={18} /></button>}
                    
                    <div className={`p-2 rounded-xl ${activeTab === 'UNIVERSAL' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                        {activeTab === 'UNIVERSAL' ? <Globe size={20} /> : <Shield size={20} />}
                    </div>
                    <div>
                        <h3 className="font-black text-sm text-slate-800 tracking-tight">
                            {activeTab === 'UNIVERSAL' ? "Universal Chat 2.0" : (isAdminView && selectedStudentId ? "Chat with Student" : "Private Support")}
                        </h3>
                        <p className="text-[10px] text-slate-500">
                            {activeTab === 'UNIVERSAL' ? "Visible to everyone" : "Direct line to Admin"}
                        </p>
                    </div>
                </div>
            </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg) => {
                const isMe = msg.userId === currentUser.id;
                const isAdminMsg = msg.userRole === 'ADMIN';
                // @ts-ignore
                const subTier = msg.subscriptionTier || 'FREE';
                // @ts-ignore
                const subLevel = msg.subscriptionLevel || 'BASIC';
                // @ts-ignore
                const customColor = msg.color;
                // @ts-ignore
                const customAnim = msg.animation;
                
                // STYLING LOGIC
                let bubbleClass = 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'; // Default Free
                let glowClass = '';
                let animationClass = '';
                let textColorStyle = {};

                if (customColor) textColorStyle = { color: customColor };
                
                if (customAnim) {
                    if (customAnim === 'bounce') animationClass = 'animate-bounce';
                    else if (customAnim === 'pulse') animationClass = 'animate-pulse';
                    else if (customAnim === 'spin') animationClass = 'animate-spin';
                    else if (customAnim === 'ping') animationClass = 'animate-ping';
                    else if (customAnim === 'wiggle') animationClass = 'animate-wiggle'; // Need to define custom wiggle
                    else animationClass = `animate-${customAnim}`;
                }
                
                if (isMe) {
                    bubbleClass = 'bg-blue-600 text-white rounded-tr-none';
                    if (customColor) textColorStyle = { color: customColor, textShadow: '0 1px 2px rgba(0,0,0,0.3)' }; // Ensure visibility on blue
                } else if (isAdminMsg) {
                    bubbleClass = 'bg-purple-900 text-white border-2 border-purple-400 rounded-tl-none';
                    glowClass = 'shadow-[0_0_20px_rgba(168,85,247,0.8)]';
                    animationClass = animationClass || 'animate-in slide-in-from-left duration-500';
                } else {
                    // OTHER USERS - TIER BASED STYLING
                    if (subLevel === 'ULTRA') {
                        bubbleClass = 'bg-gradient-to-r from-slate-900 to-slate-800 text-white border border-yellow-500/50 rounded-tl-none';
                        glowClass = 'shadow-[0_0_15px_rgba(234,179,8,0.4)] ring-1 ring-yellow-500/30'; // Stronger Gold Glow
                        animationClass = animationClass || 'animate-in slide-in-from-left duration-300';
                    } else if (subTier === 'YEARLY' || subTier === 'LIFETIME') {
                        bubbleClass = 'bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-tl-none';
                    } else if (subTier !== 'FREE') {
                        bubbleClass = 'bg-blue-50 text-blue-900 border border-blue-200 rounded-tl-none';
                    }
                }

                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} ${animationClass}`}>
                         <div className={`max-w-[85%] rounded-2xl p-3 shadow-sm relative group transition-all duration-300 ${bubbleClass} ${glowClass}`}>
                             <div className="flex justify-between items-start gap-2 mb-1">
                                 <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${isMe ? 'text-blue-200' : isAdminMsg ? 'text-yellow-400' : 'text-slate-500'}`}>
                                     {isAdminMsg && <Crown size={12} className="text-yellow-400 fill-current animate-bounce" />}
                                     {/* @ts-ignore */}
                                     {!isAdminMsg && !isMe && subLevel === 'ULTRA' && <Zap size={10} className="text-yellow-500 fill-yellow-500 animate-pulse" />}
                                     {isAdminMsg ? 'ADMIN' : (isMe ? 'You' : msg.userId)}
                                 </span>
                                 <span className={`text-[9px] ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                                     {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </span>
                             </div>
                             <p className="text-sm whitespace-pre-wrap leading-relaxed" style={textColorStyle}>{msg.text}</p>

                             {/* Admin Controls */}
                             {(currentUser.role === 'ADMIN') && (
                                 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-white/20 backdrop-blur-sm rounded p-1">
                                     <button onClick={() => requestDelete(msg.id)} className="p-1 hover:text-red-300 text-slate-300"><Trash2 size={12} /></button>
                                 </div>
                             )}
                         </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-slate-200">
            {/* TOGGLE FOR STUDENT (Only if mode is BOTH and on non-admin view, technically covered by Tabs now but keeping per request) */}
            {/* Actually, if Tabs are present, the toggle is redundant. The user said: 
                "Tabs: ... Universal ... Private"
                AND "Chat Input Logic: ... When chat_mode == BOTH, add a small toggle... select Send to Group or Send to Admin"
                This implies the toggle might switch the CONTEXT without switching tabs OR switching tabs is the toggle.
                If I have Tabs, they are the best UI for this. I implemented Tabs.
                However, to strictly follow "Chat Input Logic (Student Choice)", maybe they want a quick switch?
                I will sync the toggle with the tabs. If user toggles, I switch tab.
            */}
            
            {!isAdminView && CHAT_MODE === 'BOTH' && (
                <div className="flex justify-center mb-2">
                    <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                        <button 
                            onClick={() => { setSendToAdmin(false); setActiveTab('UNIVERSAL'); }}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${!sendToAdmin ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                        >
                            🌍 Group
                        </button>
                        <button 
                            onClick={() => { setSendToAdmin(true); setActiveTab('PRIVATE'); }}
                            className={`px-3 py-1 rounded-md text-[10px] font-bold transition-all ${sendToAdmin ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}
                        >
                            🛡️ Admin
                        </button>
                    </div>
                </div>
            )}

            {errorMsg && (
                <div className="mb-2 text-center">
                    <span className="bg-red-100 text-red-600 text-xs font-bold px-3 py-1 rounded-full flex items-center justify-center gap-1 mx-auto w-fit">
                        <Lock size={12} /> {errorMsg}
                    </span>
                </div>
            )}

            {/* Credit Status Indicator */}
            {!currentUser.isPremium && CHAT_COST > 0 && !isAdminView && (
                <div className="flex justify-end px-2 mb-1">
                    <span className={`text-[10px] font-bold ${currentUser.credits < CHAT_COST ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}>
                        Cost: {CHAT_COST} CR • Balance: {currentUser.credits} CR
                    </span>
                </div>
            )}
            
            {currentUser.isChatBanned ? (
                <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center font-bold flex flex-col items-center gap-2">
                    <Ban size={24} />
                    You have been banned from using Chat.
                </div>
            ) : (
                <>
                    {/* STYLE PANEL (Admin/Ultra Only) */}
                    {showStylePanel && (currentUser.role === 'ADMIN' || (currentUser.subscriptionLevel === 'ULTRA' && currentUser.isPremium)) && (
                        <div className="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-xl animate-in slide-in-from-bottom-2">
                            <div className="flex items-center gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Text Color</label>
                                    <div className="flex gap-1 mt-1">
                                        {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#FFA500'].map(c => (
                                            <button 
                                                key={c} 
                                                onClick={() => setSelectedColor(c)} 
                                                className={`w-6 h-6 rounded-full border ${selectedColor === c ? 'border-2 border-slate-800 scale-110' : 'border-slate-200'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                        <input type="color" value={selectedColor} onChange={e => setSelectedColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded-full overflow-hidden" />
                                    </div>
                                </div>
                                {currentUser.role === 'ADMIN' && (
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Animation</label>
                                        <select 
                                            value={selectedAnimation} 
                                            onChange={e => setSelectedAnimation(e.target.value)} 
                                            className="block w-full mt-1 p-1 text-xs border rounded"
                                        >
                                            <option value="none">None</option>
                                            <option value="bounce">Bounce</option>
                                            <option value="pulse">Pulse</option>
                                            <option value="spin">Spin (Crazy)</option>
                                            <option value="ping">Ping</option>
                                        </select>
                                    </div>
                                )}
                                <button onClick={() => setShowStylePanel(false)} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        {/* Style Toggle Button */}
                        {(currentUser.role === 'ADMIN' || (currentUser.subscriptionLevel === 'ULTRA' && currentUser.isPremium)) && (
                            <button 
                                onClick={() => setShowStylePanel(!showStylePanel)}
                                className={`p-3 rounded-xl transition-all ${showStylePanel ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                            >
                                <Palette size={20} />
                            </button>
                        )}

                        <input 
                            type="text" 
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            placeholder={
                                !statusCheck.allowed ? statusCheck.reason : 
                                activeTab === 'PRIVATE' ? "Message directly to Admin..." : "Message to Everyone..."
                            }
                            disabled={!statusCheck.allowed && !editingId} 
                            style={{ color: selectedColor !== '#000000' ? selectedColor : undefined }}
                            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={(!statusCheck.allowed && !editingId) || !inputText.trim()}
                            className={`p-3 rounded-xl transition-all ${
                                (!statusCheck.allowed && !editingId)
                                ? 'bg-slate-200 text-slate-400' 
                                : editingId 
                                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200'
                            }`}
                        >
                            {editingId ? <Edit2 size={20} /> : <Send size={20} />}
                        </button>
                    </div>
                </>
            )}
        </div>

        {showConfirm && (
            <CreditConfirmationModal 
                title="Send Message"
                cost={CHAT_COST}
                userCredits={currentUser.credits}
                isAutoEnabledInitial={!!currentUser.isAutoDeductEnabled}
                onCancel={() => setShowConfirm(false)}
                onConfirm={(auto) => processPaymentAndSend(auto)}
            />
        )}

        <CustomConfirm 
            isOpen={deleteConfirm.isOpen}
            title="Delete Message"
            message="Are you sure you want to delete this message?"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteConfirm({ isOpen: false, msgId: null })}
        />
    </div>
  );
};
