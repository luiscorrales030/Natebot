import { BotContext } from '@builderbot/bot/dist/types';

export interface ClassificationResult {
  category: string;
  confidence: number;
  justification: string;
}

export interface MediaFile {
  originalName: string;
  mimetype: string;
  buffer?: Buffer; // Buffer might not always be available if provider gives URL
  url?: string;    // URL from WhatsApp
  localPath?: string; // Path after download
}

// Extends BotContext to include our custom state structure
export interface NateBotContext extends BotContext {
    state: {
        get: (key: string) => any;
        update: (newState: Partial<SessionData>) => Promise<void>;
        getAll: () => SessionData;
    }
}
export interface SessionData {
  currentState?: string;
  mediaFiles?: MediaFile[]; // Array to hold multiple files if sent in batch
  currentFileIndex?: number; // To iterate through mediaFiles
  currentFile?: MediaFile;
  classificationResult?: ClassificationResult;
  confirmedCategory?: string;
  customFileName?: string;
  userTags?: string[];
  userComments?: string;
}

export interface DriveFileMetadata {
    name: string;
    mimetype: string;
    description: string; // Will store JSON string of our metadata
    originalName?: string;
    category?: string;
    confidence?: number;
    justification?: string;
    tags?: string[];
    source?: string;
    uploadTimestamp?: string;
    userComments?: string;
}