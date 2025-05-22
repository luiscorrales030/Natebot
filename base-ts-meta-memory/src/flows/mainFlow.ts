import { addKeyword, EVENTS } from "@builderbot/bot";
import { SessionData, NateBotContext } from "../types";
import { SESSION_STATES } from "../services/sessionManager";
import { config } from "../config";

const mainFlow = addKeyword<NateBotContext>(EVENTS.WELCOME)
  .addAction(async (ctx, { state, flowDynamic }) => {
    const session = state.getAll() as SessionData;
    await state.update({ currentState: SESSION_STATES.IDLE });
    await flowDynamic("👋 ¡Hola! Bienvenido a NateBot Pro.");
    await flowDynamic("Puedes enviarme archivos (imágenes, documentos) y los clasificaré y guardaré en Google Drive.");
    await flowDynamic(`Actualmente, puedo organizar en estas categorías:\n- ${config.natecoCategories.join('\n- ')}\n- ${config.defaultCategory}`);
    await flowDynamic("Simplemente envía un archivo para comenzar. Si envías varios, te preguntaré cómo proceder.");
    await state.update({ currentState: SESSION_STATES.AWAITING_FILE_UPLOAD, mediaFiles: [] });
  })
  .addAction({ capture: true }, async (ctx, { state, gotoFlow, flowDynamic, endFlow }) => {
      const text = ctx.body.toLowerCase();
      if (text === 'cancelar' || text === 'salir') {
          await state.update({ currentState: SESSION_STATES.IDLE, mediaFiles: [], currentFile: undefined });
          await flowDynamic("Operación cancelada. Envía un archivo cuando quieras.");
          return endFlow();
      }
      // If it's not media, and not a command, just remind the user what to do
      if (ctx.provider?.type !== 'media' && ctx.provider?.type !== 'image' && ctx.provider?.type !== 'document' && ctx.provider?.type !== 'video' && ctx.provider?.type !== 'audio' ) {
        const currentState = (state.getAll() as SessionData).currentState;
        if (currentState === SESSION_STATES.AWAITING_FILE_UPLOAD) {
            await flowDynamic("Por favor, envía un archivo que quieras guardar o escribe 'cancelar'.");
        } else if (currentState !== SESSION_STATES.IDLE) {
            // If in another state, it means mediaFlow should be handling it.
            // This is a fallback if something unexpected happens or user types text during media processing.
            await flowDynamic("Estoy esperando una respuesta relacionada con el archivo. Si quieres cancelar, escribe 'cancelar'.");
        }
        // Do not end flow, let mediaFlow handle its state or timeout.
      }
      // Media events will be handled by mediaFlow.
  });

export { mainFlow };