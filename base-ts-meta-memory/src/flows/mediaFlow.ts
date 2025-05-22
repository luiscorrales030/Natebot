import { addKeyword, EVENTS } from "@builderbot/bot";
import { NateBotContext, MediaFile, SessionData, ClassificationResult, DriveFileMetadata } from "../types";
import { SESSION_STATES } from "../services/sessionManager";
import { classifyMediaWithGemini } from "../services/classificationService";
import { uploadFileToDrive, getOrCreateFolder } from "../services/driveService";
import { config } from "../config";
import path from "path";
import fs from "fs/promises";
import { tmpdir } from "os";
import axios from "axios";

// Helper to download media if provider gives a URL
async function downloadMedia(url: string, jwtToken: string | undefined, fileName: string): Promise<Buffer | undefined> {
    try {
        const response = await axios.get(url, {
            headers: { Authorization: `Bearer ${jwtToken}` },
            responseType: 'arraybuffer',
        });
        return Buffer.from(response.data);
    } catch (error) {
        console.error(`Failed to download media from ${url}:`, error);
        return undefined;
    }
}


const mediaFlow = addKeyword<NateBotContext>(EVENTS.MEDIA)
    .addAction(async (ctx, { state, flowDynamic, provider }) => {
        console.log('Media received:', ctx.body); // ctx.body should be the URL for Meta
        const currentState = (state.getAll() as SessionData).currentState;

        // Avoid processing if not in a state expecting files, or if already processing.
        if (currentState !== SESSION_STATES.AWAITING_FILE_UPLOAD && currentState !== SESSION_STATES.IDLE) {
            // await flowDynamic("Estoy procesando algo más. Por favor, espera.");
            // return; // Might cause issues if user sends multiple files quickly.
            console.log("Media received while in state:", currentState, " queuing it up.");
        }
        
        const mediaUrl = ctx.body;
        const mediaMessage = ctx.message; // Contains more details from provider
        let originalName = `media_${Date.now()}`; // Default name
        let mimetype = 'application/octet-stream'; // Default mimetype

        if (mediaMessage?.message?.image?.id) {
            mimetype = mediaMessage.message.image.mime_type || 'image/jpeg';
            originalName = `${mediaMessage.message.image.id}.${mimetype.split('/')[1] || 'jpg'}`;
        } else if (mediaMessage?.message?.document?.id) {
            mimetype = mediaMessage.message.document.mime_type || 'application/pdf';
            originalName = mediaMessage.message.document.filename || `${mediaMessage.message.document.id}.${mimetype.split('/')[1] || 'dat'}`;
        } else if (mediaMessage?.message?.video?.id) {
            mimetype = mediaMessage.message.video.mime_type || 'video/mp4';
            originalName = `${mediaMessage.message.video.id}.${mimetype.split('/')[1] || 'mp4'}`;
        } else if (mediaMessage?.message?.audio?.id) {
            mimetype = mediaMessage.message.audio.mime_type || 'audio/ogg';
            originalName = `${mediaMessage.message.audio.id}.${mimetype.split('/')[1] || 'ogg'}`;
        }
        // TODO: Handle stickers, other media types if necessary

        await flowDynamic(`Archivo '${originalName}' recibido. Procesando...`);

        // Download the media
        const fileBuffer = await downloadMedia(mediaUrl, config.meta.jwtToken, originalName);

        if (!fileBuffer) {
            await flowDynamic(`No pude descargar el archivo: ${originalName}. Intenta de nuevo.`);
            return;
        }

        const newFile: MediaFile = { originalName, mimetype, buffer: fileBuffer, url: mediaUrl };
        
        const currentSession = state.getAll() as SessionData;
        const updatedMediaFiles = [...(currentSession.mediaFiles || []), newFile];
        await state.update({
            mediaFiles: updatedMediaFiles,
            currentState: SESSION_STATES.MEDIA_RECEIVED,
        });

        // If this is the first file in a potential batch, set it as current and proceed
        if (!currentSession.currentFile) {
             await state.update({ currentFile: newFile, currentFileIndex: 0 });
             // Trigger the next step in the flow for this file
        } else {
            await flowDynamic(`He añadido '${originalName}' a la cola. ${updatedMediaFiles.length} archivos en total.`);
            // The flow will continue when the current file processing is done.
            return; // Don't trigger classification yet for subsequent files in a batch.
        }
        // Continue to classification for the currentFile
    })
    .addAction(
        // This action implicitly uses the updated state from the previous one if it's part of the same "tick"
        // Or if it's triggered by a subsequent user interaction.
        // For an automatic next step, we might need a small delay or a dedicated "process next file" action.
        // Let's assume this action proceeds with the current file if one is set.
        async (ctx, { state, flowDynamic, endFlow }) => {
            const currentSession = state.getAll() as SessionData;
            if (!currentSession.currentFile || !currentSession.currentFile.buffer) {
                 if (currentSession.mediaFiles && currentSession.mediaFiles.length > 0 && 
                    (typeof currentSession.currentFileIndex === 'number' && currentSession.currentFileIndex < currentSession.mediaFiles.length) ) {
                    // This means a file was queued but not yet set as current, or buffer is missing.
                    // This logic should ideally be in a loop or a recursive call pattern if handling batches.
                    // For now, let's assume the first action set it up.
                 } else {
                    console.log("No current file to process or buffer missing.");
                    // Potentially try to process next from queue if any.
                    return; // Nothing to process
                 }
            }
            
            const fileToProcess = currentSession.currentFile!;

            try {
                await state.update({ currentState: SESSION_STATES.AWAITING_CLASSIFICATION_CONFIRMATION });
                await flowDynamic(`Clasificando '${fileToProcess.originalName}' con IA... 🤖`);
                const classification = await classifyMediaWithGemini(fileToProcess);
                await state.update({ classificationResult: classification });

                const buttons = [
                    { body: `Sí, es ${classification.category}` },
                    { body: 'Elegir otra categoría' },
                    { body: 'Cancelar subida' }
                ];
                await flowDynamic({
                    body: `Sugerencia de IA para '${fileToProcess.originalName}':\nCategoría: *${classification.category}*\nConfianza: ${Math.round(classification.confidence * 100)}%\nJustificación: ${classification.justification}\n\n¿Es correcta esta categoría?`,
                    buttons: buttons
                });

            } catch (error: any) {
                console.error("Error during classification:", error);
                await flowDynamic(`Hubo un error clasificando '${fileToProcess.originalName}': ${error.message}. Puedes intentar enviarlo de nuevo o cancelar.`);
                await state.update({ currentState: SESSION_STATES.AWAITING_FILE_UPLOAD, currentFile: undefined, classificationResult: undefined }); // Reset for this file
                 // TODO: Implement logic to proceed to the next file if in a batch
            }
        }
    )
    .addAction({ capture: true }, async (ctx, { state, flowDynamic, endFlow, fallBack }) => {
        const currentSession = state.getAll() as SessionData;
        const userResponse = ctx.body;

        if (currentSession.currentState === SESSION_STATES.AWAITING_CLASSIFICATION_CONFIRMATION) {
            const classification = currentSession.classificationResult!;
            const file = currentSession.currentFile!;

            if (userResponse.startsWith('Sí, es')) {
                await state.update({ confirmedCategory: classification.category });
                // Proceed to ask for rename or metadata then upload
                return fallBack(await askForRenameOrProceed(ctx, state, flowDynamic));
            } else if (userResponse === 'Elegir otra categoría') {
                await state.update({ currentState: SESSION_STATES.AWAITING_CATEGORY_CHOICE });
                const categoryButtons = config.natecoCategories.map(cat => ({ body: cat }));
                categoryButtons.push({body: "Cancelar subida"});
                await flowDynamic({ body: "Por favor, elige una categoría:", buttons: categoryButtons });
            } else if (userResponse === 'Cancelar subida') {
                return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
            } else {
                await flowDynamic("Por favor, usa los botones o escribe 'Cancelar subida'.");
                return fallBack(); // Re-trigger this action to wait for button press
            }
        } else if (currentSession.currentState === SESSION_STATES.AWAITING_CATEGORY_CHOICE) {
            if (config.natecoCategories.includes(userResponse)) {
                await state.update({ confirmedCategory: userResponse, currentState: SESSION_STATES.AWAITING_RENAME_CONFIRMATION });
                 return fallBack(await askForRenameOrProceed(ctx, state, flowDynamic));
            } else if (userResponse === 'Cancelar subida') {
                 return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
            } else {
                await flowDynamic("Categoría no válida. Por favor, elige de la lista o cancela.");
                const categoryButtons = config.natecoCategories.map(cat => ({ body: cat }));
                categoryButtons.push({body: "Cancelar subida"});
                await flowDynamic({ body: "Por favor, elige una categoría:", buttons: categoryButtons });
                return fallBack();
            }
        } else if (currentSession.currentState === SESSION_STATES.AWAITING_RENAME_CONFIRMATION) {
             if (userResponse.toLowerCase() === 'sí, renombrar') {
                await state.update({ currentState: SESSION_STATES.AWAITING_CUSTOM_FILE_NAME });
                await flowDynamic("Ok, ¿qué nombre le quieres poner al archivo? (Incluye la extensión, ej: mi_documento.pdf)");
             } else if (userResponse.toLowerCase() === 'no, usar nombre automático') {
                await state.update({ customFileName: undefined }); // Ensure no custom name
                // Proceed to ask for metadata then upload
                return fallBack(await askForMetadataOrProceed(ctx, state, flowDynamic));
             } else if (userResponse === 'Cancelar subida') {
                 return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
             } else {
                await flowDynamic("Respuesta no válida. Por favor, usa los botones.");
                return fallBack(await askForRenameOrProceed(ctx, state, flowDynamic, true)); // re-ask
             }
        } else if (currentSession.currentState === SESSION_STATES.AWAITING_CUSTOM_FILE_NAME) {
             if (userResponse === 'Cancelar subida') {
                 return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
             }
             await state.update({ customFileName: userResponse });
             // Proceed to ask for metadata then upload
             return fallBack(await askForMetadataOrProceed(ctx, state, flowDynamic));

        } else if (currentSession.currentState === SESSION_STATES.AWAITING_TAGS) {
            if (userResponse.toLowerCase() === 'no añadir etiquetas' || userResponse.toLowerCase() === 'saltar') {
                await state.update({ userTags: [] });
            } else if (userResponse === 'Cancelar subida') {
                 return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
            } else {
                await state.update({ userTags: userResponse.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0) });
            }
            // Proceed to ask for comments
            await state.update({ currentState: SESSION_STATES.AWAITING_COMMENTS });
            await flowDynamic({body: "¿Quieres añadir algún comentario adicional al archivo?", buttons: [{body: "Sí"}, {body: "No, finalizar"}, {body: "Cancelar subida"}]});

        } else if (currentSession.currentState === SESSION_STATES.AWAITING_COMMENTS) {
            if (userResponse.toLowerCase() === 'sí') {
                 await flowDynamic("Escribe tu comentario:");
            } else if (userResponse.toLowerCase() === 'no, finalizar') {
                await state.update({ userComments: undefined });
                return fallBack(await processFileUpload(ctx, state, flowDynamic, endFlow));
            } else if (userResponse === 'Cancelar subida') {
                 return await handleCancelUpload(ctx, state, flowDynamic, endFlow);
            } else { // This means the user typed a comment directly
                await state.update({ userComments: userResponse });
                return fallBack(await processFileUpload(ctx, state, flowDynamic, endFlow));
            }
        }
        // If no state matched, or an action returned fallBack without specific next step, it might loop here.
        // Ensure each state transitions appropriately.
    });


