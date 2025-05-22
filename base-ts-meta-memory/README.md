<p align="center">
  <a href="https://builderbot.vercel.app/">
    <picture>
      <img src="https://builderbot.vercel.app/assets/thumbnail-vector.png" height="80">
    </picture>
    <h2 align="center">NateBot Pro (using BuilderBot)</h2>
  </a>
</p>

<p align="center">
  NateBot Pro is an advanced WhatsApp chatbot built with BuilderBot, integrated with Google Drive for file storage and Google Gemini for AI-powered media classification.
</p>

<p align="center">
  <a aria-label="NPM version" href="https://www.npmjs.com/package/@builderbot/bot">
    <img alt="" src="https://img.shields.io/npm/v/@builderbot/bot?color=%2300c200&label=%40builderbot/bot">
  </a>
  <a aria-label="Join the community on GitHub" href="https://link.codigoencasa.com/DISCORD">
    <img alt="" src="https://img.shields.io/discord/915193197645402142?logo=discord">
  </a>
</p>

## Features

* **WhatsApp Integration**: Connects to WhatsApp using the Meta Business API via BuilderBot.
* **Google Drive Upload**: Automatically uploads received media (images, documents, videos, audio) to designated Google Drive folders.
* **AI Media Classification**: Uses Google Gemini API to suggest categories for uploaded media.
* **Dynamic Folder Creation**: Creates category folders in Google Drive if they don't exist.
* **Custom File Naming**: Allows users to confirm or change categories, and rename files before upload.
* **Metadata Storage**: Stores relevant metadata (original name, classification details, user tags, comments) in the file's description on Google Drive.
* **Interactive Dialogs**: Guides the user through the classification and upload process using WhatsApp buttons.

## Prerequisites

* Node.js (>=18.0.0 recommended)
* npm or yarn
* Access to WhatsApp Business API (Meta Developer Account)
* Google Cloud Platform Account (for Google Drive API and Gemini API)
* Google AI Studio Account (for Gemini API key)

## Setup

1.  **Clone the repository (or use your existing NateBot Pro base):**
    ```bash
    # If you have the original structure:
    # cd luiscorrales030/natebot/luiscorrales030-Natebot-51e49e933e45c73a2e03faba961ce9be3baac1a9/base-ts-meta-memory
    # Otherwise, clone and navigate to the project root (where this README is).
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment Variables:**
    * Rename `.env.example` to `.env`.
    * Fill in the required values in `.env` as per the instructions within the file. This includes:
        * Meta WhatsApp API credentials (`META_JWT_TOKEN`, `META_NUMBER_ID`, `META_VERIFY_TOKEN`).
        * Google Drive API settings (`GOOGLE_DRIVE_KEY_PATH`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, and initial subfolder names).
        * Gemini API key (`GEMINI_API_KEY`).

    **Google Drive Setup:**
    * Go to the [Google Cloud Console](https://console.cloud.google.com/).
    * Create a new project or select an existing one.
    * Enable the "Google Drive API" for your project.
    * Navigate to "IAM & Admin" > "Service Accounts".
    * Create a new service account. Grant it a name (e.g., "natebot-drive-uploader").
    * Download the JSON key file for this service account. Store it securely (e.g., in the project root, but ensure it's in your `.gitignore` if the path is committed) and update `GOOGLE_DRIVE_KEY_PATH` in your `.env` file to point to its location.
    * Create a root folder in your Google Drive (e.g., "NATECO_SAS").
    * Get the Folder ID from the URL (it's the last part of the URL when you open the folder). Set this as `GOOGLE_DRIVE_ROOT_FOLDER_ID` in your `.env`.
    * **Crucially, share this root Google Drive folder with the email address of the service account you created, granting it "Editor" or "Content manager" permissions.**

    **Gemini API Setup:**
    * Go to [Google AI Studio](https://aistudio.google.com/).
    * Create a new API key.
    * Set this key as `GEMINI_API_KEY` in your `.env` file.
    * Verify the `GEMINI_VISION_ENDPOINT` in `.env` points to a suitable model (e.g., `gemini-1.5-flash-latest`).

4.  **Build the project (for production):**
    ```bash
    npm run build
    ```

## Running the Bot

* **Development (with auto-reload):**
    ```bash
    npm run dev
    ```
* **Production (after building):**
    ```bash
    npm run start
    ```

The bot will start, and you should see a message indicating the port it's listening on and your webhook URL (e.g., `http://localhost:3008/webhook`). You'll need to configure this webhook URL in your Meta Developer App settings for WhatsApp.

