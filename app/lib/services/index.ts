// Service interfaces and factory

// Common interfaces
export interface ServiceResult<T> {
  data?: T;
  error?: string;
}

// Auth Service
export interface AuthUser {
  id: string;
  name?: string;
  email?: string;
}

export interface AuthService {
  getUser: () => Promise<ServiceResult<AuthUser>>;
  isSignedIn: () => Promise<boolean>;
  signIn: () => Promise<ServiceResult<void>>;
  signOut: () => Promise<ServiceResult<void>>;
}

// File Storage Service
export interface FileItem {
  id: string;
  name: string;
  path: string;
  url: string;
  size?: number;
  type?: string;
}

export interface FileStorageService {
  upload: (files: File[] | Blob[]) => Promise<ServiceResult<FileItem>>;
  read: (path: string) => Promise<ServiceResult<Blob>>;
  write: (path: string, data: string | File | Blob) => Promise<ServiceResult<FileItem>>;
  delete: (path: string) => Promise<ServiceResult<void>>;
  list: (path: string) => Promise<ServiceResult<FileItem[]>>;
}

// Key-Value Store Service
export interface KVService {
  get: (key: string) => Promise<ServiceResult<string | null>>;
  set: (key: string, value: string) => Promise<ServiceResult<boolean>>;
  delete: (key: string) => Promise<ServiceResult<boolean>>;
  list: (pattern: string, returnValues?: boolean) => Promise<ServiceResult<string[]>>;
  flush: () => Promise<ServiceResult<boolean>>;
}

// AI Service
export interface AIMessage {
  role: string;
  content: string | { type: string; text?: string; [key: string]: any }[];
}

export interface AIResponse {
  message: {
    content: string | { type: string; text: string }[];
  };
}

export interface AIService {
  chat: (
    prompt: string | AIMessage[],
    options?: any
  ) => Promise<ServiceResult<AIResponse>>;
  feedback: (
    file: File | string,
    message: string
  ) => Promise<ServiceResult<AIResponse>>;
  img2txt: (image: string | File | Blob) => Promise<ServiceResult<string>>;
}

// Service Manager
export interface ServiceManager {
  auth: AuthService;
  fs: FileStorageService;
  kv: KVService;
  ai: AIService;
  isLoading: boolean;
  error: string | null;
  clearError: () => void;
}

// Service Provider Types
export enum ServiceProvider {
  PUTER = 'puter',
  FIREBASE = 'firebase',
  LOCAL = 'local',
  OPENAI = 'openai',
  HYBRID = 'hybrid'
}

// Service Factory
export const createServiceManager = (provider: ServiceProvider): ServiceManager => {
  switch (provider) {
    case ServiceProvider.PUTER:
      return import('./puter').then(module => module.createPuterServices());
    case ServiceProvider.FIREBASE:
      return import('./firebase').then(module => module.createFirebaseServices());
    case ServiceProvider.LOCAL:
      return import('./local').then(module => module.createLocalServices());
    case ServiceProvider.OPENAI:
      return import('./openai').then(module => module.createOpenAIServices());
    case ServiceProvider.HYBRID:
      return import('./hybrid').then(module => module.createHybridServices());
    default:
      throw new Error(`Unsupported service provider: ${provider}`);
  }
};