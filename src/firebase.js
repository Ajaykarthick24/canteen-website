import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC6v74t0LrZBhkYlyo46ZrbZbBG-c0CCHE",
  authDomain: "campus-canteen-38f85.firebaseapp.com",
  projectId: "campus-canteen-38f85",
  storageBucket: "campus-canteen-38f85.firebasestorage.app",
  messagingSenderId: "264083955750",
  appId: "1:264083955750:web:a2e17a3109343e348946e7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);