// src/services/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// The configuration you found earlier
const firebaseConfig = {
  apiKey: "AIzaSyDoUzSFMaLBaTerVsZg9gLZxW_bsyePXeo", 
  authDomain: "pulse-f591a.firebaseapp.com",
  projectId: "pulse-f591a",
  storageBucket: "pulse-f591a.firebasestorage.app",
  messagingSenderId: "756729713296",
  appId: "1:756729713296:web:0c75579fae58d1d95a3e15",
  measurementId: "G-T4XMKXTEY6"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;