# How to Connect Your Own Firebase Account

Using the Admin Dashboard, you can switch the app's database connection without editing the code.

## Step 1: Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/).
2. Click **"Add project"** and give it a name (e.g., `MyStudentApp`).
3. Disable Google Analytics (optional) and click **Create**.

## Step 2: Enable Authentication
1. In your new project, go to **Build** -> **Authentication**.
2. Click **"Get Started"**.
3. Enable **Email/Password** provider.
4. Enable **Anonymous** provider (Important for Admin Login).

## Step 3: Create Databases
1. Go to **Build** -> **Firestore Database**.
2. Click **Create Database**. Select a location (e.g., `asia-southeast1` or `us-central1`).
3. Start in **Test Mode** (or Production, we will update rules later).
4. Go to **Build** -> **Realtime Database**.
5. Click **Create Database** and choose location.

## Step 4: Get Configuration
1. Click the **Gear Icon (Settings)** next to Project Overview -> **Project settings**.
2. Scroll down to "Your apps".
3. Click the **Web (</>)** icon.
4. Register app (enter any name).
5. You will see a code block `const firebaseConfig = { ... };`.
6. **Copy ONLY the object inside the curly braces.**

Example of what to copy:
```json
{
  "apiKey": "AIzaSy...",
  "authDomain": "myapp.firebaseapp.com",
  "projectId": "myapp",
  "storageBucket": "myapp.appspot.com",
  "messagingSenderId": "123456...",
  "appId": "1:123456...",
  "databaseURL": "https://myapp-default-rtdb.firebaseio.com"
}
```

## Step 5: Connect in App
1. Open your App.
2. Login as Admin.
3. Go to **Admin Console** -> **Config** -> **Security**.
4. Scroll down to **"Switch Database Connection"**.
5. Paste the JSON config you copied.
6. Click **"Connect New Database"**.
7. The app will reload and connect to your new Firebase account!

## Step 6: Set Security Rules
1. Go to **Firestore Database** -> **Rules** tab in Firebase Console.
2. Copy rules from the file `FIREBASE_RULES.md` in this project.
3. Paste and Publish.
4. Do the same for **Realtime Database** -> **Rules**.

**Done! You have successfully connected your own Firebase.**
