import { create } from "zustand";
import {
  AuthService,
  FileStorageService,
  KVService,
  AIService,
  ServiceManager,
  ServiceResult,
  AuthUser,
  FileItem,
  AIMessage,
  AIResponse
} from "./index";

// Helper to get Puter from window
const getPuter = (): typeof window.puter | null =>
  typeof window !== "undefined" && window.puter ? window.puter : null;

// Puter Auth Service Implementation
class PuterAuthService implements AuthService {
  async getUser(): Promise<ServiceResult<AuthUser>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const user = await puter.auth.getUser();
      return {
        data: {
          id: user.id || user.uuid || "",
          name: user.name || user.username || "",
          email: user.email || ""
        }
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Failed to get user"
      };
    }
  }

  async isSignedIn(): Promise<boolean> {
    const puter = getPuter();
    if (!puter) {
      return false;
    }

    try {
      return await puter.auth.isSignedIn();
    } catch (err) {
      console.error("Error checking sign-in status:", err);
      return false;
    }
  }

  async signIn(): Promise<ServiceResult<void>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      await puter.auth.signIn();
      return { data: undefined };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Sign in failed"
      };
    }
  }

  async signOut(): Promise<ServiceResult<void>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      await puter.auth.signOut();
      return { data: undefined };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Sign out failed"
      };
    }
  }
}

// Puter File Storage Service Implementation
class PuterFileStorageService implements FileStorageService {
  async upload(files: File[] | Blob[]): Promise<ServiceResult<FileItem>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      // Create a promise that rejects after a timeout
      const uploadTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("File upload timed out after 60 seconds"));
        }, 60000); // 60 seconds timeout
      });

      // Race the upload against the timeout
      const result = await Promise.race([
        puter.fs.upload(files),
        uploadTimeoutPromise
      ]);

      return {
        data: {
          id: result.id || result.uuid || "",
          name: result.name || "",
          path: result.path || "",
          url: result.url || "",
          size: result.size,
          type: result.type
        }
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Upload failed"
      };
    }
  }

  async read(path: string): Promise<ServiceResult<Blob>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const blob = await puter.fs.read(path);
      return { data: blob };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Read failed"
      };
    }
  }

  async write(path: string, data: string | File | Blob): Promise<ServiceResult<FileItem>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.fs.write(path, data);
      if (!result) {
        return { error: "Write operation returned no result" };
      }
      
      return {
        data: {
          id: result.id || result.uuid || "",
          name: result.name || "",
          path: result.path || "",
          url: result.url || "",
          size: result.size,
          type: result.type
        }
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Write failed"
      };
    }
  }

  async delete(path: string): Promise<ServiceResult<void>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      await puter.fs.delete(path);
      return { data: undefined };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Delete failed"
      };
    }
  }

  async list(path: string): Promise<ServiceResult<FileItem[]>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const items = await puter.fs.readdir(path);
      if (!items) {
        return { data: [] };
      }
      
      return {
        data: items.map(item => ({
          id: item.id || item.uuid || "",
          name: item.name || "",
          path: item.path || "",
          url: item.url || "",
          size: item.size,
          type: item.type
        }))
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "List operation failed"
      };
    }
  }
}

// Puter Key-Value Store Service Implementation
class PuterKVService implements KVService {
  async get(key: string): Promise<ServiceResult<string | null>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      // Create a promise that rejects after a timeout
      const kvTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Key-value store get operation timed out after 30 seconds"));
        }, 30000); // 30 seconds timeout
      });

      // Race the key-value store operation against the timeout
      const result = await Promise.race([
        puter.kv.get(key),
        kvTimeoutPromise
      ]);

      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Get operation failed"
      };
    }
  }

  async set(key: string, value: string): Promise<ServiceResult<boolean>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      // Create a promise that rejects after a timeout
      const kvTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("Key-value store set operation timed out after 60 seconds"));
        }, 60000); // 60 seconds timeout
      });

      // Race the key-value store operation against the timeout
      const result = await Promise.race([
        puter.kv.set(key, value),
        kvTimeoutPromise
      ]);

      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Set operation failed"
      };
    }
  }

  async delete(key: string): Promise<ServiceResult<boolean>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.kv.delete(key);
      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Delete operation failed"
      };
    }
  }

  async list(pattern: string, returnValues: boolean = false): Promise<ServiceResult<string[]>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.kv.list(pattern, returnValues);
      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "List operation failed"
      };
    }
  }

  async flush(): Promise<ServiceResult<boolean>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.kv.flush();
      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Flush operation failed"
      };
    }
  }
}

