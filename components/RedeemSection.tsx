import React, { useState } from 'react';
import { Gift, ArrowRight, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { User, GiftCode, SystemSettings } from '../types';
import { ref, get, update } from "firebase/database";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { rtdb, db, saveUserToLive } from "../firebase";
import { PrizeList } from './PrizeList';

interface Props {
  user: User;
  onSuccess: (updatedUser: User) => void;
  settings?: SystemSettings;
}

export const RedeemSection: React.FC<Props> = ({ user, onSuccess, settings }) => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [msg, setMsg] = useState('');
  const [activeTab, setActiveTab] = useState<'CODE' | 'ACTIVITY' | 'PRIZES'>('ACTIVITY');

  const handleRedeem = async () => {
    const cleanCode = code.trim();
    if (!cleanCode) return;
    setStatus('LOADING');
    
    try {
        let targetCode: any = null;
        let source = 'NONE';

        // 1. Check RTDB
        const codeRef = ref(rtdb, `redeem_codes/${cleanCode}`);
        const snapshot = await get(codeRef);
        
        if (snapshot.exists()) {
            targetCode = snapshot.val();
            source = 'RTDB';
        } else {
            // 2. Check Firestore
            try {
                const docRef = doc(db, "redeem_codes", cleanCode);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    targetCode = docSnap.data();
                    source = 'FIRESTORE';
                }
            } catch(e) { console.error("Firestore Code Check Error", e); }
        }

        if (!targetCode) {
            setStatus('ERROR');
            setMsg('Invalid Code. Please check and try again.');
            return;
        }
        
        // CHECK IF REDEEMED
        if (targetCode.isRedeemed) {
            setStatus('ERROR');
            setMsg('This code has already been redeemed.');
            return;
        }

        // CHECK IF ALREADY USED BY THIS USER (For Multi-Use Codes)
        const redeemedList = Array.isArray(targetCode.redeemedBy) ? targetCode.redeemedBy : (targetCode.redeemedBy ? [targetCode.redeemedBy] : []);
        if (redeemedList.includes(user.id)) {
            setStatus('ERROR');
            setMsg('You have already used this code.');
            return;
        }

        // CHECK MAX USES
        const maxUses = targetCode.maxUses || 1;
        const currentUses = targetCode.usedCount || 0;
        
        if (currentUses >= maxUses) {
            setStatus('ERROR');
            setMsg('This code has reached its maximum usage limit.');
            return;
        }

        // Success Logic - Update Count & Add User
        const newUsedCount = currentUses + 1;
        const isFullyRedeemed = newUsedCount >= maxUses;
        const newRedeemedBy = [...redeemedList, user.id];

        const updatePayload = { 
            isRedeemed: isFullyRedeemed, 
            usedCount: newUsedCount,
            redeemedBy: newRedeemedBy 
        };

        if (source === 'RTDB') {
            await update(codeRef, updatePayload);
            try { await updateDoc(doc(db, "redeem_codes", cleanCode), updatePayload); } catch(e){}
        } else {
            await updateDoc(doc(db, "redeem_codes", cleanCode), updatePayload);
            try { await update(codeRef, updatePayload); } catch(e){}
        }

        // 3. Update User Credits
        const newCredits = (user.credits || 0) + targetCode.amount;
        const updatedUser = { 
            ...user, 
            credits: newCredits, 
            redeemedCodes: [...(user.redeemedCodes || []), targetCode.code] 
        };
        
        // Save User immediately to global storage & Cloud
        const allUsersStr = localStorage.getItem('nst_users');
        if (allUsersStr) {
            const allUsers: User[] = JSON.parse(allUsersStr);
            const userIdx = allUsers.findIndex(u => u.id === user.id);
            if (userIdx !== -1) {
                allUsers[userIdx] = updatedUser;
                localStorage.setItem('nst_users', JSON.stringify(allUsers));
            }
        }
        localStorage.setItem('nst_current_user', JSON.stringify(updatedUser));
        await saveUserToLive(updatedUser); // छात्र को क्रेडिट दें

        setStatus('SUCCESS');
        setMsg(`Success! Added ${targetCode.amount} Premium Notes.`);
        setCode('');
        onSuccess(updatedUser);
        
        setTimeout(() => {
            setStatus('IDLE');
            setMsg('');
        }, 3000);

    } catch (e) {
        setStatus('ERROR');
        setMsg('Connection Error. Please try again.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
        {/* TABS */}
        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
            <button onClick={() => setActiveTab('ACTIVITY')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'ACTIVITY' ? 'bg-slate-900 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Activity Rewards</button>
            <button onClick={() => setActiveTab('PRIZES')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'PRIZES' ? 'bg-yellow-500 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Prize List</button>
            <button onClick={() => setActiveTab('CODE')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${activeTab === 'CODE' ? 'bg-purple-600 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}>Redeem Code</button>
        </div>

        {/* PRIZE LIST */}
        {activeTab === 'PRIZES' && <PrizeList />}

        {/* ACTIVITY REWARDS LIST */}
        {activeTab === 'ACTIVITY' && (
            <div className="space-y-3">
                <div className="flex items-center gap-2 px-1 mb-2">
                    <Clock size={18} className="text-slate-400" />
                    <h3 className="font-bold text-slate-700">Daily Study Milestones</h3>
                </div>
                {settings?.engagementRewards?.map((rew, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="font-bold text-slate-800 text-sm mb-1">{rew.label}</p>
                            <p className="text-xs text-slate-400 font-medium">Target: {Math.floor(rew.seconds/60)} Minutes</p>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black shadow-sm ${rew.type === 'COINS' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-purple-100 text-purple-700 border border-purple-200'}`}>
                            {rew.type === 'COINS' ? `+${rew.amount} Coins` : 'Free Sub'}
                        </span>
                    </div>
                ))}
                {(!settings?.engagementRewards || settings.engagementRewards.length === 0) && (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-slate-400 text-sm">No activity rewards configured.</p>
                    </div>
                )}
            </div>
        )}

        {/* REDEEM CODE FORM */}
        {activeTab === 'CODE' && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                        <Gift size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">Redeem Gift Code</h3>
                        <p className="text-xs text-slate-500">Have a code from Admin? Enter it here.</p>
                    </div>
                </div>
                
                <div className="relative">
                    <input 
                        type="text" 
                        placeholder="Enter 20-digit Code..." 
                        value={code}
                        onChange={e => setCode(e.target.value)}
                        className="w-full pl-4 pr-12 py-3 border-2 border-slate-100 rounded-xl font-mono text-slate-700 focus:outline-none focus:border-purple-500 transition-colors"
                    />
                    <button 
                        onClick={handleRedeem}
                        disabled={status === 'LOADING' || !code}
                        className="absolute right-2 top-2 bottom-2 bg-purple-600 text-white p-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                    >
                        <ArrowRight size={20} />
                    </button>
                </div>

                {status === 'ERROR' && (
                    <div className="mt-3 flex items-center gap-2 text-red-500 text-sm font-medium animate-in slide-in-from-top-1">
                        <AlertCircle size={16} /> {msg}
                    </div>
                )}
                
                {status === 'SUCCESS' && (
                    <div className="mt-3 flex items-center gap-2 text-green-600 text-sm font-medium animate-in slide-in-from-top-1">
                        <CheckCircle size={16} /> {msg}
                    </div>
                )}
            </div>
        )}
    </div>
  );
};