import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import fs from 'fs';
import { config } from '../config';
import { DriveFileMetadata } from '../types';

const auth = new google.auth.GoogleAuth({
    keyFile: config.googleDrive.keyPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
const ROOT_FOLDER_ID = config.googleDrive.rootFolderId;

/**
 * Uploads a file to the specified folder in Google Drive.
 * @param fileBuffer Buffer of the file.
 * @param fileDetails Metadata for the file including name, mimetype, and our custom description.
 * @param targetFolderId ID of the target folder in Google Drive.
 * @returns Promise with the ID of the uploaded file.
 */
export async function uploadFileToDrive(
    fileBuffer: Buffer,
    fileDetails: DriveFileMetadata,
    targetFolderId: string
): Promise<string | undefined> {
    const media = {
        mimeType: fileDetails.mimetype,
        body: Readable.from(fileBuffer), // Use stream from buffer
    };

    const resource: drive_v3.Params$Resource$Files$Create['requestBody'] = {
        name: fileDetails.name,
        parents: [targetFolderId],
        description: fileDetails.description, // JSON string of our metadata
    };

    try {
        const response = await drive.files.create({
            requestBody: resource,
            media: media,
            fields: 'id',
        });
        console.log(`File '${fileDetails.name}' uploaded successfully. File ID: ${response.data.id}`);
        return response.data.id || undefined;
    } catch (error) {
        console.error('Error uploading file to Drive:', error);
        throw error; // Re-throw to be caught by the flow
    }
}

/**
 * Gets the ID of a folder by its name within a parent folder. If it doesn't exist, it creates it.
 * @param folderName Name of the folder to find or create.
 * @param parentFolderId ID of the parent folder. Defaults to ROOT_FOLDER_ID.
 * @returns Promise with the ID of the folder.
 */
export async function getOrCreateFolder(folderName: string, parentFolderId: string = ROOT_FOLDER_ID): Promise<string> {
    if (!parentFolderId) {
        throw new Error("Root folder ID is not configured. Cannot create or find subfolders.");
    }
    try {
        // 1. Search if the folder already exists
        const query = `mimeType='application/vnd.google-apps.folder' and trashed=false and name='${folderName}' and '${parentFolderId}' in parents`;
        let response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        if (response.data.files && response.data.files.length > 0) {
            console.log(`Folder '${folderName}' found with ID: ${response.data.files[0].id}`);
            return response.data.files[0].id!;
        }

        // 2. If not, create it
        console.log(`Folder '${folderName}' not found. Creating it...`);
        const fileMetadata: drive_v3.Params$Resource$Files$Create['requestBody'] = {
            name: folderName,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentFolderId],
        };
        const createResponse = await drive.files.create({
            requestBody: fileMetadata,
            fields: 'id',
        });
        console.log(`Folder '${folderName}' created with ID: ${createResponse.data.id}`);
        return createResponse.data.id!;

    } catch (error) {
        console.error(`Error getting or creating folder '${folderName}':`, error);
        // Attempt to create root NATECO_SAS folder if the error indicates the parent (root) wasn't found
        // This is a basic recovery, might need more robust handling
        if ((error as any).message?.includes('File not found') && parentFolderId === ROOT_FOLDER_ID && folderName === config.googleDrive.initialSubFolders.products) { // Example check
             console.warn(`Root folder NATECO_SAS might not exist or is not accessible. Ensure GOOGLE_DRIVE_ROOT_FOLDER_ID is correct and the service account has permissions.`);
        }
        throw error;
    }
}

/**
 * Helper to initialize predefined subfolders if they don't exist.
 * Call this once at startup or when needed.
 */
export async function initializeDriveFolders(): Promise<void> {
    if (!ROOT_FOLDER_ID) {
        console.warn("GOOGLE_DRIVE_ROOT_FOLDER_ID is not set. Skipping folder initialization.");
        return;
    }
    console.log(`Initializing Drive folders under root ID: ${ROOT_FOLDER_ID}`);
    const subfolders: string[] = Object.values(config.googleDrive.initialSubFolders) as string[];
    for (const folderName of subfolders) {
        try {
            await getOrCreateFolder(folderName, ROOT_FOLDER_ID);
        } catch (error) {
            console.error(`Failed to initialize folder: ${folderName}`, error);
            // Decide if you want to stop initialization or continue
        }
    }
    console.log("Drive folder initialization check complete.");
}