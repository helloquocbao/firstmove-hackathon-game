import { useCallback, useState } from "react";
import {
  useCurrentAccount,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { WalrusFile } from "@mysten/walrus";
import { SuiClient } from "@mysten/sui/client";
import { SUI_RPC_URL } from "../chain/config";

// Walrus configuration
const WALRUS_EPOCHS = 3;
const WALRUS_NETWORK = "testnet";
const WALRUS_WASM_URL =
  "https://unpkg.com/@mysten/walrus-wasm@latest/web/walrus_wasm_bg.wasm";
const WALRUS_UPLOAD_RELAY = "https://upload-relay.testnet.walrus.space";
const WALRUS_GATEWAY = "https://wal-aggregator-testnet.staketab.org/v1/blobs/by-quilt-patch-id";

/**
 * Get Walrus image URL from patchId
 */
export const getWalrusImageUrl = (patchId: string): string =>
  `${WALRUS_GATEWAY}/${patchId}`;

/**
 * Create Walrus client with Sui extension
 */
const createWalrusClient = async () => {
  const { walrus } = await import("@mysten/walrus");
  const client = new SuiClient({ url: SUI_RPC_URL });
  return client.$extend(
    walrus({
      wasmUrl: WALRUS_WASM_URL,
      network: WALRUS_NETWORK,
      uploadRelay: {
        host: WALRUS_UPLOAD_RELAY,
        sendTip: {
          max: 1_000,
        },
      },
    })
  );
};

/**
 * Create WalrusFile from bytes
 */
const walrusFileFromBytes = (
  name: string,
  bytes: Uint8Array,
  contentType: string
) =>
  WalrusFile.from({
    contents: bytes,
    identifier: name,
    tags: {
      "content-type": contentType,
      "file-name": name,
    },
  });

/**
 * Hook for uploading chunk map images to Walrus
 * Simplified version focused on image uploads for map thumbnails
 */
export function useWalrusUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction();

  /**
   * Execute transaction with promise wrapper
   */
  const executeTransaction = useCallback(
    (tx: any): Promise<string> =>
      new Promise((resolve, reject) => {
        signAndExecuteTransaction(
          { transaction: tx },
          {
            onSuccess: (result) => resolve(result.digest),
            onError: (err) => reject(err),
          }
        );
      }),
    [signAndExecuteTransaction]
  );

  /**
   * Upload a single image to Walrus
   * @param imageBlob - Blob or File of the image
   * @param fileName - Optional custom filename
   * @returns Object with blobId and patchId
   */
  const uploadImage = useCallback(
    async (
      imageBlob: Blob,
      fileName?: string
    ): Promise<{ status: "success"; blobId: string; patchId: string; url: string }> => {
      if (!account) {
        throw new Error("Wallet not connected");
      }

      setUploadError(null);
      setIsUploading(true);

      try {
        const client = await createWalrusClient();

        const buffer = await imageBlob.arrayBuffer();
        const name = fileName || `chunk-map-${Date.now()}.png`;
        const files = [
          walrusFileFromBytes(
            name,
            new Uint8Array(buffer),
            imageBlob.type || "image/png"
          ),
        ];

        const flow = client.walrus.writeFilesFlow({ files });
        await flow.encode();

        // Register
        const registerTx = flow.register({
          epochs: WALRUS_EPOCHS,
          owner: account.address,
          deletable: true,
        });
        const registerDigest = await executeTransaction(registerTx);

        // Upload
        await flow.upload({ digest: registerDigest });

        // Certify
        const certifyTx = flow.certify();
        await executeTransaction(certifyTx);

        // Get results
        const uploaded = await flow.listFiles();
        if (!uploaded.length) {
          throw new Error("Upload failed: no files returned");
        }

        const imageFile = uploaded[0];
        const blobId = imageFile.blobId;
        const patchId = imageFile.id;

        // Construct public URL using patchId
        const url = getWalrusImageUrl(patchId);

        return { status: "success", blobId, patchId, url };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setUploadError(message);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    [account, executeTransaction]
  );

  /**
   * Upload canvas element as image to Walrus
   * Convenient for capturing game/editor canvas
   * @param canvas - HTMLCanvasElement to capture
   * @param fileName - Optional filename
   */
  const uploadCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
      fileName?: string
    ): Promise<{ status: "success"; blobId: string; patchId: string; url: string }> => {
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to capture canvas"));
              return;
            }
            try {
              const result = await uploadImage(blob, fileName);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          "image/png",
          1.0
        );
      });
    },
    [uploadImage]
  );

  /**
   * Upload base64 image string to Walrus
   * @param base64 - Base64 encoded image string (with or without data URI prefix)
   * @param fileName - Optional filename
   */
  const uploadBase64 = useCallback(
    async (
      base64: string,
      fileName?: string
    ): Promise<{ status: "success"; blobId: string; patchId: string; url: string }> => {
      // Remove data URI prefix if present
      const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;

      // Decode base64 to bytes
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: "image/png" });
      return uploadImage(blob, fileName);
    },
    [uploadImage]
  );

  /**
   * Clear any upload error
   */
  const clearError = useCallback(() => {
    setUploadError(null);
  }, []);

  return {
    uploadImage,
    uploadCanvas,
    uploadBase64,
    isUploading,
    uploadError,
    clearError,
  };
}