## Flujo de Clasificación y Subida

1.  **User Sends Media:** The user sends an image, document, video, or audio file to the WhatsApp bot.
2.  **Media Reception:** `mediaFlow.ts` intercepts the media.
3.  **AI Classification:** The media is sent to the Gemini API for classification into predefined categories.
4.  **User Confirmation:** The bot presents Gemini's suggested category, confidence score, and justification to the user with options:
    * Confirm the suggested category.
    * Choose a different category from a list.
    * Cancel the upload for that file.
5.  **Renaming (Optional):** The user is asked if they want to rename the file.
6.  **Metadata Input (Optional):** The user can add comma-separated tags and a brief comment.
7.  **Google Drive Upload:**
    * A target folder corresponding to the (confirmed or chosen) category is either found or created under the main `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
    * The file is renamed using a standard format: `Category_YYYYMMDD_Sequence.extension` or the user-provided custom name.
    * The file is uploaded to the target folder.
    * A JSON string containing metadata (original name, category, classification details, tags, comments, source, timestamp) is saved in the "Description" field of the file on Google Drive.
8.  **Confirmation to User:** The bot confirms the successful upload and the final file name.
9.  **Batch Handling:** If multiple files are sent, they are queued and processed one by one.

## Project Structure Overview

* `src/`: Contains the main source code.
    * `app.ts`: Main application entry point, initializes the bot.
    * `config/`: Configuration loader for environment variables.
    * `flows/`: Contains BuilderBot flow definitions.
        * `mainFlow.ts`: Handles welcome messages and initial interactions.
        * `mediaFlow.ts`: Core logic for handling media, classification, and upload.
    * `provider/`: Configures the WhatsApp provider (Meta).
    * `services/`: Contains business logic and integrations.
        * `classificationService.ts`: Interacts with the Gemini API.
        * `driveService.ts`: Interacts with the Google Drive API.
        * `sessionManager.ts`: Defines conversation states (used with BuilderBot's `ctx.state`).
    * `types/`: TypeScript type definitions.
* `.env.example`: Template for environment variables.
* `package.json`: Project dependencies and scripts.
* `rollup.config.js`: Configuration for Rollup (bundler).
* `tsconfig.json`: TypeScript compiler options.

## Further Development & Considerations

* **Persistent Session Management**: For production, replace `MemoryDB` with a persistent database adapter for BuilderBot (e.g., Redis, MongoDB) if handling many concurrent users or requiring session persistence across restarts.
* **Error Handling**: Enhance error handling and provide more user-friendly feedback for API failures.
* **Advanced Sequencing for Files**: Implement a more robust file sequencing mechanism in `driveService.ts` to avoid overwrites if multiple files are uploaded to the same category on the same day (e.g., by querying existing files).
* **Document Text Extraction (OCR)**: For document classification beyond visual cues, integrate an OCR service or library to extract text from PDFs/images before sending to Gemini for text-based analysis.
* **More Granular Drive Permissions**: Instead of "Editor" on the root, explore setting specific permissions for the service account on subfolders if needed.
* **Testing**: Implement unit and integration tests for services and flows.
* **Webhook Security**: Ensure your webhook endpoint is secured in a production environment.
* **Batch Classification**: The current flow processes files individually from a batch. For true "classify all together" functionality as hinted in the tutorial, `classificationService` would need to be adapted to handle multiple files in one Gemini call (if supported) or the flow logic significantly altered to collect all files, send for classification, then present a summary for group confirmation.

## Contact Us
- [💻 Discord (BuilderBot Community)](https://link.codigoencasa.com/DISCORD)
- [👌 𝕏 (Twitter - Leifer Mendez, creator of BuilderBot)](https://twitter.com/leifermendez)