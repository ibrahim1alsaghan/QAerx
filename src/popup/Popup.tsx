import { useState, useEffect } from 'react';

export default function Popup() {
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    // Get current recording state
    chrome.runtime.sendMessage({ type: 'command:get-state' }, (response) => {
      if (response?.state) {
        setIsRecording(response.state.isRecording);
      }
    });
  }, []);

  const openSidePanel = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.sidePanel.open({ tabId: tab.id });
      window.close();
    }
  };

  const toggleRecording = async () => {
    const type = isRecording ? 'command:stop-recording' : 'command:start-recording';
    const response = await chrome.runtime.sendMessage({ type });
    if (response.success) {
      setIsRecording(!isRecording);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 48,
        height: 48,
        background: '#10a37f',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 12px',
        fontSize: 24
      }}>
        ⚡
      </div>

      <h1 style={{ fontSize: 18, margin: '0 0 8px' }}>QAerx</h1>
      <p style={{ fontSize: 12, color: '#8e8ea0', margin: '0 0 16px' }}>
        Automation Testing
      </p>

      <button
        onClick={openSidePanel}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: '#10a37f',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
          marginBottom: 8,
        }}
      >
        Open Dashboard
      </button>

      <button
        onClick={toggleRecording}
        style={{
          width: '100%',
          padding: '10px 16px',
          background: isRecording ? '#ef4444' : '#343541',
          color: 'white',
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {isRecording ? '⏹ Stop Recording' : '⏺ Start Recording'}
      </button>
    </div>
  );
}
