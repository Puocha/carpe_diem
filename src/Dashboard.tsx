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
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...');

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConnectionStatus('Connecting to Deriv...');
    
    try {
      const token = localStorage.getItem('deriv_token');
      if (!token) {
        setError('No Deriv token found. Please log in again.');
        setLoading(false);
        return;
      }

      setConnectionStatus('Authorizing...');
      derivApiService.setToken(token);
      
      setConnectionStatus('Fetching account details...');
      const fetchedAccounts = await derivApiService.getAccountDetails();
      
      if (fetchedAccounts.length === 0) {
        setError('No accounts found. Please check your Deriv account.');
        setLoading(false);
        return;
      }

      setAccounts(fetchedAccounts);
      setSelectedAccount(fetchedAccounts[0]);
      setConnectionStatus('');
    } catch (err: any) {
      console.error('Failed to fetch accounts:', err);
      let errorMessage = 'Failed to load account information.';
      
      if (err.message?.includes('token')) {
        errorMessage = 'Your session has expired. Please log in again.';
        localStorage.removeItem('deriv_token');
      } else if (err.message?.includes('timeout')) {
        errorMessage = 'Connection timed out. Please check your internet connection and try again.';
      }
      
      setError(errorMessage);
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
      setConnectionStatus('Switching account...');
      
      try {
        await derivApiService.switchAccount(newLoginId);
        setSelectedAccount(accountToSwitch);
        await fetchAccounts();
      } catch (err: any) {
        console.error('Failed to switch account:', err);
        let errorMessage = 'Failed to switch account.';
        
        if (err.message?.includes('token')) {
          errorMessage = 'Your session has expired. Please log in again.';
          localStorage.removeItem('deriv_token');
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
        setConnectionStatus('');
      }
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <p>{connectionStatus || 'Loading account details...'}</p>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-container">
        <div className="error-container">
          <p style={{ color: 'red' }}>Error: {error}</p>
          <button onClick={fetchAccounts}>Retry</button>
        </div>
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
        {selectedAccount && (
          <div className="account-details">
            <h2>Account Details</h2>
            <p>Account ID: {selectedAccount.loginid}</p>
            <p>Account Type: {selectedAccount.is_virtual ? 'Virtual' : 'Real'}</p>
            <p>Balance: {selectedAccount.currency} {selectedAccount.balance.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard; 