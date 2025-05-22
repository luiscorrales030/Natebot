// Defines the states our bot can be in during a conversation.
export const SESSION_STATES = {
  IDLE: 'IDLE', // Default state
  AWAITING_FILE_UPLOAD: 'AWAITING_FILE_UPLOAD', // User prompted to send files
  MEDIA_RECEIVED: 'MEDIA_RECEIVED', // Media has been intercepted by mediaFlow
  AWAITING_CLASSIFICATION_CONFIRMATION: 'AWAITING_CLASSIFICATION_CONFIRMATION', // User sees Gemini's suggestion
  AWAITING_CATEGORY_CHOICE: 'AWAITING_CATEGORY_CHOICE', // User chose "Other category"
  AWAITING_CUSTOM_CATEGORY_NAME: 'AWAITING_CUSTOM_CATEGORY_NAME', // User is typing a custom category name
  AWAITING_RENAME_CONFIRMATION: 'AWAITING_RENAME_CONFIRMATION', // Ask if user wants to rename
  AWAITING_CUSTOM_FILE_NAME: 'AWAITING_CUSTOM_FILE_NAME', // User is typing a custom file name
  AWAITING_TAGS: 'AWAITING_TAGS', // Asking for tags
  AWAITING_COMMENTS: 'AWAITING_COMMENTS', // Asking for comments
  UPLOADING_FILE: 'UPLOADING_FILE', // File is being uploaded
};


// Utility functions for session management can be added here if needed,
// but primarily we will use ctx.state.update and ctx.state.get directly in flows.
// For example, a helper to clear session data for the next file:
// export function resetFileProcessingState(currentState: SessionData): Partial<SessionData> {
//   return {
//     currentFile: undefined,
//     classificationResult: undefined,
//     confirmedCategory: undefined,
//     customFileName: undefined,
//     userTags: undefined,
//     userComments: undefined,
//   };
// }

// Note: BuilderBot's ctx.state is already per-user.
// The MemoryDB stores this state in memory. For production, consider a persistent DB adapter for BuilderBot.