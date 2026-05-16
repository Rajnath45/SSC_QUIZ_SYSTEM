/*
  Firebase client configuration for SSC Prep Hub.

  Replace the placeholder values below with your Firebase web app config:
  Firebase Console > Project settings > General > Your apps > Web app.

  This file is safe to deploy to Netlify. Firebase web config is public by
  design; real protection comes from Firebase Auth, Firestore Security Rules,
  and authorized domains in Firebase Authentication settings.
*/
export const firebaseConfig = {
  apiKey: "AIzaSyB89t8xT3x9S1UadEMHbmlUuCn1oqcwe3g",
  authDomain: "ssc-prep-hub-dfd23.firebaseapp.com",
  projectId: "ssc-prep-hub-dfd23",
  storageBucket: "ssc-prep-hub-dfd23.firebasestorage.app",
  messagingSenderId: "374902428027",
  appId: "1:374902428027:web:3e0b870f2af069c4bf6dde"
};

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(function (value) {
    return value && !String(value).startsWith("YOUR_");
  });
}