async function askForRenameOrProceed(ctx: any, state: NateBotContext['state'], flowDynamic: any, reasking = false) {
    if (!reasking) await state.update({ currentState: SESSION_STATES.AWAITING_RENAME_CONFIRMATION });
    await flowDynamic({
        body: "¿Quieres renombrar el archivo antes de subirlo?",
        buttons: [{ body: 'Sí, renombrar' }, { body: 'No, usar nombre automático' }, {body: "Cancelar subida"}]
    });
}

async function askForMetadataOrProceed(ctx: any, state: NateBotContext['state'], flowDynamic: any) {
    await state.update({ currentState: SESSION_STATES.AWAITING_TAGS });
    await flowDynamic({
        body: "¿Quieres añadir etiquetas (separadas por coma) al archivo? (Ej: importante, clienteX, proyectoY) o escribe 'No añadir etiquetas'",
        buttons: [{ body: 'No añadir etiquetas' }, {body: "Cancelar subida"}] // Button for common case
    });
}


async function processFileUpload(ctx: any, state: NateBotContext['state'], flowDynamic: any, endFlow: any) {
    const session = state.getAll() as SessionData;
    const fileToUpload = session.currentFile!;
    const category = session.confirmedCategory!;

    if (!fileToUpload || !fileToUpload.buffer || !category) {
        await flowDynamic("Error: No se encontró información del archivo o categoría para subir.");
        return await handleCancelUpload(ctx, state, flowDynamic, endFlow, "Error interno de datos.");
    }

    await state.update({ currentState: SESSION_STATES.UPLOADING_FILE });
    await flowDynamic(`Subiendo '${fileToUpload.originalName}' a la categoría '${category}'...`);

    try {
        const targetFolderId = await getOrCreateFolder(category, config.googleDrive.rootFolderId);

        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        // Basic sequence - for a real system, query Drive for existing files with same prefix to get next sequence.
        const sequence = "0001"; 
        const extension = path.extname(fileToUpload.originalName) || `.${fileToUpload.mimetype.split('/')[1] || 'bin'}`;
        
        const baseNameWithoutExt = session.customFileName 
            ? session.customFileName.includes('.') ? session.customFileName.substring(0, session.customFileName.lastIndexOf('.')) : session.customFileName
            : `${category}_${year}${month}${day}_${sequence}`;
        
        const finalFileName = session.customFileName
            ? (session.customFileName.includes('.') ? session.customFileName : `${session.customFileName}${extension}`)
            : `${baseNameWithoutExt}${extension}`;


        const driveMetadata: DriveFileMetadata = {
            name: finalFileName,
            mimetype: fileToUpload.mimetype,
            description: JSON.stringify({
                originalName: fileToUpload.originalName,
                category: category,
                source: "WhatsApp (NateBot Pro)",
                uploadTimestamp: now.toISOString(),
                classificationConfidence: session.classificationResult?.confidence,
                classificationJustification: session.classificationResult?.justification,
                userTags: session.userTags,
                userComments: session.userComments,
                originalFileUrl: fileToUpload.url, // If available
            }),
        };

        const fileId = await uploadFileToDrive(fileToUpload.buffer, driveMetadata, targetFolderId);
        if (fileId) {
            await flowDynamic(`✔️ ¡Listo! Guardé '${finalFileName}' en la categoría '${category}'.\nID de Drive: ${fileId}`);
        } else {
            await flowDynamic(`❌ Hubo un problema al subir '${finalFileName}'. El archivo no se guardó.`);
        }
    } catch (error: any) {
        console.error("Error during file upload process:", error);
        await flowDynamic(`❌ Error al subir el archivo: ${error.message}`);
    } finally {
       return await handleNextFileOrEnd(ctx, state, flowDynamic, endFlow);
    }
}

