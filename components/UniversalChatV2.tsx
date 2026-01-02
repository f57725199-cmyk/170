
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage, SystemSettings } from '../types';
import { Send, Trash2, Edit2, Shield, User as UserIcon, Lock, Globe, ArrowLeft } from 'lucide-react';
import { CreditConfirmationModal } from './CreditConfirmationModal';
import { CustomConfirm } from './CustomDialogs';
import { rtdb } from '../firebase';
import { ref, onValue, push, set, update, remove } from "firebase/database";

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

export const UniversalChatV2: React.FC<Props> = ({ currentUser, onUserUpdate, isAdminView = false, settings }) => {
  const [activeTab, setActiveTab] = useState<'UNIVERSAL' | 'PRIVATE'>('UNIVERSAL');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  
  // Custom Dialog Config
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, msgId: string | null}>({isOpen: false, msgId: null});

  // Student Input State
  const [sendToAdmin, setSendToAdmin] = useState(false); 

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
  }, [CHAT_MODE]);

  // SETUP LISTENER
  useEffect(() => {
      let chatPath = '';

      if (isAdminView) {
          if (activeTab === 'UNIVERSAL') {
              chatPath = 'universal_chat';
          } else {
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
                  const msgList: ChatMessage[] = Object.values(data);
                  setMessages(msgList.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
              } else {
                  setMessages([]);
              }
          });
          return () => unsub();
      }
  }, [isAdminView, currentUser.id, activeTab]);

  // ADMIN: Listen to Selected Student Chat
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
      if (currentUser.isChatBanned) return { allowed: false, reason: "You are banned from chat." };
      if (!IS_ENABLED && activeTab === 'UNIVERSAL') return { allowed: false, reason: "Chat Disabled by Admin" };
      if (IS_FREE_MODE) return { allowed: true }; 
      if (currentUser.isPremium) return { allowed: true };
      if (currentUser.credits < CHAT_COST) return { allowed: false, reason: `Insufficient Credits (Need ${CHAT_COST})` };
      
      if (currentUser.lastChatTime) {
          const lastTime = new Date(currentUser.lastChatTime).getTime();
          const now = Date.now();
          const diffHours = (now - lastTime) / (1000 * 60 * 60);
          if (diffHours < COOLDOWN_HOURS) return { allowed: false, reason: `Wait ${(COOLDOWN_HOURS - diffHours).toFixed(1)} hrs` };
      }
      return { allowed: true };
  };

  const handleSend = () => {
      if (!inputText.trim()) return;
      setErrorMsg(null);

      const check = canSendMessage();
      if (!check.allowed) {
          setErrorMsg(check.reason || "Restriction Active");
          return;
      }

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
          const isDirectToAdmin = CHAT_MODE === 'PRIVATE_ONLY' || (CHAT_MODE === 'BOTH' && sendToAdmin);
          if (isDirectToAdmin) targetPath = `chats/${currentUser.id}/messages`;
          else targetPath = 'universal_chat';
      }

      if (editingId) {
           const msgRef = ref(rtdb, `${targetPath}/${editingId}`);
           await update(msgRef, { text: inputText });
           setEditingId(null);
      } else {
          const newMsgRef = push(ref(rtdb, targetPath));
          const newMessage: ChatMessage = {
              id: newMsgRef.key as string,
              userId: currentUser.id,
              userName: currentUser.name,
              userRole: currentUser.role,
              text: inputText,
              timestamp: new Date().toISOString()
          };
          await set(newMsgRef, newMessage);

          if (!isAdminView && (CHAT_MODE === 'PRIVATE_ONLY' || (CHAT_MODE === 'BOTH' && sendToAdmin))) {
               const metaRef = ref(rtdb, `chats/${currentUser.id}`);
               await update(metaRef, { studentName: currentUser.name });
          }
      }
      setInputText('');
  };

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

  const statusCheck = canSendMessage();

  // --- RENDER ADMIN LIST VIEW ---
  if (isAdminView && activeTab === 'PRIVATE' && !selectedStudentId) {
      return (
          <div className="flex flex-col h-[80vh] bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
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
                               <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500"><UserIcon size={20} /></div>
                               <div><p className="font-bold text-slate-700">{session.studentName}</p><p className="text-xs text-slate-500 truncate w-48">{session.lastMessage}</p></div>
                           </div>
                           <div className="text-right"><p className="text-[10px] text-slate-400">{new Date(session.timestamp || 0).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</p></div>
                       </div>
                   ))}
               </div>
          </div>
      );
  }

  // --- RENDER MAIN CHAT (V2: Clean WhatsApp/Snapchat Style) ---
  return (
    <div className={`flex flex-col h-[80vh] bg-[#f0f2f5] rounded-xl shadow-lg overflow-hidden border border-slate-200 ${isAdminView ? '' : 'max-w-4xl mx-auto'}`}>
        {/* Header */}
        <div className="bg-white px-4 py-3 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
                {isAdminView && selectedStudentId && <button onClick={() => setSelectedStudentId(null)} className="p-1 rounded-full hover:bg-slate-100"><ArrowLeft size={20} /></button>}
                <div>
                    <h3 className="font-bold text-slate-800 text-sm">Universal Chat 2.0</h3>
                    <p className="text-[10px] text-slate-500">{activeTab === 'UNIVERSAL' ? 'Public Group' : 'Admin Support'}</p>
                </div>
            </div>
            
            {(CHAT_MODE === 'BOTH' || isAdminView) && (
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    {(isAdminView || CHAT_MODE === 'BOTH' || CHAT_MODE === 'UNIVERSAL_ONLY') && (
                        <button onClick={() => { setActiveTab('UNIVERSAL'); setSelectedStudentId(null); }} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'UNIVERSAL' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>Group</button>
                    )}
                    {(isAdminView || CHAT_MODE === 'BOTH' || CHAT_MODE === 'PRIVATE_ONLY') && (
                        <button onClick={() => setActiveTab('PRIVATE')} className={`px-3 py-1 text-xs font-bold rounded ${activeTab === 'PRIVATE' ? 'bg-white shadow text-purple-600' : 'text-slate-500'}`}>Admin</button>
                    )}
                </div>
            )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#e5ddd5] bg-opacity-30">
            {messages.map((msg) => {
                const isMe = msg.userId === currentUser.id;
                const isAdminMsg = msg.userRole === 'ADMIN';
                
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
                         <div className={`max-w-[75%] px-3 py-1.5 rounded-lg text-sm relative group shadow-sm ${
                             isMe 
                             ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-none' 
                             : 'bg-white text-slate-800 rounded-tl-none'
                         }`}>
                             {/* Sender Name */}
                             {!isMe && (
                                 <p className={`text-[10px] font-bold mb-0.5 ${isAdminMsg ? 'text-green-600' : 'text-orange-500'}`}>
                                     {isAdminMsg ? 'Admin' : msg.userName || msg.userId}
                                     {isAdminMsg && <span className="ml-1 text-[8px] bg-green-100 text-green-700 px-1 rounded">OFFICIAL</span>}
                                 </p>
                             )}
                             
                             <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                             
                             <div className="flex justify-end items-center gap-1 mt-0.5">
                                 <span className="text-[9px] text-slate-400">
                                     {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                 </span>
                             </div>

                             {currentUser.role === 'ADMIN' && (
                                 <button onClick={() => requestDelete(msg.id)} className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow border opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-50 transition-opacity">
                                     <Trash2 size={10} />
                                 </button>
                             )}
                         </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-2 bg-[#f0f2f5] flex items-center gap-2">
            {!statusCheck.allowed ? (
                <div className="flex-1 text-center text-xs text-red-500 font-bold p-2 bg-white rounded-lg border border-red-100">
                    {statusCheck.reason}
                </div>
            ) : (
                <>
                    <input 
                        type="text" 
                        value={inputText}
                        onChange={e => setInputText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message"
                        className="flex-1 px-4 py-2 bg-white rounded-full border-none focus:outline-none focus:ring-1 focus:ring-green-500 text-sm"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!inputText.trim()}
                        className="p-2 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={18} />
                    </button>
                </>
            )}
        </div>
        
        {/* Cost Indicator */}
        {!currentUser.isPremium && CHAT_COST > 0 && !isAdminView && (
            <div className="bg-[#f0f2f5] px-4 pb-2 text-[10px] text-slate-500 text-right">
                Message Cost: {CHAT_COST} CR • Balance: {currentUser.credits} CR
            </div>
        )}

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
            message="Are you sure?"
            onConfirm={confirmDelete}
            onCancel={() => setDeleteConfirm({ isOpen: false, msgId: null })}
        />
    </div>
  );
};