// Puter AI Service Implementation
class PuterAIService implements AIService {
  async chat(
    prompt: string | AIMessage[],
    options?: any
  ): Promise<ServiceResult<AIResponse>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.ai.chat(prompt, options);
      return { data: result as AIResponse };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Chat operation failed"
      };
    }
  }

  async feedback(file: string | File, message: string): Promise<ServiceResult<AIResponse>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      // Create a promise that rejects after a timeout
      const feedbackTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error("AI feedback operation timed out after 120 seconds"));
        }, 120000); // 120 seconds timeout (2 minutes)
      });

      // For file paths (strings)
      if (typeof file === 'string') {
        // Race the AI feedback operation against the timeout
        const result = await Promise.race([
          puter.ai.chat(
            [
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    puter_path: file,
                  },
                  {
                    type: "text",
                    text: message,
                  },
                ],
              },
            ],
            { model: "claude-3-7-sonnet" }
          ),
          feedbackTimeoutPromise
        ]);

        return { data: result as AIResponse };
      } 
      // For File objects, we need to upload them first
      else {
        // This is a simplified approach - in a real implementation, 
        // you might want to handle this differently
        const uploadResult = await this.uploadFileForAI(file);
        if (uploadResult.error) {
          return { error: uploadResult.error };
        }

        const filePath = uploadResult.data;
        
        // Race the AI feedback operation against the timeout
        const result = await Promise.race([
          puter.ai.chat(
            [
              {
                role: "user",
                content: [
                  {
                    type: "file",
                    puter_path: filePath,
                  },
                  {
                    type: "text",
                    text: message,
                  },
                ],
              },
            ],
            { model: "claude-3-7-sonnet" }
          ),
          feedbackTimeoutPromise
        ]);

        return { data: result as AIResponse };
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Feedback operation failed"
      };
    }
  }

  private async uploadFileForAI(file: File): Promise<ServiceResult<string>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.fs.upload([file]);
      return { data: result.path };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "File upload for AI failed"
      };
    }
  }

  async img2txt(image: string | File | Blob): Promise<ServiceResult<string>> {
    const puter = getPuter();
    if (!puter) {
      return { error: "Puter.js not available" };
    }

    try {
      const result = await puter.ai.img2txt(image);
      return { data: result };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Image-to-text operation failed"
      };
    }
  }
}

// Create Puter Service Manager
interface PuterServiceState extends ServiceManager {
  init: () => void;
}

export const createPuterServices = () => {
  // Create service instances
  const authService = new PuterAuthService();
  const fileStorageService = new PuterFileStorageService();
  const kvService = new PuterKVService();
  const aiService = new PuterAIService();

  // Create and return the store
  return create<PuterServiceState>((set, get) => {
    const init = (): void => {
      const puter = getPuter();
      if (puter) {
        set({ isLoading: false, puterReady: true });
        return;
      }

      set({ isLoading: true });
      const interval = setInterval(() => {
        if (getPuter()) {
          clearInterval(interval);
          set({ isLoading: false, puterReady: true });
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        if (!getPuter()) {
          set({ 
            error: "Puter.js failed to load within 10 seconds",
            isLoading: false
          });
        }
      }, 10000);
    };

    return {
      auth: authService,
      fs: fileStorageService,
      kv: kvService,
      ai: aiService,
      isLoading: true,
      error: null,
      clearError: () => set({ error: null }),
      init
    };
  })();
};