async function handleNextFileOrEnd(ctx: any, state: NateBotContext['state'], flowDynamic: any, endFlow: any) {
    const currentSession = state.getAll() as SessionData;
    let currentIndex = currentSession.currentFileIndex ?? 0;
    const mediaFiles = currentSession.mediaFiles ?? [];

    currentIndex++;
    
    // Reset state for the processed file
    const resetState: Partial<SessionData> = {
        currentFile: undefined,
        classificationResult: undefined,
        confirmedCategory: undefined,
        customFileName: undefined,
        userTags: undefined,
        userComments: undefined,
    };

    if (currentIndex < mediaFiles.length) {
        await state.update({
            ...resetState,
            currentFile: mediaFiles[currentIndex],
            currentFileIndex: currentIndex,
            currentState: SESSION_STATES.MEDIA_RECEIVED, // Ready to process next
        });
        await flowDynamic(`Procesando siguiente archivo: '${mediaFiles[currentIndex].originalName}'...`);
        // This will effectively re-trigger the classification part of the flow
        // by having currentFile set and state ready.
        // To make it truly restart the classification part, we might need to use gotoFlow or fallBack carefully.
        // For now, let's rely on the next interaction or a slight delay if we were to implement auto-continue
        // This will re-run the second action in this flow which checks for currentFile.
        return ctx.fallBack(); 
    } else {
        await state.update({
            ...resetState,
            mediaFiles: [], // Clear the queue
            currentFileIndex: 0,
            currentState: SESSION_STATES.AWAITING_FILE_UPLOAD, // Ready for new uploads
        });
        await flowDynamic("Todos los archivos han sido procesados. Puedes enviar más archivos cuando quieras.");
        return endFlow();
    }
}


async function handleCancelUpload(ctx: any, state: NateBotContext['state'], flowDynamic: any, endFlow: any, reason?: string) {
    await flowDynamic(reason || "Subida cancelada para el archivo actual.");
    return await handleNextFileOrEnd(ctx, state, flowDynamic, endFlow);
}


export { mediaFlow };