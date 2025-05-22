import "dotenv/config";

export const config = {
  PORT: process.env.PORT ?? 3008,

  // Meta Provider Config
  meta: {
    jwtToken: process.env.META_JWT_TOKEN || "",
    numberId: process.env.META_NUMBER_ID || "",
    verifyToken: process.env.META_VERIFY_TOKEN || "",
    version: process.env.META_VERSION || "v20.0",
  },

  // Google Drive Config
  googleDrive: {
    keyPath: process.env.GOOGLE_DRIVE_KEY_PATH || "",
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || "",
    initialSubFolders: {
        products: process.env.DRIVE_FOLDER_PRODUCTS || "Imágenes_y_Videos_de_Productos",
        documents: process.env.DRIVE_FOLDER_DOCUMENTS || "Documentos_Papeleos_Lecturas",
        production: process.env.DRIVE_FOLDER_PRODUCTION || "Área_de_Producción",
        awards: process.env.DRIVE_FOLDER_AWARDS || "Premios_y_Certificaciones",
        conferences: process.env.DRIVE_FOLDER_CONFERENCES || "Conferencias_y_Presentaciones",
        ideas: process.env.DRIVE_FOLDER_IDEAS || "Ideas_e_Inspiración",
  
  // (Inside config object in src/config/index.ts)
  // ... other configs
  natecoCategories: [
    process.env.DRIVE_FOLDER_PRODUCTS || "Imágenes_y_Videos_de_Productos",
    process.env.DRIVE_FOLDER_DOCUMENTS || "Documentos_Papeleos_Lecturas",
    process.env.DRIVE_FOLDER_PRODUCTION || "Área_de_Producción",
    process.env.DRIVE_FOLDER_AWARDS || "Premios_y_Certificaciones",
    process.env.DRIVE_FOLDER_CONFERENCES || "Conferencias_y_Presentaciones",
    process.env.DRIVE_FOLDER_IDEAS || "Ideas_e_Inspiración",
  ],
// ...      

      }
  },

  // Gemini API Config
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    visionEndpoint: process.env.GEMINI_VISION_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent",
    confidenceThreshold: parseFloat(process.env.CONFIDENCE_THRESHOLD || "0.7"),
    categoriesPrompt: `Please classify the provided media into one of the following NATECO categories:
      - ${process.env.DRIVE_FOLDER_PRODUCTS || "Imágenes_y_Videos_de_Productos"}
      - ${process.env.DRIVE_FOLDER_DOCUMENTS || "Documentos_Papeleos_Lecturas"}
      - ${process.env.DRIVE_FOLDER_PRODUCTION || "Área_de_Producción"}
      - ${process.env.DRIVE_FOLDER_AWARDS || "Premios_y_Certificaciones"}
      - ${process.env.DRIVE_FOLDER_CONFERENCES || "Conferencias_y_Presentaciones"}
      - ${process.env.DRIVE_FOLDER_IDEAS || "Ideas_e_Inspiración"}
      - Otra (Specify if none of the above fit)
      Provide the category name exactly as listed, a confidence score (0.0-1.0), and a brief justification. Format the response as a JSON object like: {"category": "CATEGORY_NAME", "confidence": 0.X, "justification": "Brief reason..."}`
  },

  // Other app settings
  defaultCategory: "General",
};