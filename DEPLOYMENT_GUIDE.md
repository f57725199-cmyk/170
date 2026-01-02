# IIC ONLINE CLASSES App Deployment Guide

This guide will help you set up Firebase (Database) and Deploy your app to the internet (Vercel).

## Phase 1: Firebase Setup (Database)

This app uses **Google Firebase** to store user data, admin content, and settings online.

1.  **Create Account:** Go to [firebase.google.com](https://firebase.google.com/) and sign in with your Google Account.
2.  **Create Project:**
    *   Click "Go to Console" -> "Add Project".
    *   Name it (e.g., `nst-app-live`).
    *   Disable Google Analytics (optional, easier if disabled) -> Create Project.
3.  **Enable Authentication (Login System):**
    *   In the sidebar, click **Build** -> **Authentication**.
    *   Click "Get Started".
    *   (You don't need to enable specific providers if using just custom user logic, but enabling Email/Password is good practice for future).
4.  **Enable Firestore (User Database):**
    *   In the sidebar, click **Build** -> **Firestore Database**.
    *   Click "Create Database".
    *   Choose a location (e.g., `asia-south1` for India).
    *   **Rules:** Start in **Test Mode** (allow all reads/writes for now).
        *   *Warning:* In production, you should secure these rules.
5.  **Enable Realtime Database (Content & Settings):**
    *   In the sidebar, click **Build** -> **Realtime Database**.
    *   Click "Create Database".
    *   Choose location (United States or Belgium/Singapore).
    *   **Rules:** Start in **Test Mode**.
6.  **Get Configuration:**
    *   Click the **Gear Icon** (Project Settings) next to "Project Overview" in the sidebar.
    *   Scroll down to "Your apps" -> Click the **</> (Web)** icon.
    *   Register app (Name: "NST Web").
    *   Copy the `firebaseConfig` object (apiKey, authDomain, etc.).

## Phase 2: Connect Code to Firebase

1.  Open the file `firebase.ts` in this project.
2.  Replace the `firebaseConfig` variable with the new keys you just copied.

```typescript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project...firebaseio.com",
  projectId: "your-project",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

## Phase 3: Deploy to Internet (Vercel)

Vercel is the best place to host React apps for free.

1.  **Create GitHub Repository (if not already done):**
    *   Go to [github.com/new](https://github.com/new).
    *   Name it `nst-app`.
    *   Upload all your project files to this repository.
2.  **Deploy on Vercel:**
    *   Go to [vercel.com](https://vercel.com/) and Sign Up.
    *   Click "Add New..." -> "Project".
    *   Select your GitHub repository (`nst-app`).
    *   Click **Deploy**.
3.  **Wait:** Vercel will build your app (takes ~1 minute).
4.  **Done:** You will get a link like `https://nst-app.vercel.app`. Share this with students!

## Phase 4: Admin Setup

1.  Open your new App Link.
2.  Log in (or Sign Up if you removed the default data).
3.  If you need to become Admin:
    *   Open your browser console (F12) or use the "Secret Admin Login" if you built one.
    *   **Easier way:** Go to Firebase Console -> Firestore Database -> `users` collection.
    *   Find your user document.
    *   Change the `role` field to `"ADMIN"`.
4.  Refresh the app. You now have full Admin access.

## Troubleshooting

*   **"Disconnected" Status:** Ensure your `firebase.ts` config is correct and matches the project you created.
*   **White Screen:** Check the browser Console (F12) for errors.
*   **Data Not Saving:** Check Firebase "Rules" tab. Ensure they are set to `true` (read/write allowed) for Test Mode.
