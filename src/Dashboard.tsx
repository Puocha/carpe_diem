import React, { useEffect, useState, useCallback } from 'react';
import derivApiService from './derivApi';

interface Account {
  loginid: string;
  currency: string;
  balance: number;
  is_virtual: 0 | 1;
}

const Dashboard: React.FC = () => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('deriv_token');
      if (!token) {
        setError('No Deriv token found. Please log in again.');
        setLoading(false);
        return;
      }
      derivApiService.setToken(token);
      const fetchedAccounts = await derivApiService.getAccountDetails();
      setAccounts(fetchedAccounts);
      if (fetchedAccounts.length > 0) {
        setSelectedAccount(fetchedAccounts[0]); // Select the first account by default
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      setError('Failed to load account information.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAccountSwitch = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLoginId = event.target.value;
    const accountToSwitch = accounts.find(acc => acc.loginid === newLoginId);
    if (accountToSwitch) {
      setLoading(true);
      setError(null);
      try {
        await derivApiService.switchAccount(newLoginId);
        setSelectedAccount(accountToSwitch);
        // Re-fetch accounts to ensure balances are updated after switch
        await fetchAccounts(); 
      } catch (err) {
        console.error('Failed to switch account:', err);
        setError('Failed to switch account.');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <p>Loading account details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <p style={{ color: 'red' }}>Error: {error}</p>
        <button onClick={fetchAccounts}>Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="header">
        <h1>Dashboard</h1>
        {selectedAccount && (
          <div className="account-info">
            <label htmlFor="account-select">Current Account:</label>
            <select id="account-select" value={selectedAccount.loginid} onChange={handleAccountSwitch}>
              {accounts.map(account => (
                <option key={account.loginid} value={account.loginid}>
                  {account.loginid} ({account.currency} {account.balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="content">
        <p>You are here.</p>
        {selectedAccount && (
          <div>
            <p>Selected Account: {selectedAccount.loginid} ({selectedAccount.is_virtual ? 'Virtual' : 'Real'})</p>
            <p>Balance: {selectedAccount.currency} {selectedAccount.balance.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 