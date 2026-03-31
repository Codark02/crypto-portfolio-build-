import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const USDC_ADDRESS = '0xA0b86a33E6441e6c8C8d8d8d8d8d8d8d8d8d8d8d8d8';

const NETWORKS = {
  ethereum: {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  arbitrum: {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  },
  base: {
    chainId: '0x2105',
    chainName: 'Base',
    rpcUrls: ['https://mainnet.base.org'],
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
  }
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

export default function CryptoSwap() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [currentNetwork, setCurrentNetwork] = useState('');
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);

  const checkMetaMask = () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return false;
    }
    return true;
  };

  const connectWallet = async () => {
    try {
      console.log('Starting wallet connection...');
      console.log('Selected network:', selectedNetwork);
      setError('');
      setLoading(true);

      if (!checkMetaMask()) return;

      console.log('MetaMask detected, creating provider...');
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      console.log('Provider created:', web3Provider);

      // First, switch to the selected network
      const networkConfig = NETWORKS[selectedNetwork];
      console.log('Switching to network:', networkConfig.chainName);

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }],
        });
        console.log('Network switched successfully');
      } catch (switchError) {
        if (switchError.code === 4902) {
          console.log('Network not found, adding network...');
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
          console.log('Network added successfully');
        } else {
          console.error('Network switch error:', switchError);
          throw new Error(`Failed to switch to ${networkConfig.chainName}: ${switchError.message}`);
        }
      }

      // Now request accounts
      console.log('Requesting accounts...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('Accounts received:', accounts);

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Create signer and get address
      const web3Signer = await web3Provider.getSigner();
      const userAddress = await web3Signer.getAddress();
      const networkInfo = await web3Provider.getNetwork();

      console.log('Signer:', web3Signer);
      console.log('Address:', userAddress);
      console.log('Network:', networkInfo);

      // Verify we're on the correct network
      const expectedChainId = parseInt(networkConfig.chainId, 16);
      if (networkInfo.chainId !== BigInt(expectedChainId)) {
        throw new Error(`Network mismatch. Expected ${networkConfig.chainName} but connected to ${networkInfo.name}`);
      }

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
      setConnected(true);
      setWalletConnected(true);
      setCurrentNetwork(networkConfig.chainName);

      await fetchBalance(web3Provider, userAddress);

      console.log('Wallet connected successfully to', networkConfig.chainName);

    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(`Connection failed: ${err.message}`);
      setWalletConnected(false);
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async (networkName) => {
    try {
      if (!checkMetaMask()) return;

      const networkConfig = NETWORKS[networkName];
      console.log('Switching to network:', networkName);

      // Update selected network first
      setSelectedNetwork(networkName);

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }],
        });
        console.log('Network switched successfully');
      } catch (switchError) {
        if (switchError.code === 4902) {
          console.log('Network not found, adding network...');
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
          console.log('Network added successfully');
        }
      }

      // If wallet is connected, update provider and signer
      if (walletConnected) {
        const newProvider = new ethers.BrowserProvider(window.ethereum);
        const newSigner = await newProvider.getSigner();
        const newNetwork = await newProvider.getNetwork();

        setProvider(newProvider);
        setSigner(newSigner);
        setCurrentNetwork(networkConfig.chainName);
        await fetchBalance(newProvider, address);
      }

    } catch (err) {
      console.error('Network switch error:', err);
      setError(`Network switch failed: ${err.message}`);
    }
  };

  const disconnectWallet = () => {
    console.log('Disconnecting wallet...');
    setProvider(null);
    setSigner(null);
    setAddress('');
    setConnected(false);
    setWalletConnected(false);
    setCurrentNetwork('');
    setBalance('0');
    setError('');
    setTxStatus('');
    console.log('Wallet disconnected');
  };

  const fetchBalance = async (providerInstance, userAddress) => {
    try {
      const ethBalance = await providerInstance.getBalance(userAddress);
      const formattedBalance = ethers.formatEther(ethBalance);
      setBalance(parseFloat(formattedBalance).toFixed(4));
      console.log('ETH Balance:', formattedBalance);
    } catch (err) {
      console.error('Balance fetch error:', err);
    }
  };

  const approveToken = async (tokenAddress, spenderAddress, amount) => {
    try {
      console.log('Approving token...');
      setTxStatus('Approving token...');

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const allowance = await tokenContract.allowance(address, spenderAddress);

      if (allowance >= amount) {
        console.log('Token already approved');
        return true;
      }

      const approveTx = await tokenContract.approve(spenderAddress, amount);
      setTxStatus('Waiting for approval confirmation...');
      await approveTx.wait();

      console.log('Token approved');
      setTxStatus('');
      return true;

    } catch (err) {
      console.error('Approval error:', err);
      setError(`Approval failed: ${err.message}`);
      setTxStatus('');
      return false;
    }
  };

  const executeSwap = async () => {
    try {
      if (!connected) {
        setError('Please connect wallet first');
        return;
      }

      console.log('Executing swap...');
      setTxStatus('Preparing swap...');

      const router = new ethers.Contract(UNISWAP_V2_ROUTER, ROUTER_ABI, signer);
      const amountIn = ethers.parseEther('0.01'); // 0.01 ETH

      const path = [await router.WETH(), USDC_ADDRESS];
      const amounts = await router.getAmountsOut(amountIn, path);
      const amountOutMin = amounts[1] * BigInt(95) / BigInt(100); // 5% slippage

      setTxStatus('Swapping ETH for USDC...');
      const swapTx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        address,
        Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes deadline
        { value: amountIn }
      );

      setTxStatus('Waiting for swap confirmation...');
      await swapTx.wait();

      console.log('Swap successful:', swapTx.hash);
      setTxStatus('Swap successful!');
      await fetchBalance(provider, address);

      setTimeout(() => setTxStatus(''), 3000);

    } catch (err) {
      console.error('Swap error:', err);
      setError(`Swap failed: ${err.message}`);
      setTxStatus('');
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = (accounts) => {
        console.log('Accounts changed:', accounts);
        if (accounts.length === 0) {
          // User disconnected wallet
          disconnectWallet();
        } else if (walletConnected && accounts[0] !== address) {
          // Account changed, update address
          setAddress(accounts[0]);
          console.log('Account updated to:', accounts[0]);
        }
      };

      const handleChainChanged = (chainId) => {
        console.log('Chain changed to:', chainId);
        
        // Find which network this chainId belongs to
        const networkName = Object.keys(NETWORKS).find(
          key => NETWORKS[key].chainId === chainId
        );
        
        if (networkName) {
          setCurrentNetwork(NETWORKS[networkName].chainName);
          setSelectedNetwork(networkName);
          
          // If wallet is connected, refresh provider and balance
          if (walletConnected) {
            const refreshConnection = async () => {
              try {
                const newProvider = new ethers.BrowserProvider(window.ethereum);
                const newSigner = await newProvider.getSigner();
                setProvider(newProvider);
                setSigner(newSigner);
                await fetchBalance(newProvider, accounts[0]);
              } catch (error) {
                console.error('Error refreshing connection:', error);
              }
            };
            refreshConnection();
          }
        }
      };

      const handleConnect = (connectInfo) => {
        console.log('Wallet connected:', connectInfo);
      };

      const handleDisconnect = (error) => {
        console.log('Wallet disconnected:', error);
        disconnectWallet();
      };

      // Add event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('connect', handleConnect);
      window.ethereum.on('disconnect', handleDisconnect);

      // Check current network on load
      const checkCurrentNetwork = async () => {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const network = await provider.getNetwork();
          const chainIdHex = '0x' + network.chainId.toString(16);
          
          const networkName = Object.keys(NETWORKS).find(
            key => NETWORKS[key].chainId === chainIdHex
          );
          
          if (networkName) {
            setCurrentNetwork(NETWORKS[networkName].chainName);
            setSelectedNetwork(networkName);
          }
        } catch (error) {
          console.error('Error checking current network:', error);
        }
      };

      checkCurrentNetwork();

      // Cleanup
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
        window.ethereum.removeListener('connect', handleConnect);
        window.ethereum.removeListener('disconnect', handleDisconnect);
      };
    }
  }, [walletConnected, address]);

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Crypto Swap</h1>
      
      {error && (
        <div style={{ backgroundColor: '#fee', padding: '10px', marginBottom: '20px', borderRadius: '5px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {txStatus && (
        <div style={{ backgroundColor: '#e3f2fd', padding: '10px', marginBottom: '20px', borderRadius: '5px' }}>
          <strong>Status:</strong> {txStatus}
        </div>
      )}

      {/* Network Selection Section */}
      <div style={{ marginBottom: '30px', padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '10px' }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>Select Network</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Object.entries(NETWORKS).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setSelectedNetwork(key)}
              disabled={walletConnected}
              style={{
                padding: '12px 20px',
                fontSize: '14px',
                backgroundColor: selectedNetwork === key ? '#0070f3' : '#e0e0e0',
                color: selectedNetwork === key ? 'white' : 'black',
                border: 'none',
                borderRadius: '8px',
                cursor: walletConnected ? 'not-allowed' : 'pointer',
                opacity: walletConnected ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: selectedNetwork === key ? 'bold' : 'normal'
              }}
            >
              {config.chainName}
            </button>
          ))}
        </div>
        {walletConnected && (
          <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Disconnect wallet to change network
          </p>
        )}
      </div>

      {/* Network Status */}
      {currentNetwork && (
        <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#e8f5e8', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#2e7d32' }}>
            <strong>Current Network:</strong> {currentNetwork}
            {selectedNetwork !== Object.keys(NETWORKS).find(k => NETWORKS[k].chainName === currentNetwork) && (
              <span style={{ marginLeft: '10px', color: '#f57c00' }}>
                (Different from selected)
              </span>
            )}
          </p>
        </div>
      )}

      {/* Wallet Connection Section */}
      {!walletConnected ? (
        <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>Connect Your Wallet</h3>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Connect to <strong>{NETWORKS[selectedNetwork].chainName}</strong> network
          </p>
          <button
            onClick={connectWallet}
            disabled={loading}
            style={{
              padding: '15px 40px',
              fontSize: '16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.3s ease',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Connecting...' : `Connect to ${NETWORKS[selectedNetwork].chainName}`}
          </button>
          <p style={{ marginTop: '15px', fontSize: '12px', color: '#999' }}>
            Make sure MetaMask is installed and unlocked
          </p>
        </div>
      ) : (
        <div>
          {/* Connected Wallet Info */}
          <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f5f5f5', borderRadius: '10px' }}>
            <h3 style={{ marginBottom: '15px', color: '#333' }}>Wallet Connected</h3>
            <p style={{ margin: '5px 0', color: '#666' }}>
              <strong>Address:</strong> {address.slice(0, 6)}...{address.slice(-4)}
            </p>
            <p style={{ margin: '5px 0', color: '#666' }}>
              <strong>Network:</strong> {currentNetwork}
            </p>
            <p style={{ margin: '5px 0', color: '#666' }}>
              <strong>ETH Balance:</strong> {balance} ETH
            </p>
            <button
              onClick={disconnectWallet}
              style={{
                marginTop: '10px',
                padding: '8px 16px',
                fontSize: '12px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer'
              }}
            >
              Disconnect Wallet
            </button>
          </div>

          {/* Network Switching (when connected) */}
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '8px' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#856404' }}>Switch Network:</h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {Object.keys(NETWORKS).map((net) => (
                <button
                  key={net}
                  onClick={() => switchNetwork(net)}
                  disabled={loading}
                  style={{
                    margin: '2px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: currentNetwork === NETWORKS[net].chainName ? '#28a745' : '#ffc107',
                    color: currentNetwork === NETWORKS[net].chainName ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  {NETWORKS[net].chainName}
                  {currentNetwork === NETWORKS[net].chainName && ' ✓'}
                </button>
              ))}
            </div>
          </div>

          {/* Swap Section */}
          <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#e8f5e8', borderRadius: '10px' }}>
            <h3 style={{ marginBottom: '15px', color: '#2e7d32' }}>Quick Swap</h3>
            <p style={{ marginBottom: '15px', color: '#666' }}>
              Swap 0.01 ETH for USDC on {currentNetwork}
            </p>
            <button
              onClick={executeSwap}
              disabled={loading}
              style={{
                padding: '12px 25px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Processing...' : 'Swap 0.01 ETH → USDC'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
