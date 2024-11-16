'use client';

import { useState, useRef, useEffect } from 'react';

const SAMPLE_RATE = 16000;  // OpenAI expects 16kHz audio
const SILENCE_THRESHOLD = 0.01; // RMS threshold for silence detection
const SILENCE_DURATION_THRESHOLD = 1500; // 1.5 seconds of silence before committing

function floatTo16BitPCM(float32Array: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0, offset = 0; i < float32Array.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

export default function SpeechToText() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const lastSoundTimestampRef = useRef<number>(Date.now());
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const commitBuffer = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[SpeechToText] Committing buffer');
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio_data: [],
        is_final: true
      }));
      // Reset the silence tracking
      lastSoundTimestampRef.current = Date.now();
    }
  };

  const initializeAudioProcessing = async () => {
    try {
      // Request microphone access
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: SAMPLE_RATE,
        }
      });

      // Set up audio context and processing
      audioContextRef.current = new AudioContext({
        sampleRate: SAMPLE_RATE,
      });

      const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
      processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

      source.connect(processorRef.current);
      processorRef.current.connect(audioContextRef.current.destination);

      // Initialize WebSocket connection
      wsRef.current = new WebSocket(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws');

      wsRef.current.onopen = () => {
        console.log('WebSocket connection established');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          if (response.text) {
            setTranscribedText(prev => prev + ' ' + response.text.trim());
          }
        } catch (err) {
          console.error('Error processing WebSocket message:', err);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Connection error occurred');
      };

      // Process audio data
      processorRef.current.onaudioprocess = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          const inputData = e.inputBuffer.getChannelData(0);
          const rms = Math.sqrt(
            inputData.reduce((sum, val) => sum + val * val, 0) / inputData.length
          );

          if (rms > SILENCE_THRESHOLD) {
            // Sound detected
            lastSoundTimestampRef.current = Date.now();

            // Clear any existing silence timeout
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }

            wsRef.current.send(JSON.stringify({
              type: 'audio',
              audio_data: Array.from(new Int16Array(floatTo16BitPCM(inputData))),
              is_final: false
            }));
          } else {
            // Silence detected - set up a new timeout if one isn't already pending
            if (!silenceTimeoutRef.current) {
              silenceTimeoutRef.current = setTimeout(() => {
                commitBuffer();
                silenceTimeoutRef.current = null;
              }, SILENCE_DURATION_THRESHOLD);
            }
          }
        }
      };

      setIsRecording(true);
      setError(null);
    } catch (err) {
      console.error('Error initializing audio:', err);
      setError('Failed to access microphone');
    }
  };

  const stopRecording = async () => {
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      // Close connection
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsRecording(false);
  };

  const handleToggleRecording = async () => {
    if (!isRecording) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/reset-transcription`, {
          method: 'POST',
        });
        setTranscribedText('');
        await initializeAudioProcessing();
      } catch (err) {
        console.error('Error starting recording:', err);
        setError('Failed to start recording');
      }
    } else {
      await stopRecording();
    }
  };

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, []);

  return (
    <div className="container mx-auto p-4">
      <button
        onClick={handleToggleRecording}
        className={`px-4 py-2 rounded-lg font-medium ${isRecording
          ? 'bg-red-500 hover:bg-red-600'
          : 'bg-blue-500 hover:bg-blue-600'
          } text-white transition-colors`}
      >
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mt-4 p-4 border rounded-lg min-h-[200px] bg-white shadow">
        <h2 className="text-xl font-bold mb-2">Transcribed Text:</h2>
        <p className="whitespace-pre-wrap">{transcribedText}</p>
      </div>
    </div>
  );
}