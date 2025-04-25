# MCP Moni

**Note:** All actions and queries are performed on the Monad testnet.

MCP Moni is an MCP (Model Context Protocol) server integrated with the Monad testnet. It provides tools for checking MON and other token balances, transferring tokens, wrapping/unwrapping MON, querying blocks and transactions, NFT features, and natural language requests. Designed for seamless integration with Claude Desktop.

## Project Overview

MCP Moni leverages the Model Context Protocol to enable AI assistants like Claude to interact directly with the Monad blockchain. This allows for a conversational interface to blockchain operations without requiring users to write code or understand complex blockchain interactions.

### What is Model Context Protocol (MCP)?
Model Context Protocol is a standard that allows AI models to access external tools and data sources. MCP Moni implements this protocol to provide blockchain capabilities to AI assistants.

### What is Monad?
Monad is a high-performance Layer 1 blockchain designed for scalability and efficiency. The testnet environment allows developers to experiment with blockchain features without using real assets.

## Key Features

- **Balance Checking**: Check MON and other token balances on any address
- **Token Portfolio**: View comprehensive token holdings for any address
- **Token Transfers**: Transfer tokens with simple commands (instructions & direct execution)
- **Wrapping/Unwrapping**: Convert between native MON and wrapped MON (WMON)
- **Blockchain Exploration**: Query latest blocks & transaction details
- **NFT Creation**: Create and launch NFT collections on Magic Eden (Monad Testnet)
- **NFT Image Generation**: Generate NFT artwork from text descriptions
- **Token Swapping**: Swap between different tokens using integrated DEX functionality
- **Staking**: Stake MON to receive aprMON tokens (liquid staking)
- **Natural Language Interface**: Execute blockchain operations with simple natural language commands

## Available Tools

| Tool Name                | Description                                                                 |
|-------------------------|----------------------------------------------------------------------------|
| get-mon-balance         | Get MON balance for an address on Monad testnet                             |
| get-token-balance       | Get the balance of a specific token for an address on Monad testnet          |
| get-token-portfolio     | Get all token balances for an address on Monad testnet                      |
| transfer-token          | Get instructions on how to transfer tokens on Monad testnet                 |
| get-latest-blocks       | Get the latest blocks from Monad testnet                                    |
| get-transaction         | Get details of a transaction on Monad testnet                               |
| execute-transfer        | Execute an actual token transfer on Monad testnet using the configured test wallet |
| execute-wrap            | Wrap native MON to WMON (Wrapped MON) token                                 |
| execute-unwrap          | Unwrap WMON (Wrapped MON) back to native MON token                          |
| deposit                 | Deposit native MON to WMON (warp) (alias for wrap)                          |
| withdraw                | Withdraw WMON to MON (unwrap) (alias for unwrap)                            |
| get-gas-price           | Get the current gas price on Monad testnet                                  |
| generate-nft-image      | Generate an NFT image from a text description                               |
| create-nft-collection   | Create and launch an NFT collection on Magic Eden (Monad Testnet)           |
| get-swap-quote          | Get a price quote for swapping tokens on Monad testnet                      |
| execute-swap            | Execute a token swap on Monad testnet using the configured swap router      |
| execute-stake           | Stake MON to receive aprMON token (liquid staking)                          |
| execute-unstake         | Request to unstake aprMON back to MON (starts the unstake process)          |
| get-pending-withdrawals | Get a list of pending withdrawal requests for aprMON unstaking              |
| execute-claim           | Claim MON from completed aprMON unstake requests                            |
| natural-language-request| Process natural language requests like 'warp 0.01 MON' or 'unwrap 0.02 WMON'|

## Technical Details

### Architecture
MCP Moni is built with TypeScript and integrates several key components:
- **MCP Server**: Handles communication between AI assistants and blockchain tools
- **Viem Library**: Provides low-level Ethereum/Monad blockchain interactions
- **Monad SDK**: Connects to Monad testnet for blockchain operations
- **Token Standards**: Supports ERC-20 tokens and NFT standards (ERC-721/ERC-1155)

### Security Considerations
- All operations are performed on Monad testnet only
- Private keys are stored locally in `.env` file and never transmitted
- Only test wallets should be used (never production wallets with real assets)
- Transaction signing happens locally, not on remote servers

## Detailed Feature Explanation

### Token Swapping
MCP Moni provides a complete decentralized exchange (DEX) experience:
- Get price quotes before executing swaps
- Support for multiple token pairs
- Configurable slippage tolerance
- Direct execution through a swap router contract
- Special handling for token pairs with complex paths

