# Crypto Swap App

A production-ready React crypto swap application built with ethers.js and MetaMask integration.

## Features

- ✅ **Wallet Connection**: Secure MetaMask integration
- ✅ **Multi-Network Support**: Ethereum, Arbitrum, and Base
- ✅ **Real-time Balances**: ETH and ERC20 token balances
- ✅ **Token Swaps**: Uniswap V2 router integration
- ✅ **Token Approvals**: Automatic ERC20 token approvals
- ✅ **Error Handling**: Comprehensive error display
- ✅ **Loading States**: User-friendly loading indicators
- ✅ **Network Switching**: Seamless network switching
- ✅ **Debug Console**: Detailed logging for troubleshooting

## Quick Start

### Prerequisites
- Node.js 16+ installed
- MetaMask browser extension installed

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npm start
   ```

3. **Open your browser** and navigate to `http://localhost:3000`

## Usage

### 1. Connect Wallet
- Click "Connect Wallet" button
- MetaMask popup will appear
- Approve connection in MetaMask
- Your wallet address and balance will appear

### 2. Switch Networks
- Choose between Ethereum, Arbitrum, or Base
- Click the network button to switch
- MetaMask will prompt for network change
- If network not added, it will be added automatically

### 3. Swap Tokens
- The app includes a quick swap feature (0.01 ETH → USDC)
- Click "Swap 0.01 ETH for USDC"
- Token approval will be handled automatically
- Transaction status will be displayed
- Balance will update after successful swap

## Supported Networks

| Network | Chain ID | RPC URL |
|---------|----------|---------|
| Ethereum Mainnet | 0x1 | Infura |
| Arbitrum One | 0xa4b1 | https://arb1.arbitrum.io/rpc |
| Base | 0x2105 | https://mainnet.base.org |

## Smart Contracts

- **Uniswap V2 Router**: `0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D`
- **USDC Token**: `0xA0b86a33E6441e6c8C8d8d8d8d8d8d8d8d8d8d8d8d8`

## Debug Console

Open browser console to see detailed logs:
- Wallet connection steps
- Provider and signer creation
- Network information
- Transaction details
- Error messages

## Error Handling

The app handles common errors:
- MetaMask not installed
- Wallet connection rejected
- Network switching failed
- Insufficient balance
- Transaction failures
- Token approval errors

## Security Features

- ✅ Slippage protection (5%)
- ✅ Transaction deadlines (20 minutes)
- ✅ Balance validation
- ✅ Network validation
- ✅ Safe provider checks

## Development

### Project Structure
```
crypto/
├── public/
│   └── index.html
├── src/
│   ├── App.jsx          # Main app component
│   ├── swap.jsx         # Swap functionality
│   ├── index.js         # Entry point
│   └── index.css        # Global styles
├── package.json         # Dependencies
└── README.md           # This file
```

### Key Dependencies
- `react` ^18.2.0
- `ethers` ^6.8.0
- `react-scripts` ^5.0.1

## Troubleshooting

### "MetaMask is not installed"
- Install MetaMask browser extension
- Refresh the page

### "Connection failed"
- Check MetaMask is unlocked
- Ensure you're on a supported network
- Check browser console for detailed error

### "Swap failed"
- Ensure sufficient ETH balance for gas
- Check network connectivity
- Verify token contracts are correct

## Production Deployment

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Deploy the `build` folder** to your hosting service

## License

MIT License
