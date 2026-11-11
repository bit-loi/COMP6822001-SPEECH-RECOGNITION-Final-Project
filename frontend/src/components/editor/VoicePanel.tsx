'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Mic, Square, Wifi, WifiOff } from 'lucide-react';

export interface VoiceAction {
  action: string;
  params?: Record<string, unknown>;
}

interface VoiceResult {
  label: string;
  confidence: number;
  top_k?: { label: string; confidence: number }[];
  inference_ms?: number;
  reason?: string;
  action?: VoiceAction | null;
}

interface VoicePanelProps {
  onAction: (action: VoiceAction | null) => void;
}

type ConnectionState = 'connecting' | 'online' | 'offline';
type CaptureState = 'idle' | 'listening' | 'processing';

const VOICE_WS_URL = process.env.NEXT_PUBLIC_VOICE_WS_URL ?? 'ws://127.0.0.1:3002/ws/voice';
const TARGET_SAMPLE_RATE = 16000;

function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_SAMPLE_RATE) return input;

  const ratio = inputRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.round(input.length / ratio);
  const output = new Float32Array(outputLength);
  let outputIndex = 0;
  let inputIndex = 0;

  while (outputIndex < outputLength) {
    const nextInputIndex = Math.round((outputIndex + 1) * ratio);
    let sum = 0;
    let count = 0;

    for (let i = inputIndex; i < nextInputIndex && i < input.length; i++) {
      sum += input[i];
      count++;
    }

    output[outputIndex] = count > 0 ? sum / count : 0;
    outputIndex++;
    inputIndex = nextInputIndex;
  }

  return output;
}

function floatToPcm16(samples: Float32Array): ArrayBuffer {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }

  return buffer;
}

export const VoicePanel: React.FC<VoicePanelProps> = ({ onAction }) => {
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [captureState, setCaptureState] = useState<CaptureState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VoiceResult | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const recordingRef = useRef(false);
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  const releaseAudio = useCallback(() => {
    recordingRef.current = false;
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;

      setConnection('connecting');
      const socket = new WebSocket(VOICE_WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setConnection('online');
        setError(null);
      };

      socket.onmessage = (event) => {
        if (disposed) return;

        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            message?: string;
          } & VoiceResult;

          if (data.type === 'ready') {
            setConnection('online');
            return;
          }

          if (data.type === 'speech_start') {
            return;
          }

          if (data.type === 'error') {
            setError(data.message ?? 'Voice engine error');
            setCaptureState(recordingRef.current ? 'listening' : 'idle');
            return;
          }

          if (data.type === 'result') {
            const result = data as VoiceResult;
            setLastResult(result);
            setCaptureState(recordingRef.current ? 'listening' : 'idle');
            onActionRef.current(result.action ?? null);
          }
        } catch {
          setError('Received an invalid message from the voice engine.');
          setCaptureState('idle');
        }
      };

      socket.onerror = () => {
        socket.close();
      };

      socket.onclose = () => {
        if (disposed) return;
        releaseAudio();
        setConnection('offline');
        setCaptureState('idle');
        reconnectTimer = setTimeout(connect, 2000);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      releaseAudio();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [releaseAudio]);

  const startListening = async () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setError('Voice engine is offline. Start backend-go on port 3002.');
      return;
    }

    try {
      setError(null);
      setLastResult(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const AudioContextClass =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) {
        throw new Error('Web Audio API is not available in this browser.');
      }

      const audioContext = new AudioContextClass();
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (event) => {
        if (!recordingRef.current) return;

        const activeSocket = socketRef.current;
        if (!activeSocket || activeSocket.readyState !== WebSocket.OPEN) return;

        const input = event.inputBuffer.getChannelData(0);
        const resampled = resampleTo16k(input, audioContext.sampleRate);
        activeSocket.send(floatToPcm16(resampled));
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      recordingRef.current = true;
      setCaptureState('listening');
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone access denied. Allow microphone permission in your browser.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to start the microphone.');
      }
      releaseAudio();
      setCaptureState('idle');
    }
  };

  const stopListening = useCallback(() => {
    releaseAudio();

    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: 'flush' }));
      setCaptureState('processing');
    } else {
      setCaptureState('idle');
    }
  }, [releaseAudio]);

  const toggleMic = () => {
    if (captureState === 'listening') {
      stopListening();
    } else if (captureState === 'idle' && connection === 'online') {
      void startListening();
    }
  };

  const ConnectionIcon = connection === 'online' ? Wifi : connection === 'connecting' ? Loader2 : WifiOff;
  const connectionLabel =
    connection === 'online'
      ? 'Engine connected'
      : connection === 'connecting'
        ? 'Connecting to engine'
        : 'Engine offline';

  const statusText =
    captureState === 'listening'
      ? 'Listening — tap to stop'
      : captureState === 'processing'
        ? 'Recognizing…'
        : connection === 'online'
          ? 'Tap the mic and say a command'
          : connection === 'connecting'
            ? 'Connecting to the voice engine…'
            : 'Start backend-go on port 3002, then tap the mic';

  const micDisabled = connection !== 'online' || captureState === 'processing';

  return (
    <aside className="w-80 flex-shrink-0 flex flex-col border-l border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#1e1e1e]">
      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Voice Control</h2>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">On-device keyword recognition</p>
        </div>
        <span
          className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400"
          title={connectionLabel}
        >
          <ConnectionIcon
            className={`w-3.5 h-3.5 ${
              connection === 'online'
                ? 'text-green-500'
                : connection === 'connecting'
                  ? 'text-amber-500 animate-spin'
                  : 'text-red-500'
            }`}
          />
          {connection === 'online' ? 'Online' : connection === 'connecting' ? 'Connecting' : 'Offline'}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-8">
        <button
          type="button"
          onClick={toggleMic}
          disabled={micDisabled}
          aria-label={captureState === 'listening' ? 'Stop recording' : 'Start recording'}
          aria-pressed={captureState === 'listening'}
          className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
            captureState === 'listening'
              ? 'bg-red-600 hover:bg-red-500 text-white ring-4 ring-red-500/30'
              : captureState === 'processing'
                ? 'bg-purple-600 text-white cursor-wait'
                : 'bg-purple-600 hover:bg-purple-500 text-white disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600 disabled:shadow-none'
          }`}
        >
          {captureState === 'listening' ? (
            <Square className="w-8 h-8 fill-current" />
          ) : captureState === 'processing' ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <Mic className="w-8 h-8" />
          )}
        </button>

        <p className="text-xs text-center text-gray-600 dark:text-gray-400">{statusText}</p>

        {error && (
          <p className="text-[11px] text-center text-red-500 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {lastResult && (
          <div className="w-full rounded-lg border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-semibold text-gray-900 dark:text-white">
                {lastResult.label}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {(lastResult.confidence * 100).toFixed(1)}%
              </span>
            </div>
            {lastResult.action?.action && (
              <p className="mt-1 text-[11px] text-purple-600 dark:text-purple-400">
                {lastResult.action.action}
              </p>
            )}
            {lastResult.reason && (
              <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">{lastResult.reason}</p>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-gray-200 dark:border-zinc-800">
        <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">Try saying</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {['go', 'stop', 'up', 'down', 'left', 'right', 'backward', 'forward', 'visual', 'one', 'two'].map(
            (word) => (
              <span
                key={word}
                className="rounded border border-gray-200 dark:border-zinc-700 px-2 py-0.5 text-[10px] text-gray-500 dark:text-gray-400"
              >
                {word}
              </span>
            )
          )}
        </div>
      </div>
    </aside>
  );
};