### NFT Creation Workflow
Creating NFTs with MCP Moni involves:
1. Generating NFT artwork from text descriptions
2. Configuring collection parameters (name, symbol, royalties, etc.)
3. Setting up minting parameters (price, supply limits, dates)
4. Deploying the collection to the Monad testnet
5. Managing the created collection

### Liquid Staking System
The staking system allows:
- Staking native MON to receive aprMON tokens
- Unstaking aprMON back to MON through a timelock mechanism
- Viewing pending withdrawal requests
- Claiming MON after the unstaking period completes

## Example Tool Usage

### Check MON Balance
```json
{
  "name": "get-mon-balance",
  "arguments": { "address": "<address>" }
}
```
_Response:_
```
Balance for <address>: 0 MON
```

### View Token Portfolio
```json
{
  "name": "get-token-portfolio",
  "arguments": { "address": "<address>" }
}
```
_Response:_
```
Portfolio for <address> (Popular tokens):
- MON: 10.96 (decimals: 18)
- USDC: 0.86 (decimals: 6)
- ...
```

### Transfer Token (Instructions Only)
```json
{
  "name": "transfer-token",
  "arguments": {
    "from": "<from_address>",
    "to": "<to_address>",
    "amount": "0.1",
    "token": "MON"
  }
}
```
_Response:_
```
Transfer Instructions for MON

To transfer 0.1 MON from <from_address> to <to_address>, you'll need to:
1. Connect your wallet (containing address <from_address>)
2. Send a transaction with the following parameters:
   - To: <to_address>
   - Value: 0.1 MON
   - Gas Limit: Auto (or ~21000)

Please note: This tool provides instructions only. The actual transfer needs to be executed by you using a wallet that controls the sender address.
Alternatively, you can use the 'execute-transfer' tool with your private key (only use test wallets, never your main wallet) to execute the transfer directly.
```

### Transfer Token (Direct Execution)
```json
{
  "name": "execute-transfer",
  "arguments": {
    "to": "<to_address>",
    "amount": "0.1",
    "token": "MON"
  }
}
```
_Response:_
```
✅ Transfer Successful!

0.1 MON has been sent to address:
<to_address>

Transaction Details:
- From: <from_address>
- Hash: <tx_hash>

[View Transaction on Monad Explorer](https://testnet.monadexplorer.com/tx/<tx_hash>)
```

### Token Swap Example
```json
{
  "name": "get-swap-quote",
  "arguments": {
    "fromToken": "MON",
    "toToken": "USDC",
    "amount": "1.0"
  }
}
```
_Response:_
```
## Swap Quote: MON to USDC

- Input: 1.0 MON
- Expected Output: 3.45 USDC
- Rate: 1 MON ≈ 3.450000 USDC

To execute this swap, use the `execute-swap` tool with the same parameters.

Note: Actual swap values may vary slightly due to price movements and slippage.
```

### Execute Swap
```json
{
  "name": "execute-swap",
  "arguments": {
    "fromToken": "MON",
    "toToken": "USDC",
    "amount": "1.0",
    "slippage": 2.0
  }
}
```
_Response:_
```
## ✅ Swap Executed Successfully

Your 1.0 MON has been successfully swapped to approximately 3.45 USDC. The transaction is complete and has been confirmed on the blockchain.

### Transaction Details
- From: <wallet_address>
- Transaction Hash: <tx_hash>
- Block Number: 13845721
- Swapped: 1.0 MON ➡️ 3.45 USDC

### [🔍 View Transaction on Monad Explorer](https://testnet.monadexplorer.com/tx/<tx_hash>)

You can now use your USDC tokens for other operations on Monad testnet.
```

### Staking Example
```json
{
  "name": "execute-stake",
  "arguments": {
    "amount": "5.0"
  }
}
```
_Response:_
```
## ✅ Staking Successful

Your 5.0 MON has been successfully staked and you received 4.98 aprMON. The transaction is complete and has been confirmed on the blockchain.

### Transaction Details
- From: <wallet_address>
- Transaction Hash: <tx_hash>
- Block Number: 13846982
- Staked: 5.0 MON ➡️ 4.98 aprMON

### [🔍 View Transaction on Monad Explorer](https://testnet.monadexplorer.com/tx/<tx_hash>)

Your aprMON represents your staked MON and can be unstaked when needed.
```

### Wrap MON to WMON
```json
{
  "name": "execute-wrap",
  "arguments": { "amount": "0.2" }
}
```
_Response:_
```
✅ Successfully wrapped 0.2 MON to WMON.

Transaction Hash: <tx_hash>

Block Number: <block_number>

[View on Explorer](https://testnet.monadexplorer.com/tx/<tx_hash>)
```

