/**
 * SERVICIO DE VOZ (googleVoice.js)
 * Proporciona soporte para Text-to-Speech (TTS) y Speech-to-Text (STT).
 * Utiliza Web Speech API del navegador de forma predeterminada para soporte offline nativo
 * y tiene la estructura lista para derivar a las APIs de Google Cloud si es necesario.
 */

// Idioma por defecto en Español
const DEFAULT_LANG = 'es-ES';

/**
 * Genera voz a partir de un texto (Text-to-Speech).
 * @param {string} text Texto a sintetizar.
 * @param {Function} onEnd Callback opcional para cuando termine de hablar.
 */
export const speakText = (text, onEnd = null) => {
  if (!text) return;

  if ('speechSynthesis' in window) {
    // Cancelar cualquier síntesis de voz en curso
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = DEFAULT_LANG;
    utterance.rate = 0.9; // Velocidad ligeramente más lenta para facilitar la comprensión en TEA
    utterance.pitch = 1.0; // Tono amigable

    // Seleccionar una voz en español disponible
    const voices = window.speechSynthesis.getVoices();
    const spanishVoice = voices.find(voice => 
      voice.lang.startsWith('es') || voice.lang.includes('spanish')
    );
    
    if (spanishVoice) {
      utterance.voice = spanishVoice;
    }

    if (onEnd) {
      utterance.onend = () => onEnd();
      utterance.onerror = (e) => {
        console.error('Error en síntesis de voz:', e);
        onEnd();
      };
    }

    window.speechSynthesis.speak(utterance);
  } else {
    console.warn('La síntesis de voz (TTS) no está soportada en este navegador.');
    if (onEnd) onEnd();
  }
};

/**
 * Clase para manejar una sesión de reconocimiento de voz (Speech-to-Text).
 */
export class SpeechToTextSession {
  /**
   * @param {Function} onResult Callback ejecutado al recibir texto traducido.
   * @param {Function} onStatusChange Callback para reportar estado: 'listening', 'stopped', 'error', 'unsupported'.
   */
  constructor(onResult, onStatusChange = null) {
    this.onResult = onResult;
    this.onStatusChange = onStatusChange;
    this.recognition = null;

    // Detectar soporte para Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false; // Detener tras una frase
      this.recognition.lang = DEFAULT_LANG;
      this.recognition.interimResults = false;

      this.recognition.onstart = () => {
        if (this.onStatusChange) this.onStatusChange('listening');
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        if (this.onResult) this.onResult(transcript);
      };

      this.recognition.onerror = (event) => {
        console.error('Error en reconocimiento de voz:', event.error);
        if (this.onStatusChange) this.onStatusChange('error', event.error);
      };

      this.recognition.onend = () => {
        if (this.onStatusChange) this.onStatusChange('stopped');
      };
    } else {
      console.warn('El reconocimiento de voz (STT) no es soportado por este navegador.');
      if (this.onStatusChange) this.onStatusChange('unsupported');
    }
  }

  /**
   * Iniciar la escucha.
   */
  start() {
    if (this.recognition) {
      try {
        this.recognition.start();
      } catch (e) {
        console.error('No se pudo iniciar el STT:', e);
      }
    } else {
      if (this.onStatusChange) this.onStatusChange('unsupported');
    }
  }

  /**
   * Detener la escucha.
   */
  stop() {
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch (e) {
        console.error('No se pudo detener el STT:', e);
      }
    }
  }
}
