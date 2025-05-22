import axios from 'axios';
import { config } from '../config';
import { ClassificationResult, MediaFile } from '../types';

const GEMINI_API_KEY = config.gemini.apiKey;
const GEMINI_VISION_ENDPOINT = config.gemini.visionEndpoint;

/**
 * Sends the media file (image or document) to Gemini for classification.
 * @param mediaFile The media file object containing buffer and mimetype.
 * @returns Promise with the category, confidence, and justification.
 */
export async function classifyMediaWithGemini(mediaFile: MediaFile): Promise<ClassificationResult> {
    if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is not configured.");
        throw new Error("Gemini API key is missing.");
    }
    if (!mediaFile.buffer) {
        console.error("Media file buffer is missing for classification.");
        // Potentially try to download if only URL is present, or throw error
        throw new Error("Media file buffer is required for Gemini classification.");
    }

    const base64Data = mediaFile.buffer.toString('base64');

    // Construct the payload for Gemini API
    // This is a basic example for image classification.
    // For documents, you might need to extract text first if it's not a direct visual classification.
    const payload = {
        contents: [
            {
                parts: [
                    { text: config.gemini.categoriesPrompt },
                    {
                        inline_data: {
                            mime_type: mediaFile.mimetype,
                            data: base64Data,
                        },
                    },
                ],
            },
        ],
        // generationConfig: { // Optional: control output format, etc.
        //   response_mime_type: "application/json", // If Gemini supports direct JSON output for your model
        // },
    };

    try {
        console.log(`Sending to Gemini: ${mediaFile.originalName} (${mediaFile.mimetype})`);
        const response = await axios.post(`${GEMINI_VISION_ENDPOINT}?key=${GEMINI_API_KEY}`, payload, {
            headers: { 'Content-Type': 'application/json' },
        });
        
        // Parse Gemini's response
        // The actual parsing logic depends heavily on the response structure of the Gemini model.
        // This is a placeholder based on a common structure. Adjust as needed.
        const candidate = response.data?.candidates?.[0];
        const contentPart = candidate?.content?.parts?.[0];
        
        if (contentPart?.text) {
            try {
                // Attempt to parse the text as JSON, assuming Gemini respects the prompt's JSON format instruction
                const resultText = contentPart.text.replace(/```json\n?|\n?```/g, '').trim(); // Clean markdown
                const parsedResult: ClassificationResult = JSON.parse(resultText);
                
                console.log("Gemini Classification Raw:", resultText);
                console.log("Gemini Classification Parsed:", parsedResult);

                if (parsedResult.category && typeof parsedResult.confidence === 'number' && parsedResult.justification) {
                     // Normalize category name if needed (e.g., ensure it matches folder names)
                    const knownCategories = [
                        ...Object.values(config.googleDrive.initialSubFolders),
                        config.defaultCategory
                    ].filter((cat): cat is string => typeof cat === 'string');
                    const foundCategory = knownCategories.find(
                        cat => cat.toLowerCase() === parsedResult.category.toLowerCase()
                    );

                    return {
                        category: foundCategory || parsedResult.category, // Use known casing if matched
                        confidence: parsedResult.confidence,
                        justification: parsedResult.justification,
                    };
                }
            } catch (jsonError) {
                console.error("Failed to parse Gemini response as JSON:", jsonError);
                console.warn("Gemini raw text response:", contentPart.text);
                // Fallback if JSON parsing fails but text is present
                return {
                    category: contentPart.text.split('\n')[0] || config.defaultCategory, // very basic fallback
                    confidence: 0.5, // low confidence for fallback
                    justification: "Could not reliably parse Gemini's structured response.",
                };
            }
        }
        
        console.error("Unexpected Gemini response structure:", response.data);
        throw new Error("Failed to get a valid classification from Gemini.");

    } catch (error: any) {
        console.error('Error classifying with Gemini:', error.response?.data || error.message);
        if (error.response?.data?.error?.message) {
             throw new Error(`Gemini API Error: ${error.response.data.error.message}`);
        }
        throw new Error("An error occurred during media classification with Gemini.");
    }
}