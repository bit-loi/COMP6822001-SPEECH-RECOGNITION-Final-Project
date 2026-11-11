import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Copy, Check, Loader2, Mic, Image as ImageIcon, MicOff, X, Plus, History, MoreHorizontal, Download, FolderOpen, Brain, ListChecks, Github, Globe } from 'lucide-react';
import { Message } from '@/types/editor';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { exportChatHistory } from '@/lib/exportUtils';
import { getTranslation, type Language } from '@/lib/translations';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ChatPanelProps {
  width: number;
  messages: Message[];
  inputValue: string;
  setInputValue: (val: string) => void;
  handleSendMessage: () => void;
  isSending: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  isResizing: boolean;
  setIsResizing: (resizing: boolean) => void;
  uiLanguage: string;
  onNewChat?: () => void;
  onShowHistory?: () => void;
}


export const ChatPanel: React.FC<ChatPanelProps> = ({
  width,
  messages,
  inputValue,
  setInputValue,
  handleSendMessage,
  isSending,
  messagesEndRef,
  isResizing,
  setIsResizing,
  uiLanguage,
  onNewChat,
  onShowHistory,
}) => {
  const t = (key: string) => getTranslation(key, uiLanguage as Language);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [aiVoiceIntent, setAiVoiceIntent] = useState<{
    label: string;
    type: string;
    action: string;
  } | null>(null);
  const [sttError, setSttError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const baseValueRef = useRef<string>('');

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const maxHeight = 120;
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        maxHeight
      )}px`;
    }
  }, [inputValue]);

  const handleCopy = async (content: string, id: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const processAudioWithGemini = async (audioFile: File) => {
    setIsTranscribing(true);
    setSttError(null);
    try {
      // Step 1: Transcribe audio via speech_recognition Python backend
      const formData = new FormData();
      formData.append('audio', audioFile);

      const transcribeRes = await fetch('http://127.0.0.1:8000/api/voice/stt', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer fake_token' },
        body: formData,
      });
      const transcribeData = await transcribeRes.json();
      const rawTranscript = transcribeData.transcript || '';

      if (!rawTranscript.trim()) {
        setSttError('No speech detected. Please try again.');
        return;
      }

      // Update input with raw transcript first so user sees something immediately
      const separator = baseValueRef.current ? ' ' : '';
      const combined = baseValueRef.current + separator + rawTranscript;
      setInputValue(combined);
      baseValueRef.current = combined;

      // Step 2: AI-enhance the transcript (detect intent, clean up)
      setIsEnhancing(true);
      const enhanceRes = await fetch('http://127.0.0.1:8000/api/voice/enhance-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer fake_token' },
        body: JSON.stringify({
          transcript: rawTranscript,
          file_language: 'python',
          surrounding_code: '',
          ui_language: uiLanguage
        }),
      });
      const enhanceData = await enhanceRes.json();

      if (enhanceData.success && enhanceData.cleaned_transcript) {
        const cleanedCombined = baseValueRef.current
          .replace(rawTranscript, enhanceData.cleaned_transcript);
        setInputValue(cleanedCombined);
        baseValueRef.current = cleanedCombined;
      }

      setAiVoiceIntent({
        label: enhanceData.intent_label || 'Chat',
        type: enhanceData.intent_type || 'chat',
        action: enhanceData.suggested_action || rawTranscript
      });
    } catch (err) {
      setSttError('Failed to transcribe audio. Make sure the backend is running.');
    } finally {
      setIsTranscribing(false);
      setIsEnhancing(false);
    }
  };

  // Voice recording — uses MediaRecorder (local audio capture, no network needed)
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording → will trigger onstop → processAudioWithSR
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      setSttError(null);
      setAiVoiceIntent(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: 16000,
            echoCancellation: true,
            noiseSuppression: true,
          }
        });
        audioChunksRef.current = [];
        baseValueRef.current = inputValue;

        // Prefer ogg (no ffmpeg needed on server), fallback to webm
        const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(stream, { mimeType });

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const ext = mimeType.includes('ogg') ? 'ogg' : 'webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          // Rename blob so the server knows the format
          const audioFile = new File([audioBlob], `recording.${ext}`, { type: mimeType });
          await processAudioWithGemini(audioFile);
        };

        recorder.start(500); // 500ms timeslices
        mediaRecorderRef.current = recorder;
        setIsRecording(true);
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          setSttError('Microphone access denied. Please allow microphone permission in your browser.');
        } else {
          setSttError(`Could not access microphone: ${err.message}`);
        }
      }
    }
  };

  // Image upload
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
        setInputValue(inputValue + '\n[Image attached]');
      };
      reader.readAsDataURL(file);
    }
  };

  const [showMenu, setShowMenu] = useState(false);
  const [isMcpDialogOpen, setIsMcpDialogOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const canSend = inputValue.trim() && !isSending;

  return (
    <div 
      className={`flex flex-col h-full bg-white dark:bg-[#1e1e1e] border-l border-gray-200 dark:border-[#333333] ${isResizing ? 'pointer-events-none' : ''}`}
      style={{ width, maxWidth: 'calc(100vw - 320px)' }}
    >
      {/* Menu Bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] relative z-20">
        <div className="flex items-center gap-1">
          <button 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="New Chat"
            onClick={onNewChat}
          >
            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button 
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="History"
            onClick={onShowHistory}
          >
            <History className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        
        <div className="relative" ref={menuRef}>
          <button 
            className={`p-1.5 rounded transition-colors ${showMenu ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            title="More Options"
            onClick={() => setShowMenu(!showMenu)}
          >
            <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#252526] shadow-lg py-1 text-sm animate-in fade-in zoom-in-95 duration-100">

              <button 
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200"
                onClick={() => { setIsMcpDialogOpen(true); setShowMenu(false); }}
              >
                AI Integrations
              </button>
              <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
              <button 
                className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 flex items-center gap-2"
                onClick={() => { 
                  setShowMenu(false);
                  exportChatHistory(messages);
                }}
              >
                <Download className="w-3.5 h-3.5 opacity-60" />
                Export Sesi (.md)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isMcpDialogOpen} onOpenChange={setIsMcpDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>AI Integrations</DialogTitle>
            <DialogDescription>
              Extra capabilities available to the AI while helping you code.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {([
              { icon: <FolderOpen className="w-4 h-4" />, label: 'Project File Access',  desc: 'AI can read and understand files in your project.',          active: true  },
              { icon: <Brain       className="w-4 h-4" />, label: 'Conversation Memory',  desc: 'AI remembers context from previous sessions.',               active: true  },
              { icon: <ListChecks  className="w-4 h-4" />, label: 'Task Management',      desc: 'AI can help break work into smaller, manageable steps.',     active: true  },
              { icon: <Github      className="w-4 h-4" />, label: 'GitHub Connection',    desc: 'AI can help with push, commit, and code reviews.',           active: true  },
              { icon: <Globe       className="w-4 h-4" />, label: 'Web Access',           desc: 'Search for up-to-date docs and references.',                 active: false },
            ] as const).map((item) => (
              <div key={item.label} className="flex items-center justify-between p-3 border rounded-lg dark:border-gray-700 gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${
                    item.active
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
                  }`}>
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{item.label}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded flex-shrink-0 ${
                  item.active
                    ? 'text-green-600 bg-green-100 dark:bg-green-900/30'
                    : 'text-gray-400 bg-gray-100 dark:bg-gray-800'
                }`}>
                  {item.active ? 'Active' : 'Coming soon'}
                </span>
              </div>
            ))}
          </div>
          <div className="flex justify-end">
             <Button onClick={() => setIsMcpDialogOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>





      {/* Messages Area - Custom scrollbar hidden via Tailwind */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 bg-white dark:bg-[#1e1e1e] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full mb-4">
              <img src="/logo.png" alt="Neuravity" className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              How can I help you today?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Ask me anything about your code, debugging, or programming concepts.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "group relative",
                message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 shadow-sm",
                  message.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-[#252526] text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                )}
              >
                {/* Message Header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span className={cn(
                    "text-xs font-medium",
                    message.role === 'user' 
                      ? 'text-purple-100' 
                      : 'text-gray-600 dark:text-gray-400'
                  )}>
                    {message.role === 'user' ? 'You' : 'Neuravity AI'}
                  </span>
                  <span 
                    className={cn(
                      "text-[10px]",
                      message.role === 'user'
                        ? 'text-purple-200'
                        : 'text-gray-400 dark:text-gray-500'
                    )}
                    suppressHydrationWarning
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </span>
                </div>

                {/* Message Content */}
                <div className="text-sm whitespace-pre-wrap break-words">
                  {message.content}
                </div>

                {/* Copy Button for AI messages */}
                {message.role === 'assistant' && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 w-7"
                    onClick={() => handleCopy(message.content, message.id)}
                  >
                    {copiedId === message.id ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))
        )}

        {/* AI Loading State (Typing Indicator) */}
        {isSending && (
          <div className="flex animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex-shrink-0 mr-3 mt-1">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#333333] dark:to-[#252526] p-1.5 shadow border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center">
                <img src="/logo.png" alt="AI" className="w-5 h-5 animate-pulse" />
              </div>
            </div>
            <div className="relative group max-w-[85%] bg-white dark:bg-[#252526] border border-gray-100 dark:border-[#333333] shadow-sm rounded-2xl rounded-tl-sm px-5 py-3.5">
              <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Neuravity AI</span>
                <span className="text-gray-400 dark:text-gray-500 text-xs mt-0.5 font-medium tracking-wide">{t("chat.agent_thinking")}</span>
              </div>
              <div className="mt-3 flex gap-1 items-center h-4">
                <div className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-1.5 h-1.5 bg-purple-500 dark:bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-[#333333] p-4 bg-gray-50 dark:bg-[#1e1e1e]">
        {/* Image Preview */}
        {selectedImage && (
          <div className="mb-3 relative inline-block">
            <img src={selectedImage} alt="Selected" className="h-20 rounded-lg border border-gray-300 dark:border-gray-700" />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* AI Voice Intent Badge */}
        {(aiVoiceIntent || isEnhancing) && (
          <div className="mb-3 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {isEnhancing ? (
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full text-[13px] font-bold tracking-tight border border-purple-400/30 dark:border-purple-500/30 bg-white/10 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)] backdrop-blur-md cursor-default overflow-hidden">
                {/* Shimmer Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 dark:via-purple-400/5 to-transparent -translate-x-full animate-shimmer" />
                
                <Brain className="h-4 w-4 animate-pulse text-purple-500 dark:text-purple-400" />
                <span className="relative drop-shadow-sm">
                  {t("chat.ai_analyzing") || "Neuravity AI is thinking..."}
                </span>
                
                {/* Micro-dots */}
                <div className="flex gap-0.5 ml-0.5">
                  <div className="w-1 h-1 bg-purple-400/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1 h-1 bg-purple-400/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1 h-1 bg-purple-400/60 rounded-full animate-bounce" />
                </div>
              </div>
            ) : aiVoiceIntent && (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[13px] font-semibold tracking-wide border shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:scale-[1.02] cursor-default bg-gradient-to-r from-purple-50/90 to-fuchsia-50/90 dark:from-purple-900/40 dark:to-fuchsia-900/40 border-purple-200/50 dark:border-purple-500/30 text-purple-700 dark:text-[#c084fc] shadow-purple-500/10">
                <span className="drop-shadow-sm">{aiVoiceIntent.label}</span>
                
                {/* Divider */}
                <div className="w-[1px] h-3.5 mx-0.5 bg-current opacity-20" />
                
                {/* Close integrated into pill */}
                <button
                  onClick={() => setAiVoiceIntent(null)}
                  className="flex text-current opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
                  title="Clear Intent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* STT Error Message */}
        {sttError && (
          <div className="mb-2 flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-3 py-2 rounded-lg text-xs border border-red-200 dark:border-red-800">
            <span>⚠️</span>
            <span className="flex-1">{sttError}</span>
            <button onClick={() => setSttError(null)} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-[#252526] border border-gray-300 dark:border-gray-700 rounded-xl shadow-sm">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isRecording ? (t("chat.ai_listening") || "Listening...") : t("chat.placeholder")}
            disabled={isSending}
            className="w-full px-4 pt-4 pb-2 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm resize-none border-none outline-none focus:ring-0 min-h-[60px] max-h-[120px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
            rows={1}
          />

          {/* Bottom Bar */}
          <div className="flex items-center justify-between px-3 pb-2 pt-1">
            <div className="flex items-center gap-1">
              {/* Image Upload */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                disabled={isSending}
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                <ImageIcon className="h-4 w-4" />
              </Button>

              {/* Voice Recording */}
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "h-8 w-8 transition-all",
                  isRecording
                    ? "text-red-500 hover:text-red-400 animate-pulse"
                    : isTranscribing || isEnhancing
                    ? "text-purple-500"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
                disabled={isSending || isTranscribing || isEnhancing}
                onClick={toggleRecording}
                title={
                  isTranscribing ? "Transcribing..." :
                  isEnhancing ? "AI analyzing..." :
                  isRecording ? "Stop recording (click to stop)" :
                  "Start voice input"
                }
              >
                {isTranscribing || isEnhancing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="h-4 w-4" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Send Button */}
            <Button
              size="icon"
              className={cn(
                "h-8 w-8 rounded-lg transition-all",
                canSend
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed"
              )}
              onClick={handleSendMessage}
              disabled={!canSend}
              title="Send message (Enter)"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>


      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
    </div>
  );
};
