import { useCallback, useMemo, useState } from "react";

type UploadResult = {
  status: "success";
  blobId: string;
  url: string;
};

// Walrus testnet publishers - try multiple if one fails
// List from https://docs.walrus.site/usage/public-services.html
const WALRUS_PUBLISHERS = [
  "/walrus-pub-1",  // publisher.walrus-testnet.walrus.space (official)
  "/walrus-pub-2",  // walrus-testnet-publisher.nodes.guru
  "/walrus-pub-3",  // publisher.testnet.blob.store
  "/walrus-pub-4",  // walrus-publish-testnet.chainode.tech
  "/walrus-pub-5",  // testnet-publisher.walrus.space
];

const WALRUS_AGGREGATOR =
  import.meta.env.VITE_WALRUS_AGGREGATOR ??
  "https://aggregator.walrus-testnet.walrus.space";
const WALRUS_EPOCHS = Number(import.meta.env.VITE_WALRUS_EPOCHS ?? 5);

/**
 * Build Walrus public image URL from blobId
 */
export const getWalrusImageUrl = (blobId: string): string =>
  `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;

/**
 * Upload blob to Walrus via Publisher HTTP API with fallback and retry
 */
async function uploadToWalrusPublisher(
  data: Uint8Array,
  epochs: number = WALRUS_EPOCHS,
  maxRetries: number = 10,
  retryDelay: number = 2000
): Promise<{ blobId: string; url: string }> {
  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    console.log(`Walrus upload attempt ${attempt}/${maxRetries}`);

    for (const publisher of WALRUS_PUBLISHERS) {
      try {
        const url = `${publisher}/v1/blobs?epochs=${epochs}`;
        console.log(`Trying publisher: ${publisher}`);

        const response = await fetch(url, {
          method: "PUT",
          headers: {
            "Content-Type": "application/octet-stream",
          },
          body: data,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.warn(`${publisher} failed: ${response.status}`);
          continue; // Try next publisher
        }

        const result = await response.json();

        let blobId: string;
        if (result.newlyCreated) {
          blobId = result.newlyCreated.blobObject.blobId;
        } else if (result.alreadyCertified) {
          blobId = result.alreadyCertified.blobId;
        } else {
          console.warn(`${publisher}: unexpected response format`);
          continue;
        }

        console.log(`✅ Upload success via ${publisher}, blobId: ${blobId}`);
        return {
          blobId,
          url: getWalrusImageUrl(blobId),
        };
      } catch (error) {
        console.warn(`${publisher} error:`, error);
      }
    }

    // All publishers failed this round, wait and retry
    if (attempt < maxRetries) {
      console.log(`All publishers failed. Retrying in ${retryDelay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(`Walrus upload failed after ${maxRetries} attempts. All publishers unavailable.`);
}

const decodeBase64 = (base64: string) => {
  const base64Data = base64.includes(",") ? base64.split(",")[1] : base64;
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const assertImageType = (type: string) => {
  if (!type.startsWith("image/")) {
    throw new Error("Only image uploads are supported");
  }
};

/**
 * Walrus image uploader hook using Publisher HTTP API
 * Simple approach without WASM - just HTTP PUT to publisher
 */
export function useWalrusImageUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const uploadBlob = useCallback(
    async (blob: Blob, _fileName?: string): Promise<UploadResult> => {
      setUploadError(null);
      setIsUploading(true);

      try {
        const contentType = blob.type || "image/png";
        assertImageType(contentType);

        const buffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(buffer);

        const result = await uploadToWalrusPublisher(bytes, WALRUS_EPOCHS);

        return {
          status: "success",
          blobId: result.blobId,
          url: result.url,
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Upload failed";
        setUploadError(message);
        throw error;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const uploadFile = useCallback(
    async (file: File): Promise<UploadResult> => uploadBlob(file, file.name),
    [uploadBlob]
  );

  const uploadCanvas = useCallback(
    async (
      canvas: HTMLCanvasElement,
      fileName?: string
    ): Promise<UploadResult> =>
      new Promise((resolve, reject) => {
        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              reject(new Error("Failed to capture canvas"));
              return;
            }
            try {
              const result = await uploadBlob(blob, fileName);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          },
          "image/png",
          1
        );
      }),
    [uploadBlob]
  );

  const uploadBase64 = useCallback(
    async (base64: string, fileName?: string): Promise<UploadResult> => {
      const bytes = decodeBase64(base64);
      const blob = new Blob([bytes], { type: "image/png" });
      return uploadBlob(blob, fileName);
    },
    [uploadBlob]
  );

  const clearError = useCallback(() => setUploadError(null), []);

  return useMemo(
    () => ({
      uploadBlob,
      uploadFile,
      uploadCanvas,
      uploadBase64,
      isUploading,
      uploadError,
      clearError,
    }),
    [
      uploadBase64,
      uploadBlob,
      uploadCanvas,
      uploadError,
      uploadFile,
      isUploading,
      clearError,
    ]
  );
}

// Backward-compatible export keeping the old hook name
export function useWalrusUpload() {
  return useWalrusImageUpload();
}
