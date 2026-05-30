// On local file:// (opening the folder directly on Mac) — skip auth.
// Auth only enforces on the hosted GitHub Pages URL.
if (window.location.protocol === 'file:') {
    document.body.style.visibility = 'visible';
} else {
    firebase.auth().onAuthStateChanged(user => {
        if (user) {
            document.body.style.visibility = 'visible';
            updateUserMenu(user);
        } else {
            window.location.replace('login.html');
        }
    });
}

function updateUserMenu(user) {
    const el = document.getElementById('userMenu');
    if (!el) return;
    el.innerHTML = `
        <span class="user-email">${escAuthHtml(user.displayName || user.email)}</span>
        <button class="text-link sign-out-btn" onclick="signOutUser()">Sign out</button>
    `;
}

function signOutUser() {
    firebase.auth().signOut().then(() => {
        window.location.replace('login.html');
    });
}

function escAuthHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
