import { useState, useEffect, useCallback } from 'react';
import type { UIStep } from '@/types/test';
import toast from 'react-hot-toast';

interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  steps: UIStep[];
  sessionId: string | null;
  startUrl: string | null; // URL when recording started
}

export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    steps: [],
    sessionId: null,
    startUrl: null,
  });

  useEffect(() => {
    // Listen for recording state changes from background
    const handleMessage = (message: { type: string; step?: UIStep; steps?: UIStep[] }) => {
      switch (message.type) {
        case 'recording:state-changed':
          // Update local state from background
          break;
        case 'recording:step-added':
          if (message.step) {
            setState((prev) => ({
              ...prev,
              steps: [...prev.steps, message.step!],
            }));
          }
          break;
        case 'recording:step-updated':
          if (message.step) {
            setState((prev) => ({
              ...prev,
              steps: prev.steps.map((s) =>
                s.id === message.step!.id ? message.step! : s
              ),
            }));
          }
          break;
        case 'recording:completed':
          setState((prev) => ({
            ...prev,
            isRecording: false,
            steps: message.steps || prev.steps,
          }));
          break;
        case 'recording:paused':
          setState((prev) => ({ ...prev, isPaused: true }));
          break;
        case 'recording:resumed':
          setState((prev) => ({ ...prev, isPaused: false }));
          break;
      }
    };

    chrome.runtime.onMessage.addListener(handleMessage);
    return () => chrome.runtime.onMessage.removeListener(handleMessage);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Capture the starting URL before recording begins
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const startUrl = tab?.url || null;

      const response = await chrome.runtime.sendMessage({
        type: 'command:start-recording',
      });

      if (response.success) {
        setState({
          isRecording: true,
          isPaused: false,
          steps: [],
          sessionId: crypto.randomUUID(),
          startUrl,
        });
        toast.success('Recording started');
      } else {
        toast.error(response.error || 'Failed to start recording');
      }
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording. Make sure you are on a web page.');
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'command:stop-recording',
      });

      if (response.success) {
        setState((prev) => ({
          ...prev,
          isRecording: false,
          steps: response.steps || prev.steps,
        }));
        toast.success(`Recording stopped. ${response.steps?.length || 0} steps captured.`);
        return response.steps || [];
      } else {
        toast.error(response.error || 'Failed to stop recording');
        return [];
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
      return [];
    }
  }, []);

  const pauseRecording = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'command:pause-recording' });
    setState((prev) => ({ ...prev, isPaused: true }));
  }, []);

  const resumeRecording = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'command:resume-recording' });
    setState((prev) => ({ ...prev, isPaused: false }));
  }, []);

  return {
    ...state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
