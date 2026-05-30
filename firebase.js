const firebaseConfig = {
    apiKey: "AIzaSyC9cisNcA7Cyw0z6h61ymkSgTB296onY1U",
    authDomain: "bookwriter-6155c.firebaseapp.com",
    projectId: "bookwriter-6155c",
    storageBucket: "bookwriter-6155c.firebasestorage.app",
    messagingSenderId: "825663635381",
    appId: "1:825663635381:web:2ac64588c98ffddcb623fc"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();

// Single document in Firestore that mirrors the localStorage structure
const FIRESTORE_REF = db.collection('bookwriter').doc('data');
