document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const derivAccounts = [];
    let primaryTokenFound = false; // Flag to check if at least one token is found

    // Iterate through all parameters to find tokens, account IDs, and currencies
    params.forEach((value, key) => {
        const matchToken = key.match(/^token(\d+)$/);
        if (matchToken) {
            const index = matchToken[1];
            const accountId = params.get(`acct${index}`);
            const currency = params.get(`cur${index}`);

            if (value && accountId && currency) {
                derivAccounts.push({
                    token: value,
                    account_id: accountId,
                    currency: currency
                });
                primaryTokenFound = true; // Mark that at least one token was found
            }
        }
    });

    // Also check for a generic 'token' parameter if no indexed tokens are found
    if (!primaryTokenFound) {
        const genericToken = params.get('token');
        if (genericToken) {
            derivAccounts.push({
                token: genericToken,
                account_id: 'unknown', // Or handle this case specifically if no acct/cur is provided
                currency: 'unknown'
            });
            primaryTokenFound = true;
        }
    }

    if (primaryTokenFound && derivAccounts.length > 0) {
        console.log('Deriv Accounts:', derivAccounts);
        localStorage.setItem('deriv_accounts', JSON.stringify(derivAccounts));
        // Optionally, you might want to store the currently active token or account ID separately
        // For now, we'll just redirect to home.
        window.location.href = 'home.html';
    } else {
        console.error('No Deriv tokens or account information found in URL.');
        window.location.href = 'index.html';
    }
}); 