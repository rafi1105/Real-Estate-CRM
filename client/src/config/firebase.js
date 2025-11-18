import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJDu_W26pc8vO5MJyxRWAkOvr4OVVBG-U",
  authDomain: "sintecproperty.firebaseapp.com",
  projectId: "sintecproperty",
  storageBucket: "sintecproperty.firebasestorage.app",
  messagingSenderId: "897249436494",
  appId: "1:897249436494:web:132111485378283644341f",
  measurementId: "G-YME6RCF1K9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Google Sign In
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return { success: true, user, idToken };
  } catch (error) {
    console.error("Google Sign In Error:", error);
    return { success: false, error: error.message };
  }
};

// Sign Out
export const firebaseSignOut = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error("Sign Out Error:", error);
    return { success: false, error: error.message };
  }
};

export { auth, googleProvider };
export default app;
