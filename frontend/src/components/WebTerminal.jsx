import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Loader2, X, Minus, Square, Copy, ExternalLink } from 'lucide-react';

// Separated the actual terminal logic into a sub-component so it can be rendered 
// either inside the main div OR inside the external popup window.
const TerminalContent = ({ host, user, keyName, status, setStatus }) => {
  const terminalRef = useRef(null);
  const fitAddonRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14
    });
    
    const fitAddon = new FitAddon();
    fitAddonRef.current = fitAddon;
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    
    // Slight delay to ensure parent container is fully rendered before fitting
    setTimeout(() => fitAddon.fit(), 50);

    const wsUrl = `ws://localhost:8080/api/terminal?host=${host}&user=${user}&keyName=${keyName || ''}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('Connected');
      term.focus();
    };

    socket.onmessage = (event) => term.write(event.data);
    socket.onclose = () => {
      setStatus('Disconnected');
      term.write('\r\n\x1b[31m[Connection Closed]\x1b[0m\r\n');
    };
    socket.onerror = () => {
      setStatus('Connection Error');
      term.write('\r\n\x1b[31m[WebSocket Error]\x1b[0m\r\n');
    };

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);
      }
    });

    const handleResize = () => fitAddon.fit();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socket.readyState === WebSocket.OPEN) socket.close();
      term.dispose();
    };
  }, [host, user, keyName]);

  return <div ref={terminalRef} style={{ width: '100%', height: '100%' }} />;
};

const WebTerminal = ({ host, user, keyName, onClose }) => {
  const [status, setStatus] = useState('Connecting to ' + host + '...');
  const [isMaximized, setIsMaximized] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isPoppedOut, setIsPoppedOut] = useState(false);
  
  const [position, setPosition] = useState({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 250 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, lastX: 0, lastY: 0 });
  
  const externalWindowRef = useRef(null);
  const [externalContainer, setExternalContainer] = useState(null);

  // Function to create a native OS window and portal the React component into it
  const handlePopOut = () => {
    setIsPoppedOut(true);
    externalWindowRef.current = window.open('', '', 'width=800,height=500,left=200,top=200');
    
    if (!externalWindowRef.current) {
      alert("Please allow popups to open the terminal in a new window.");
      setIsPoppedOut(false);
      return;
    }

    externalWindowRef.current.document.title = `Terminal: ${user}@${host}`;
    externalWindowRef.current.document.body.style.margin = '0';
    externalWindowRef.current.document.body.style.background = '#1e1e1e';
    externalWindowRef.current.document.body.style.overflow = 'hidden';
    
    // Inject xterm styles into the new window
    document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
      externalWindowRef.current.document.head.appendChild(el.cloneNode(true));
    });

    const div = document.createElement('div');
    div.style.width = '100vw';
    div.style.height = '100vh';
    div.style.padding = '10px';
    div.style.boxSizing = 'border-box';
    externalWindowRef.current.document.body.appendChild(div);
    setExternalContainer(div);

    externalWindowRef.current.addEventListener('beforeunload', () => {
      onClose(); // Close the session entirely if the user closes the popup window
    });
  };

  const handleMouseDown = (e) => {
    if (isMaximized || isPoppedOut) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, lastX: position.x, lastY: position.y };
  };

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    setPosition({
      x: dragRef.current.lastX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.lastY + (e.clientY - dragRef.current.startY)
    });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // If popped out, render the terminal into the new native window via React Portals
  if (isPoppedOut) {
    if (!externalContainer) return null;
    return createPortal(
      <TerminalContent host={host} user={user} keyName={keyName} status={status} setStatus={setStatus} />,
      externalContainer
    );
  }

  const windowStyle = isMaximized 
    ? { top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', borderRadius: 0 }
    : { top: position.y, left: position.x, width: '800px', height: isMinimized ? '40px' : '500px', borderRadius: '8px' };

  return (
    <>
      {!isMaximized && !isMinimized && <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9998 }} />}
      
      <div style={{ position: 'fixed', background: '#1e1e1e', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.6)', zIndex: 9999, transition: isDragging ? 'none' : 'width 0.2s, height 0.2s, top 0.2s, left 0.2s, border-radius 0.2s', border: '1px solid #3d3d3d', ...windowStyle }}>
        <div onMouseDown={handleMouseDown} onDoubleClick={() => setIsMaximized(!isMaximized)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px', height: '40px', minHeight: '40px', background: '#2d2d2d', borderBottom: '1px solid #3d3d3d', cursor: isMaximized ? 'default' : 'grab', userSelect: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fff', fontSize: '13px', fontWeight: 600 }}>
            {status === 'Connected' ? <span style={{ width: 8, height: 8, background: '#4caf50', borderRadius: '50%' }}></span> : <Loader2 size={12} className="animate-spin" />}
            {user}@{host}
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={handlePopOut} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }} title="Pop out to new window">
              <ExternalLink size={14} />
            </button>
            <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }} title="Minimize">
              <Minus size={14} />
            </button>
            <button onClick={() => { setIsMaximized(!isMaximized); setIsMinimized(false); }} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '4px' }} title="Maximize">
              {isMaximized ? <Copy size={14} /> : <Square size={14} />}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ff5f56', cursor: 'pointer', padding: '4px' }} title="Close">
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flexGrow: 1, padding: '10px', display: isMinimized ? 'none' : 'block', overflow: 'hidden' }}>
          <TerminalContent host={host} user={user} keyName={keyName} status={status} setStatus={setStatus} />
        </div>
      </div>
    </>
  );
};

export default WebTerminal;
