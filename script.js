document.addEventListener('DOMContentLoaded', () => {
    const derivLoginBtn = document.getElementById('deriv-login-btn');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.querySelector('.password-toggle');

    // Deriv OAuth configuration
    const app_id = '71979';
    const oauth_redirect_url = 'https://puocha.github.io/carpe_diem/oauth-callback';

    if (derivLoginBtn) {
        derivLoginBtn.addEventListener('click', () => {
            const deriv_oauth_url = `https://oauth.deriv.com/oauth2/authorize?app_id=${app_id}&l=en&brand=deriv&init_oauth=1&redirect_uri=${oauth_redirect_url}`;
            window.location.href = deriv_oauth_url;
        });
    }

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            passwordToggle.textContent = type === 'password' ? '👁️' : '🙈';
        });
    }

    // Placeholder for traditional login functionality (not implemented in this scope)
    const loginBtn = document.querySelector('.btn.log-in');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            alert('Traditional login not implemented. Please use "Continue with Deriv".');
        });
    }
}); 