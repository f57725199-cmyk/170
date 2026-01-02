import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import { getFirestore, doc, setDoc, getDoc, collection, updateDoc, deleteDoc, onSnapshot, getDocs, query, where } from "firebase/firestore";
import { getDatabase, ref, set, get, onValue, update, remove } from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";

// --- FIREBASE CONFIGURATION (PROVIDED BY USER) ---
const defaultFirebaseConfig = {
  apiKey: "AIzaSyBaInERFrJ69Tl_w9f7BAOy60I3M1xKL1I",
  authDomain: "adim-85eeb.firebaseapp.com",
  projectId: "adim-85eeb",
  storageBucket: "adim-85eeb.firebasestorage.app",
  messagingSenderId: "682211593844",
  appId: "1:682211593844:web:08572e081118c755f4cb21",
  // Inferred from Project ID (Standard US Central). Update if region is different.
  databaseURL: "https://adim-85eeb-default-rtdb.firebaseio.com"
};

// --- DYNAMIC CONFIG LOADER (Allows Admin to Switch Backend) ---
const getActiveConfig = () => {
  try {
    const stored = localStorage.getItem('nst_firebase_config');
    if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.apiKey) return parsed; // Basic validation
    }
  } catch (e) {
    console.error("Invalid Custom Config", e);
  }
  return defaultFirebaseConfig;
};

const firebaseConfig = getActiveConfig();

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let analytics;
isSupported().then(yes => yes ? analytics = getAnalytics(app) : null);

const db = getFirestore(app);
const rtdb = getDatabase(app);
const auth = getAuth(app);

// --- EXPORTED HELPERS ---

export const checkFirebaseConnection = () => {
  return true; 
};

export const subscribeToAuth = (callback: (user: any) => void) => {
  return onAuthStateChanged(auth, (user) => {
    callback(user);
  });
};

// --- DUAL WRITE / SMART READ LOGIC ---

// 1. User Data Sync
export const saveUserToLive = async (user: any) => {
  try {
    if (!user || !user.id) return;
    
    // 1. RTDB
    const userRef = ref(rtdb, `users/${user.id}`);
    await set(userRef, user);
    
    // 2. Firestore (Dual Write)
    await setDoc(doc(db, "users", user.id), user);
  } catch (error) {
    console.error("Error saving user:", error);
  }
};

export const subscribeToUsers = (callback: (users: any[]) => void) => {
  // Switch to Realtime Database (RTDB) as Primary Source for Admin List
  // This solves the issue where Firestore Security Rules might hide documents from the list query
  // or where new users are only successfully written to RTDB due to client-side issues.
  console.log("Subscribing to Users via Realtime Database (Primary)...");
  
  const usersRef = ref(rtdb, 'users');
  const unsubscribe = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      const userList = data ? Object.values(data) : [];
      // Sort by Created At Descending (Newest First) if possible, or let Component handle it
      callback(userList);
  }, (error) => {
      console.error("RTDB Subscription Error:", error);
      // If RTDB fails, we could try Firestore as backup, but usually if RTDB fails, it's a network/auth issue affecting both.
  });

  return () => unsubscribe();
};

export const getUserData = async (userId: string) => {
    try {
        // Try RTDB
        const snap = await get(ref(rtdb, `users/${userId}`));
        if (snap.exists()) return snap.val();
        
        // Try Firestore
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) return docSnap.data();

        return null;
    } catch (e) { console.error(e); return null; }
};

export const getUserByEmail = async (email: string) => {
    try {
        const q = query(collection(db, "users"), where("email", "==", email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            return querySnapshot.docs[0].data();
        }
        return null; 
    } catch (e) { console.error(e); return null; }
};

// 2. System Settings Sync
export const saveSystemSettings = async (settings: any) => {
  try {
    await set(ref(rtdb, 'system_settings'), settings);
    await setDoc(doc(db, "config", "system_settings"), settings);
  } catch (error) {
    console.error("Error saving settings:", error);
  }
};

export const subscribeToSettings = (callback: (settings: any) => void) => {
  // Listen to Firestore
  return onSnapshot(doc(db, "config", "system_settings"), (docSnap) => {
      if (docSnap.exists()) {
          callback(docSnap.data());
      } else {
          // Fallback RTDB
           onValue(ref(rtdb, 'system_settings'), (snap) => {
               const data = snap.val();
               if (data) callback(data);
           }, { onlyOnce: true });
      }
  });
};

// 3. Content Links Sync (Bulk Uploads)
export const bulkSaveLinks = async (updates: Record<string, any>) => {
  try {
    // RTDB
    await update(ref(rtdb, 'content_links'), updates);
    
    // Firestore - We save each update as a document in 'content_data' collection
    // 'updates' is a map of key -> data
    const batchPromises = Object.entries(updates).map(async ([key, data]) => {
         await setDoc(doc(db, "content_data", key), data);
    });
    await Promise.all(batchPromises);

  } catch (error) {
    console.error("Error bulk saving links:", error);
  }
};

// 4. Chapter Data Sync (Individual)
export const saveChapterData = async (key: string, data: any) => {
  try {
    await set(ref(rtdb, `content_data/${key}`), data);
    await setDoc(doc(db, "content_data", key), data);
  } catch (error) {
    console.error("Error saving chapter data:", error);
  }
};

export const getChapterData = async (key: string) => {
    try {
        // 1. Try RTDB (Faster)
        const snapshot = await get(ref(rtdb, `content_data/${key}`));
        if (snapshot.exists()) {
            return snapshot.val();
        }
        
        // 2. Fallback to Firestore
        const docSnap = await getDoc(doc(db, "content_data", key));
        if (docSnap.exists()) {
            return docSnap.data();
        }
        
        return null;
    } catch (error) {
        console.error("Error getting chapter data:", error);
        return null;
    }
};

// Used by client to listen for realtime changes to a specific chapter
export const subscribeToChapterData = (key: string, callback: (data: any) => void) => {
    const rtdbRef = ref(rtdb, `content_data/${key}`);
    return onValue(rtdbRef, (snapshot) => {
        if (snapshot.exists()) {
            callback(snapshot.val());
        } else {
            // If not in RTDB, check Firestore (one-time fetch or snapshot?)
            // For now, let's just do one-time fetch to avoid complexity of double listeners
            getDoc(doc(db, "content_data", key)).then(docSnap => {
                if (docSnap.exists()) callback(docSnap.data());
            });
        }
    });
};


export const saveTestResult = async (userId: string, attempt: any) => {
    try {
        const docId = `${attempt.testId}_${Date.now()}`;
        await setDoc(doc(db, "users", userId, "test_results", docId), attempt);
    } catch(e) { console.error(e); }
};

export const updateUserStatus = async (userId: string, time: number) => {
     try {
        const userRef = ref(rtdb, `users/${userId}`);
        await update(userRef, { lastActiveTime: new Date().toISOString() });
    } catch (error) {
    }
};

export { app, db, rtdb, auth };
