# Optimized Firebase Security Rules

Agar aap chahte hain ki **Admin ko Students ka banaya hua sara account dikhai de**, to ye rules copy karke Firebase Console me paste karein.

## 1. Cloud Firestore Rules
Go to **Firebase Console** -> **Firestore Database** -> **Rules**.

Ye rules ensure karte hain ki:
1. **Admin** sare users (Students) ki list dekh sake.
2. **Student** sirf apna data dekh/likh sake.
3. **Data Secure** rahe.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // --- Helper Functions (Logic) ---
    
    // Check if the user is an ADMIN
    function isAdmin() {
      return request.auth != null && 
             exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
             get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == "ADMIN";
    }

    // Check if the user is accessing their own data
    function isOwner(userId) {
      return request.auth != null && request.auth.uid == userId;
    }

    // ==================================================

    // 1. USERS COLLECTION (Admin ko sab dikhega)
    match /users/{userId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId) || isAdmin();
    }

    // 2. USER TEST RESULTS
    match /users/{userId}/test_results/{resultId} {
      allow read: if isOwner(userId) || isAdmin();
      allow write: if isOwner(userId) || isAdmin();
    }

    // 3. CONTENT DATA (Chapters, Videos - Public Read, Admin Write)
    match /content_data/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 4. APP CONFIG & SETTINGS
    match /config/{docId} {
      allow read: if true;
      allow write: if isAdmin();
    }

    // 5. CATCH-ALL (Any other collection requires Admin)
    match /{path=**} {
      allow read, write: if isAdmin();
    }
  }
}
```

---

## 2. Realtime Database Rules (RTDB)
Go to **Firebase Console** -> **Realtime Database** -> **Rules**.

Ye rules Admin ko permission dete hain pure `users` folder ko read karne ki.

```json
{
  "rules": {
    "users": {
      // ADMIN poori list padh sakta hai (Yeh zaroori hai "Sara Account" dekhne ke liye)
      ".read": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'ADMIN'",
      
      "$uid": {
        // Student sirf apna account padh/likh sakta hai
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid || root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
      }
    },
    
    "content_data": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    
    "content_links": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    
    "system_settings": {
      ".read": true,
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'ADMIN'"
    },
    
    "redeem_codes": {
      ".read": true,
      ".write": true
    },
    
    "recovery_requests": {
      ".read": true,
      ".write": true
    }
  }
}
```

### Important Steps after Pasting:
1. **Publish** button pe click karein.
2. Ensure karein ki aapka (Admin) account database me exist karta hai aur uska `role: "ADMIN"` set hai. (App ka naya login system ye automatic kar deta hai).
