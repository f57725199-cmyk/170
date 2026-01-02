import React, { useState, useMemo } from 'react';
import { User, SystemSettings } from '../types';
import { Trophy, Zap, Star, Lock } from 'lucide-react';
import { CustomAlert } from './CustomDialogs';

interface Props {
  user: User;
  onUpdateUser: (user: User) => void;
  settings?: SystemSettings;
}

export const SpinWheel: React.FC<Props> = ({ user, onUpdateUser, settings }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultMessage, setResultMessage] = useState<React.ReactNode | null>(null);
  const [alertConfig, setAlertConfig] = useState<{isOpen: boolean, message: string}>({isOpen: false, message: ''});

  // --- CONFIG ---
  const rewardValues = settings?.wheelRewards && settings.wheelRewards.length > 0 
      ? settings.wheelRewards 
      : [0, 1, 2, 5, 10]; 
  
  const cost = settings?.gameCost || 0;

  // --- DAILY LIMIT LOGIC ---
  const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  const dailyLimit = useMemo(() => {
      // 1. If not premium, use Free limit
      if (!user.isPremium) return settings?.spinLimitFree || 2;
      
      // 2. If Granted by Admin (Reward), use Free limit
      if (user.grantedByAdmin) return settings?.spinLimitFree || 2;
      
      // 3. Real Premium
      if (user.subscriptionLevel === 'ULTRA') return settings?.spinLimitUltra || 10;
      return settings?.spinLimitBasic || 5;
  }, [user, settings]);

  const spinsUsed = user.dailySpinDate === todayStr ? (user.dailySpinCount || 0) : 0;
  const remainingSpins = Math.max(0, dailyLimit - spinsUsed);
  const canSpin = remainingSpins > 0;

  // ... Segments Logic ...
  const SEGMENT_COUNT = 12;
  const SEGMENT_ANGLE = 360 / SEGMENT_COUNT;
  const wheelSegments = useMemo(() => {
      const segs = [];
      const colors = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316', '#fbbf24'];
      for (let i = 0; i < SEGMENT_COUNT; i++) {
          const val = rewardValues[i % rewardValues.length];
          const isJackpot = val >= 50;
          segs.push({
              value: val,
              color: isJackpot ? '#fbbf24' : colors[i % colors.length],
              text: isJackpot ? '#78350f' : '#ffffff',
              label: val === 0 ? '0' : `${val} CR`
          });
      }
      return segs;
  }, [rewardValues]);

  const prizeProbabilities = useMemo(() => {
      return rewardValues.map(val => ({
          value: val,
          weight: Math.floor(10000 / (val + 1)) 
      }));
  }, [rewardValues]);
  const totalWeight = prizeProbabilities.reduce((acc, curr) => acc + curr.weight, 0);

  const handleSpin = () => {
    if (!canSpin || isSpinning) return;
    if (cost > 0 && user.credits < cost) {
        setAlertConfig({isOpen: true, message: `Insufficient Credits! You need ${cost} Credits to spin.`});
        return;
    }

    setIsSpinning(true);
    setResultMessage(null);

    // 1. Calculate Result
    let randomNum = Math.random() * totalWeight;
    let wonCredits = 0;
    for (const prize of prizeProbabilities) {
        if (randomNum < prize.weight) {
            wonCredits = prize.value;
            break;
        }
        randomNum -= prize.weight;
    }

    // 2. Find Segment
    const validIndices = wheelSegments
        .map((seg, idx) => seg.value === wonCredits ? idx : -1)
        .filter(idx => idx !== -1);
    const winningIndex = validIndices.length > 0 
        ? validIndices[Math.floor(Math.random() * validIndices.length)] 
        : 0;

    // 3. Rotate
    const extraSpins = 360 * 6; 
    const segmentOffset = Math.floor(Math.random() * (SEGMENT_ANGLE - 4)) + 2; 
    const finalRotation = extraSpins + (360 - (winningIndex * SEGMENT_ANGLE)) + segmentOffset;

    setRotation(prev => prev + finalRotation);

    setTimeout(() => {
      setIsSpinning(false);
      
      let msg: React.ReactNode;
      if (wonCredits > 0) {
        const isJackpot = wonCredits >= 50;
        msg = (
            <div className="flex flex-col items-center">
                <div className="text-4xl mb-2">{isJackpot ? '🎉💎🎉' : '🎉'}</div>
                <div className={`text-xl font-black ${isJackpot ? 'text-orange-500' : 'text-green-600'}`}>
                    You won {wonCredits} Credits!
                </div>
            </div>
        );
      } else {
        msg = (
            <div className="flex flex-col items-center">
                <div className="text-4xl mb-2">😢</div>
                <div className="text-lg font-bold text-slate-600">Bad Luck!</div>
            </div>
        );
      }
      setResultMessage(msg);
      
      // Update User
      const updatedUser = { 
          ...user, 
          credits: (user.credits || 0) + wonCredits - cost, 
          dailySpinDate: todayStr,
          dailySpinCount: spinsUsed + 1,
          lastSpinTime: new Date().toISOString() 
      };
      onUpdateUser(updatedUser);

    }, 5000); 
  };

  return (
    <div className="flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in duration-500">
      <CustomAlert 
          isOpen={alertConfig.isOpen} 
          message={alertConfig.message} 
          onClose={() => setAlertConfig({...alertConfig, isOpen: false})} 
      />
      <div className="text-center mb-8 relative">
          <h2 className="text-3xl font-black text-slate-800 flex items-center justify-center gap-2">
              <span className="text-4xl">🎰</span> Spin & Win
          </h2>
          <div className="flex items-center justify-center gap-2 mt-2">
               <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${cost === 0 ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}>
                   {cost === 0 ? 'Free Entry' : `Cost: ${cost} CR`}
               </span>
               <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-200">
                   {remainingSpins} Spins Left
               </span>
          </div>
      </div>

      <div className="relative w-80 h-80 mb-10">
        <div className="absolute -inset-4 rounded-full bg-gradient-to-b from-slate-200 to-slate-50 border-4 border-slate-300 shadow-xl flex items-center justify-center">
             <div className="w-full h-full rounded-full border-4 border-dashed border-slate-300 opacity-50 animate-spin-slow" style={{ animationDuration: '20s' }}></div>
        </div>
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-20 w-10 h-12">
            <div className="w-full h-full bg-red-600 rounded-lg shadow-lg relative border-2 border-white">
                <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-red-600"></div>
            </div>
        </div>
        <div 
            className="w-full h-full rounded-full border-8 border-slate-800 bg-slate-800 shadow-2xl relative overflow-hidden transition-transform cubic-bezier(0.1, 0.7, 1.0, 0.1)"
            style={{ 
                transform: `rotate(${rotation}deg)`,
                transitionDuration: isSpinning ? '5s' : '0s',
                transitionTimingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1)' 
            }}
        >
            {wheelSegments.map((seg, idx) => {
                const rotation = idx * SEGMENT_ANGLE;
                return (
                    <div 
                        key={idx}
                        className="absolute top-0 left-1/2 w-[50%] h-[50%] origin-bottom-left"
                        style={{
                            transform: `rotate(${rotation}deg) skewY(-${90 - SEGMENT_ANGLE}deg)`,
                            transformOrigin: '0% 100%', 
                        }}
                    >
                        <div 
                           className="absolute inset-0 w-full h-full border-r border-slate-900/10"
                           style={{ 
                               backgroundColor: seg.color,
                               transform: `skewY(${90 - SEGMENT_ANGLE}deg)`, 
                               transformOrigin: '0% 100%'
                           }}
                        >
                            <div 
                                className="absolute top-[15%] left-[50%] -translate-x-1/2 font-black text-lg"
                                style={{ 
                                    color: seg.text,
                                    transform: `rotate(${SEGMENT_ANGLE/2}deg)`, 
                                    textShadow: '0px 1px 2px rgba(0,0,0,0.3)'
                                }}
                            >
                                <span className={seg.value >= 50 ? 'text-xl' : 'text-lg'}>{seg.label}</span>
                                {seg.value >= 50 && <Star size={12} className="inline ml-1 mb-1 fill-current" />}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
        <div className="absolute inset-0 m-auto w-16 h-16 bg-gradient-to-br from-white to-slate-200 rounded-full shadow-[0_0_15px_rgba(0,0,0,0.2)] flex items-center justify-center z-10 border-4 border-slate-100">
            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shadow-inner">
                <Trophy className="text-yellow-400 drop-shadow-md" size={18} fill="currentColor" />
            </div>
        </div>
      </div>

      {resultMessage && (
          <div className="mb-8 p-6 rounded-2xl bg-white border-2 border-slate-100 shadow-xl text-center animate-bounce w-full max-w-xs relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
              {resultMessage}
          </div>
      )}

      {canSpin ? (
        <button
          onClick={handleSpin}
          disabled={isSpinning || (cost > 0 && user.credits < cost)}
          className="relative group bg-gradient-to-b from-yellow-400 to-orange-500 text-white text-xl font-black px-16 py-4 rounded-full shadow-[0_6px_0_#c2410c] active:shadow-[0_2px_0_#c2410c] active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
        >
          <span className="relative z-10 drop-shadow-md tracking-wider flex items-center gap-2">
             {isSpinning ? 'GOOD LUCK...' : (cost > 0 ? `SPIN (${cost} CR)` : 'SPIN NOW')} 
             {!isSpinning && <Zap fill="white" size={20} />}
          </span>
          <div className="absolute top-0 -left-full w-full h-full bg-white/30 -skew-x-12 group-hover:left-full transition-all duration-700 ease-in-out"></div>
        </button>
      ) : (
        <div className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-lg flex flex-col items-center border border-slate-700 w-full max-w-xs">
             <div className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1 tracking-widest">
                 <Lock size={12} /> Daily Limit Reached
             </div>
             <div className="text-xl font-bold text-yellow-400 tracking-wider">
                 {spinsUsed}/{dailyLimit} Used
             </div>
             <div className="mt-2 text-[10px] text-slate-500">Come back tomorrow!</div>
        </div>
      )}
    </div>
  );
};
