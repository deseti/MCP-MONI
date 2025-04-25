/**
 * Type definitions for NFT functionality
 */

// Enum for NFT artwork type
export enum NFTArtType {
  SAME_ARTWORK = "SAME_ARTWORK",
  UNIQUE_ARTWORK = "UNIQUE_ARTWORK"
}

// Mint stage for NFT collection
export interface MintStage {
  name: string;
  price: string;
  startDate: string;
  endDate: string;
  isAllowlist: boolean;
  allowlistAddresses?: string[];
}

// NFT collection metadata
export interface NFTMetadata {
  name: string;
  symbol: string;
  description?: string;
  image: string;
  feeRecipient?: string; // Address that receives the royalty
}

// NFT collection configuration
export interface NFTCollectionConfig {
  chain: "MONAD_TESTNET";
  metadata: NFTMetadata;
  artType: NFTArtType;
  mintPrice: string;
  royaltyFee: number;
  maxSupply: number | null;
  mintLimitPerWallet: number | null;
  mintStages: MintStage[];
  artworks?: string[];
}

// Result of NFT creation
export interface NFTCreationResult {
  success: boolean;
  collectionAddress?: string;
  transactionHash?: string;
  configTransactionHash?: string; // Transaction hash for collection configuration
  magicEdenUrl?: string;
  error?: string;
}

// Result of image upload
export interface ImageUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}