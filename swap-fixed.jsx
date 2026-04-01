import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const UNISWAP_V2_ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';
const USDC_ADDRESS = '0xA0b86a33E6441e6c8C8d8d8d8d8d8d8d8d8d8d8d8';
const USDT_ADDRESS = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

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
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const ROUTER_ABI = [
  "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)",
  "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)",
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)"
];

// Hidden Relay.link configuration
const RELAY_CONFIG = {
  baseUrl: 'https://api.relay.link',
  apiKey: 'hidden_key_relay_integration'
};

export default function CryptoSwap() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState('');
  const [connected, setConnected] = useState(false);
  const [selectedNetwork, setSelectedNetwork] = useState('ethereum');
  const [currentNetwork, setCurrentNetwork] = useState('');
  const [balances, setBalances] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [walletConnected, setWalletConnected] = useState(false);
  
  // Buy/Sell state
  const [allCoins, setAllCoins] = useState([]);
  const [selectedBuyCoin, setSelectedBuyCoin] = useState(null);
  const [selectedSellCoin, setSelectedSellCoin] = useState(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [showBuyList, setShowBuyList] = useState(false);
  const [showSellList, setShowSellList] = useState(false);
  const [buySearch, setBuySearch] = useState('');
  const [sellSearch, setSellSearch] = useState('');
  const [prices, setPrices] = useState({});

  // Fetch real-time prices from CoinGecko
  const fetchRealTimePrices = async () => {
    try {
      console.log('Fetching real-time prices...');
      const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h');
      const data = await response.json();
      
      const coins = data.map(coin => ({
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol.toUpperCase(),
        image: coin.image,
        price: coin.current_price || 0,
        change24h: coin.price_change_percentage_24h || 0
      }));
      
      console.log('Fetched', coins.length, 'coins');
      setAllCoins(coins);
      
      // Update prices object
      const newPrices = {};
      coins.forEach(coin => {
        newPrices[coin.symbol] = coin.price;
      });
      setPrices(newPrices);
      
      return coins;
    } catch (error) {
      console.error('Error fetching prices:', error);
      return [];
    }
  };

  // Get token address for a symbol
  const getTokenAddress = (symbol) => {
    const tokenMap = {
      'USDC': USDC_ADDRESS,
      'USDT': USDT_ADDRESS,
      'WETH': WETH_ADDRESS,
      'ETH': null
    };
    return tokenMap[symbol.toUpperCase()] || null;
  };

  // Filter coins for search
  const getFilteredCoins = (searchTerm) => {
    if (!searchTerm) return allCoins.slice(0, 50);
    return allCoins.filter(coin => 
      coin.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      coin.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    ).slice(0, 50);
  };

  // Calculate buy totals
  const calculateBuyTotal = () => {
    if (!selectedBuyCoin || !buyAmount) return { receiveAmount: 0, total: 0, gasFee: 0 };
    
    const amount = parseFloat(buyAmount) || 0;
    const receiveAmount = amount / selectedBuyCoin.price;
    const gasFee = amount * 0.001; // 0.1% fee
    
    return {
      receiveAmount: receiveAmount.toFixed(6),
      total: amount.toFixed(2),
      gasFee: gasFee.toFixed(2)
    };
  };

  // Calculate sell totals
  const calculateSellTotal = () => {
    if (!selectedSellCoin || !sellAmount) return { receiveAmount: 0, total: 0, gasFee: 0 };
    
    const amount = parseFloat(sellAmount) || 0;
    const total = amount * selectedSellCoin.price;
    const gasFee = total * 0.001; // 0.1% fee
    
    return {
      receiveAmount: total.toFixed(2),
      total: total.toFixed(2),
      gasFee: gasFee.toFixed(2)
    };
  };

  const checkMetaMask = () => {
    if (typeof window.ethereum === 'undefined') {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return false;
    }
    return true;
  };

  // Fetch all token balances
  const fetchAllBalances = async () => {
    if (!walletConnected || !provider) return;
    
    try {
      console.log('Fetching all balances...');
      const newBalances = {};
      
      // Get ETH balance
      const ethBalance = await provider.getBalance(address);
      newBalances.ETH = parseFloat(ethers.formatEther(ethBalance));
      
      // Get ERC20 token balances
      const tokens = [
        { symbol: 'USDC', address: USDC_ADDRESS, decimals: 6 },
        { symbol: 'USDT', address: USDT_ADDRESS, decimals: 6 },
        { symbol: 'WETH', address: WETH_ADDRESS, decimals: 18 }
      ];
      
      for (const token of tokens) {
        try {
          const tokenContract = new ethers.Contract(token.address, ERC20_ABI, signer);
          const balance = await tokenContract.balanceOf(address);
          newBalances[token.symbol] = parseFloat(ethers.formatUnits(balance, token.decimals));
        } catch (error) {
          console.error(`Error fetching ${token.symbol} balance:`, error);
          newBalances[token.symbol] = 0;
        }
      }
      
      setBalances(newBalances);
      console.log('Balances updated:', newBalances);
    } catch (error) {
      console.error('Error fetching balances:', error);
    }
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

      // First, switch to selected network
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

      await fetchAllBalances();

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
        await fetchAllBalances();
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
    setBalances({});
    setError('');
    setTxStatus('');
    console.log('Wallet disconnected');
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
                await fetchAllBalances();
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

  // Initialize coins on mount
  useEffect(() => {
    fetchRealTimePrices();
    const interval = setInterval(fetchRealTimePrices, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Update balances when wallet connects
  useEffect(() => {
    if (walletConnected) {
      fetchAllBalances();
    }
  }, [walletConnected]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.coin-selector')) {
        setShowBuyList(false);
        setShowSellList(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Handle wallet option selection
  const handleWalletOption = async (walletType) => {
    try {
      console.log(`Connecting to ${walletType}...`);
      await connectWallet();
    } catch (error) {
      console.error('Wallet connection failed:', error);
      setError(`Failed to connect to ${walletType}: ${error.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '20px auto', padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>Crypto Swap</h1>
      
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
        <div style={{ textAlign: 'center', padding: '30px', backgroundColor: '#fff', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', marginBottom: '30px' }}>
          <h3 style={{ marginBottom: '20px', color: '#333' }}>Connect Your Wallet</h3>
          <p style={{ marginBottom: '20px', color: '#666' }}>
            Connect to <strong>{NETWORKS[selectedNetwork].chainName}</strong> network
          </p>
          
          {/* Wallet Options Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '25px' }}>
            <button
              onClick={() => handleWalletOption('metamask')}
              disabled={loading}
              style={{
                padding: '15px 20px',
                fontSize: '14px',
                backgroundColor: '#f6851b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🦊 MetaMask
            </button>
            
            <button
              onClick={() => handleWalletOption('rabby')}
              disabled={loading}
              style={{
                padding: '15px 20px',
                fontSize: '14px',
                backgroundColor: '#6b46c1',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              🐰 Rabby
            </button>
            
            <button
              onClick={() => handleWalletOption('okx')}
              disabled={loading}
              style={{
                padding: '15px 20px',
                fontSize: '14px',
                backgroundColor: '#1e1e1e',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              ⚫ OKX Wallet
            </button>
            
            <button
              onClick={() => handleWalletOption('phantom')}
              disabled={loading}
              style={{
                padding: '15px 20px',
                fontSize: '14px',
                backgroundColor: '#ab9ff2',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'all 0.3s ease',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              👻 Phantom
            </button>
          </div>
          
          {/* Alternative Connection Method */}
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#666' }}>
              Or connect directly:
            </p>
            <button
              onClick={connectWallet}
              disabled={loading}
              style={{
                padding: '12px 30px',
                fontSize: '14px',
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
          </div>
          
          <p style={{ marginTop: '15px', fontSize: '12px', color: '#999' }}>
            Make sure your wallet is installed and unlocked
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
              <strong>ETH Balance:</strong> {balances.ETH?.toFixed(4) || '0'} ETH
            </p>
            <p style={{ margin: '5px 0', color: '#666' }}>
              <strong>USDC Balance:</strong> {balances.USDC?.toFixed(2) || '0'} USDC
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

          {/* Buy and Sell Areas */}
          <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
            {/* Buy Area - Green */}
            <div style={{ flex: 1, padding: '25px', backgroundColor: '#e8f5e8', borderRadius: '15px', border: '2px solid #4caf50' }}>
              <h3 style={{ color: '#2e7d32', marginBottom: '20px', textAlign: 'center' }}>🟢 Buy Coins</h3>
              
              {/* Coin Selection */}
              <div style={{ marginBottom: '20px' }} className="coin-selector">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2e7d32' }}>Select Coin to Buy:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search or select coin..."
                    value={selectedBuyCoin ? selectedBuyCoin.name : buySearch}
                    onChange={(e) => setBuySearch(e.target.value)}
                    onFocus={() => setShowBuyList(true)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #4caf50',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {showBuyList && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #4caf50',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '5px'
                    }}>
                      {getFilteredCoins(buySearch).map(coin => (
                        <div
                          key={coin.id}
                          onClick={() => {
                            setSelectedBuyCoin(coin);
                            setBuySearch('');
                            setShowBuyList(false);
                          }}
                          style={{
                            padding: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <img src={coin.image} alt={coin.symbol} style={{ width: '24px', height: '24px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold' }}>{coin.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{coin.symbol}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold' }}>${coin.price?.toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: coin.change24h >= 0 ? '#4caf50' : '#f44336' }}>
                              {coin.change24h >= 0 ? '+' : ''}{coin.change24h?.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#2e7d32' }}>Amount (USD):</label>
                <input
                  type="number"
                  placeholder="Enter amount in USD"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #4caf50',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Summary */}
              {selectedBuyCoin && buyAmount && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f1f8e9', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>You will receive:</span>
                    <strong>{calculateBuyTotal().receiveAmount} {selectedBuyCoin.symbol}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Total Cost:</span>
                    <strong>${calculateBuyTotal().total}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gas Fee:</span>
                    <strong>${calculateBuyTotal().gasFee}</strong>
                  </div>
                </div>
              )}

              {/* Buy Button */}
              <button
                onClick={() => console.log('Buy functionality coming soon!')}
                disabled={loading || !selectedBuyCoin || !buyAmount}
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: '#4caf50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || !selectedBuyCoin || !buyAmount ? 'not-allowed' : 'pointer',
                  opacity: loading || !selectedBuyCoin || !buyAmount ? 0.6 : 1,
                  transition: 'all 0.3s ease',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Processing...' : 'Buy Now'}
              </button>
            </div>

            {/* Sell Area - Red */}
            <div style={{ flex: 1, padding: '25px', backgroundColor: '#ffebee', borderRadius: '15px', border: '2px solid #f44336' }}>
              <h3 style={{ color: '#c62828', marginBottom: '20px', textAlign: 'center' }}>🔴 Sell Coins</h3>
              
              {/* Holdings Display */}
              <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#c62828' }}>Your Holdings:</label>
                <div style={{ fontSize: '14px', color: '#666' }}>
                  {Object.entries(balances).filter(([symbol, balance]) => balance > 0).map(([symbol, balance]) => (
                    <div key={symbol} style={{ marginBottom: '4px' }}>
                      {balance.toFixed(4)} {symbol}
                    </div>
                  )) || 'No holdings'}
                </div>
              </div>

              {/* Coin Selection */}
              <div style={{ marginBottom: '20px' }} className="coin-selector">
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#c62828' }}>Select Coin to Sell:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search or select coin..."
                    value={selectedSellCoin ? selectedSellCoin.name : sellSearch}
                    onChange={(e) => setSellSearch(e.target.value)}
                    onFocus={() => setShowSellList(true)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #f44336',
                      borderRadius: '8px',
                      fontSize: '14px'
                    }}
                  />
                  {showSellList && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'white',
                      border: '1px solid #f44336',
                      borderRadius: '8px',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '5px'
                    }}>
                      {getFilteredCoins(sellSearch).map(coin => (
                        <div
                          key={coin.id}
                          onClick={() => {
                            setSelectedSellCoin(coin);
                            setSellSearch('');
                            setShowSellList(false);
                          }}
                          style={{
                            padding: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #eee'
                          }}
                        >
                          <img src={coin.image} alt={coin.symbol} style={{ width: '24px', height: '24px' }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold' }}>{coin.name}</div>
                            <div style={{ fontSize: '12px', color: '#666' }}>{coin.symbol}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 'bold' }}>${coin.price?.toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: coin.change24h >= 0 ? '#4caf50' : '#f44336' }}>
                              {coin.change24h >= 0 ? '+' : ''}{coin.change24h?.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Amount Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#c62828' }}>Amount:</label>
                <input
                  type="number"
                  placeholder={`Enter amount in ${selectedSellCoin?.symbol || 'tokens'}`}
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #f44336',
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Summary */}
              {selectedSellCoin && sellAmount && (
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>You will receive:</span>
                    <strong>${calculateSellTotal().receiveAmount} USDC</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Total Value:</span>
                    <strong>${calculateSellTotal().total}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Gas Fee:</span>
                    <strong>${calculateSellTotal().gasFee}</strong>
                  </div>
                </div>
              )}

              {/* Sell Button */}
              <button
                onClick={() => console.log('Sell functionality coming soon!')}
                disabled={loading || !selectedSellCoin || !sellAmount}
                style={{
                  width: '100%',
                  padding: '15px',
                  fontSize: '16px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || !selectedSellCoin || !sellAmount ? 'not-allowed' : 'pointer',
                  opacity: loading || !selectedSellCoin || !sellAmount ? 0.6 : 1,
                  transition: 'all 0.3s ease',
                  fontWeight: 'bold'
                }}
              >
                {loading ? 'Processing...' : 'Sell Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
