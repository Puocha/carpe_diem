document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
        // In a real application, you would store this token securely (e.g., in localStorage or a cookie)
        // For this example, we'll just log it and redirect.
        console.log('Deriv Token:', token);
        localStorage.setItem('deriv_token', token);
        window.location.href = 'home.html'; // Redirect to your home page
    } else {
        console.error('No token found in URL.');
        // Optionally, redirect to an error page or back to login
        window.location.href = 'index.html';
    }
}); 