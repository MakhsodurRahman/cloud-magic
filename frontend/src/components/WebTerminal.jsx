import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Loader2, X } from 'lucide-react';

const WebTerminal = ({ host, user, keyName, onClose }) => {
  const terminalRef = useRef(null);
  const socketRef = useRef(null);
  const [status, setStatus] = useState('Connecting to ' + host + '...');

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
      fontFamily: '"Fira Code", monospace',
      fontSize: 14
    });
    
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    const wsUrl = `ws://localhost:8080/api/terminal?host=${host}&user=${user}&keyName=${keyName || ''}`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setStatus('Connected');
      term.focus();
    };

    socket.onmessage = (event) => {
      term.write(event.data);
    };

    socket.onclose = () => {
      setStatus('Disconnected');
      term.write('\r\n\x1b[31m[Connection Closed]\x1b[0m\r\n');
    };

    socket.onerror = (error) => {
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
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      term.dispose();
    };
  }, [host, user, keyName]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '80%', height: '80%', background: '#1e1e1e', borderRadius: '8px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', background: '#2d2d2d', borderBottom: '1px solid #3d3d3d' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#fff', fontSize: '14px' }}>
            {status === 'Connected' ? <span style={{ width: 8, height: 8, background: '#4caf50', borderRadius: '50%' }}></span> : <Loader2 size={14} className="animate-spin" />}
            {user}@{host}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={18} /></button>
        </div>
        <div ref={terminalRef} style={{ flexGrow: 1, padding: '10px' }} />
      </div>
    </div>
  );
};

export default WebTerminal;
