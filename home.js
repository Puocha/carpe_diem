document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const profileIconContainer = document.querySelector('.profile-icon-container');
    const profileDropdown = document.getElementById('profile-dropdown');
    const dropdownAccountSelect = document.getElementById('dropdown-account-select');
    const dropdownAccountIdSpan = document.getElementById('dropdown-account-id');
    const dropdownAccountCurrencySpan = document.getElementById('dropdown-account-currency');
    const dropdownAccountBalanceSpan = document.getElementById('dropdown-account-balance');
    const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
    const headerAccountTypeSpan = document.getElementById('header-account-type');
    const headerAccountBalanceSpan = document.getElementById('header-account-balance');
    
    // Event Listeners
    profileIconContainer.addEventListener('click', (event) => {
        event.stopPropagation();
        profileDropdown.classList.toggle('show');
    });
    
    profileDropdown.addEventListener('click', (event) => {
        event.stopPropagation();
    });
    
    document.addEventListener('click', (event) => {
        if (!profileIconContainer.contains(event.target) && profileDropdown.classList.contains('show')) {
            profileDropdown.classList.remove('show');
        }
    });
    
    let derivAccounts = JSON.parse(localStorage.getItem('deriv_accounts')) || [];
    let activeAccountIndex = localStorage.getItem('active_deriv_account_index') || 0;

    // Ensure activeAccountIndex is within bounds
    if (activeAccountIndex >= derivAccounts.length) {
        activeAccountIndex = 0;
        localStorage.setItem('active_deriv_account_index', 0); // Reset if out of bounds
    }

    if (derivAccounts.length > 0) {
        // WebSocket connection
        let ws;

        function connectWebSocket() {
            if (ws && ws.readyState === WebSocket.OPEN) {
                console.log("WebSocket already open.");
                return;
            }
            console.log("Attempting to connect WebSocket...");
            ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=71979');
            window.derivWs = ws; // Make it globally accessible for logout

            ws.onopen = (event) => {
                console.log('WebSocket Connected', event);
                authorizeAndFetchBalance(derivAccounts[activeAccountIndex]);
            };

            ws.onmessage = (msg) => {
                const response = JSON.parse(msg.data);
                console.log('Received:', response);

                if (response.msg_type === 'authorize') {
                    if (response.error) {
                        console.error('Authorization error:', response.error);
                        dropdownAccountBalanceSpan.textContent = 'Auth Error';
                        headerAccountBalanceSpan.textContent = 'Auth Error';
                    } else {
                        console.log('Authorized successfully for account:', response.authorize.loginid);
                        // Store account type (real/demo) in the account object
                        const currentAccount = derivAccounts[activeAccountIndex];
                        currentAccount.account_type = response.authorize.is_virtual ? 'Demo' : 'Real';
                        // Update the active account in localStorage to reflect the type
                        localStorage.setItem('deriv_accounts', JSON.stringify(derivAccounts));

                        // Once authorized, request balance
                        ws.send(JSON.stringify({ "balance": 1, "account": response.authorize.loginid }));
                        updateDisplayedAccount(currentAccount); // Update display with type
                    }
                } else if (response.msg_type === 'balance') {
                    if (response.error) {
                        console.error('Balance error:', response.error);
                        dropdownAccountBalanceSpan.textContent = 'Balance Error';
                        headerAccountBalanceSpan.textContent = 'Balance Error';
                    } else {
                        const currentAccount = derivAccounts[activeAccountIndex];
                        currentAccount.balance = response.balance.balance;
                        currentAccount.currency = response.balance.currency;
                        localStorage.setItem('deriv_accounts', JSON.stringify(derivAccounts));
                        updateDisplayedAccount(currentAccount); // Update display with balance
                    }
                } else if (response.msg_type === 'active_symbols') {
                    // Handle active symbols if needed, but not required for this task
                }
            };

            ws.onclose = (event) => {
                console.log('WebSocket Closed', event);
                // Attempt to reconnect if closed unexpectedly
                if (!logoutInitiated) {
                    setTimeout(connectWebSocket, 5000); // Reconnect after 5 seconds
                }
            };

            ws.onerror = (error) => {
                console.error('WebSocket Error', error);
                dropdownAccountBalanceSpan.textContent = 'WS Error';
                headerAccountBalanceSpan.textContent = 'WS Error';
            };
        }

        let logoutInitiated = false;

        function authorizeAndFetchBalance(account) {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ "authorize": account.token }));
            } else {
                console.warn("WebSocket not open for authorization. Attempting to reconnect.");
                connectWebSocket(); // Reconnect and then authorize
            }
        }

        // Populate the dropdown with accounts
        derivAccounts.forEach((account, index) => {
            const option = document.createElement('option');
            option.value = index;
            // Display account ID and currency in dropdown
            option.textContent = `${account.account_id} (${account.currency})`;
            dropdownAccountSelect.appendChild(option);
        });

        dropdownAccountSelect.value = activeAccountIndex;
        updateDisplayedAccount(derivAccounts[activeAccountIndex]); // Initial display and fetch

        dropdownAccountSelect.addEventListener('change', (event) => {
            const selectedIndex = event.target.value;
            localStorage.setItem('active_deriv_account_index', selectedIndex);
            updateDisplayedAccount(derivAccounts[selectedIndex]);
            authorizeAndFetchBalance(derivAccounts[selectedIndex]); // Authorize with new account
        });

        profileIconContainer.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent click from propagating to document
            profileDropdown.classList.toggle('show');
        });

        // Prevent clicks inside the dropdown from closing it
        profileDropdown.addEventListener('click', (event) => {
            event.stopPropagation();
        });

        document.addEventListener('click', (event) => {
            if (!profileIconContainer.contains(event.target) && profileDropdown.classList.contains('show')) {
                profileDropdown.classList.remove('show');
            }
        });

        // Call connectWebSocket on initial load
        connectWebSocket();

    } else {
        // No accounts found, redirect to login
        window.location.href = 'index.html';
    }

    function updateDisplayedAccount(account) {
        if (account) {
            // Update dropdown details
            dropdownAccountIdSpan.textContent = account.account_id;
            dropdownAccountCurrencySpan.textContent = account.currency;
            dropdownAccountBalanceSpan.textContent = account.balance ? `${account.balance} ${account.currency}` : 'Connecting...';

            // Update header display
            headerAccountTypeSpan.textContent = account.account_type ? `(${account.account_type})` : '';
            headerAccountBalanceSpan.textContent = account.balance ? `${account.currency} ${account.balance}` : '';

        }
    }

    // Logout functionality
    dropdownLogoutBtn.addEventListener('click', performLogout);

    function performLogout() {
        logoutInitiated = true; // Set flag to prevent reconnect
        localStorage.removeItem('deriv_accounts');
        localStorage.removeItem('active_deriv_account_index');
        if (window.derivWs && window.derivWs.readyState === WebSocket.OPEN) {
            window.derivWs.close(); // Close WebSocket on logout
        }
        window.location.href = 'index.html';
    }
});