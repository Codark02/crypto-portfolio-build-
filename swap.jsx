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
  const [network, setNetwork] = useState('');
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [txStatus, setTxStatus] = useState('');

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
      setError('');
      setLoading(true);

      if (!checkMetaMask()) return;

      console.log('MetaMask detected, creating provider...');
      const web3Provider = new ethers.BrowserProvider(window.ethereum);
      console.log('Provider created:', web3Provider);

      console.log('Requesting accounts...');
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      console.log('Accounts received:', accounts);

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const web3Signer = await web3Provider.getSigner();
      const userAddress = await web3Signer.getAddress();
      const networkInfo = await web3Provider.getNetwork();

      console.log('Signer:', web3Signer);
      console.log('Address:', userAddress);
      console.log('Network:', networkInfo);

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAddress(userAddress);
      setConnected(true);
      setNetwork(networkInfo.name);

      await fetchBalance(web3Provider, userAddress);

    } catch (err) {
      console.error('Wallet connection error:', err);
      setError(`Connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async (networkName) => {
    try {
      if (!checkMetaMask()) return;

      const networkConfig = NETWORKS[networkName];
      console.log('Switching to network:', networkName);

      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }],
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          console.log('Network not found, adding network...');
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        }
      }

      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newSigner = await newProvider.getSigner();
      const newNetwork = await newProvider.getNetwork();

      setProvider(newProvider);
      setSigner(newSigner);
      setNetwork(newNetwork.name);
      await fetchBalance(newProvider, address);

    } catch (err) {
      console.error('Network switch error:', err);
      setError(`Network switch failed: ${err.message}`);
    }
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
          setConnected(false);
          setAddress('');
          setProvider(null);
          setSigner(null);
        }
      };

      const handleChainChanged = () => {
        console.log('Chain changed, reloading...');
        window.location.reload();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      };
    }
  }, []);

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

      {!connected ? (
        <button
          onClick={connectWallet}
          disabled={loading}
          style={{
            padding: '15px 30px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <div>
          <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
            <p><strong>Connected:</strong> {address.slice(0, 6)}...{address.slice(-4)}</p>
            <p><strong>Network:</strong> {network}</p>
            <p><strong>ETH Balance:</strong> {balance} ETH</p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Switch Network:</h3>
            {Object.keys(NETWORKS).map((net) => (
              <button
                key={net}
                onClick={() => switchNetwork(net)}
                style={{
                  margin: '5px',
                  padding: '10px 15px',
                  backgroundColor: network.toLowerCase().includes(net) ? '#0070f3' : '#e0e0e0',
                  color: network.toLowerCase().includes(net) ? 'white' : 'black',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                {NETWORKS[net].chainName}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h3>Quick Swap (0.01 ETH → USDC)</h3>
            <button
              onClick={executeSwap}
              disabled={loading}
              style={{
                padding: '12px 25px',
                fontSize: '14px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Processing...' : 'Swap 0.01 ETH for USDC'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