### Natural Language Request
```json
{
  "name": "natural-language-request",
  "arguments": { "request": "warp 0.2 MON to WMON" }
}
```
_Response:_
```
✅ Successfully wrapped 0.2 MON to WMON.

Transaction Hash: <tx_hash>

Block Number: <block_number>

[View on Explorer](https://testnet.monadexplorer.com/tx/<tx_hash>)
```

### NFT: Create Collection & Generate Image
```json
{
  "name": "create-nft-collection",
  "arguments": { "name": "MyNFT", "symbol": "MYN", "image": "<base64>", "artType": "SAME_ARTWORK", ... }
}
```
_Response:_
```
NFT Collection created on Magic Eden (Monad Testnet)...
```

```json
{
  "name": "generate-nft-image",
  "arguments": { "description": "A cute pixel cat", "style": "pixel art" }
}
```
_Response:_
```
[Base64 image data or image URL]
```

## Installation & Running MCP Moni

1. Clone this repository
```shell
git clone https://github.com/deseti/mcp-moni.git
cd mcp-moni
```
2. Install dependencies
```
npm install
```
3. Create a `.env` file in the project root with your test wallet private key:
```
TEST_WALLET_PRIVATE_KEY=your_test_wallet_private_key_here
```
4. Build the project
```
npm run build
```
5. Run the MCP server
```
node build/index.js
```

## Integration with Claude Desktop

1. Open Claude Desktop
2. Go to Settings > Developer
3. Edit `claude_desktop_config.json` and add:
```json
{
  "mcpServers": {
    "mcp-moni": {
      "command": "node",
      "args": ["/<path-to-project>/build/index.js"]
    }
  }
}
```
4. Restart Claude Desktop
5. In Claude, type "@mcp-moni" to activate the MCP server

### Claude Desktop Configuration Explained

The `claude_desktop_config.json` file is where you configure external tools and servers for Claude Desktop to interact with. For MCP Moni, the configuration is structured as follows:

```json
{
  "mcpServers": {
    "mcp-moni": {
      "command": "node",
      "args": ["your project directory/index.js"]
    }
  }
}
```

- **mcpServers**: This section defines all Model Context Protocol servers Claude can interact with
- **mcp-moni**: This is the identifier you'll use to activate the server (with "@mcp-moni" in Claude)
- **command**: The executable to run (in this case, Node.js)
- **args**: The arguments to pass to the command, which should point to your built MCP Moni server file

On Windows, the file is typically located at: `C:\Users\<YourUsername>\AppData\Roaming\Claude\claude_desktop_config.json`

On macOS, the file is typically located at: `~/Library/Application Support/Claude/claude_desktop_config.json`

Once configured, Claude Desktop will be able to start and communicate with your MCP Moni server, giving Claude the ability to interact with the Monad blockchain.

## Configuration Options

The MCP Moni server can be configured using the following environment variables:
- `TEST_WALLET_PRIVATE_KEY`: Private key for the test wallet (required for transactions)
- `RPC_URL`: Custom RPC URL for Monad testnet (optional, defaults to public endpoint)
- `CHAIN_ID`: Chain ID for the Monad network (optional, defaults to testnet)

## Troubleshooting

Common issues and solutions:
- **Connection errors**: Ensure the Monad testnet RPC is accessible
- **Transaction failures**: Check that your test wallet has sufficient MON for gas
- **Missing private key**: Ensure your .env file is properly configured with a test wallet key
- **Tool not found**: Make sure Claude Desktop config points to the correct build path

## Future Development

Planned features and improvements:
- Integration with more tokens and DeFi protocols
- Support for additional NFT marketplaces
- Enhanced analytics and visualization tools
- Multi-wallet management capabilities
- Cross-chain operations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Notes
- "To interact with Moni MCP and wallet, you can add your private key to the .env file. However, please note: use only testnet wallet, never use your main wallet for security reasons.
- Use a test wallet for direct execution features (never use your main wallet!).
- For NFT creation, images must be base64 encoded.

## Resources
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/introduction)
- [Monad Documentation](https://docs.monad.xyz/)
- [Viem Documentation](https://viem.sh/)
- [ERC-20 Token Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-20/)
- [ERC-721 NFT Standard](https://ethereum.org/en/developers/docs/standards/tokens/erc-721/)


## Contact

- [Twitter X](https://x.com/deseti_nad)
- [Github](https://github.com/deseti)