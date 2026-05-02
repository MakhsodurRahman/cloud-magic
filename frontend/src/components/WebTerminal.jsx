import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { Loader2, X, Minus, Square, Copy, ExternalLink, Terminal as TerminalIcon, Server, Play, Shield, Globe } from 'lucide-react';

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

const WebTerminal = ({ explorationData, region, loading, onRefresh }) => {
  const [activeInstance, setActiveInstance] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [status, setStatus] = useState('');
  
  const instances = explorationData?.EC2 || [];

  const handleConnect = (instance) => {
    setActiveInstance(instance);
    setIsConnecting(true);
    setStatus('Connecting to ' + (instance.name || instance.id) + '...');
  };

  const handleBack = () => {
    setIsConnecting(false);
    setActiveInstance(null);
  };

  if (loading) {
    return (
      <div className="config-panel animate-fade" style={{ textAlign: 'center', padding: '100px 0' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 20px', color: 'var(--accent)' }} />
        <h3 style={{ margin: 0 }}>Scanning us-east-1...</h3>
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>Locating your EC2 instances...</p>
      </div>
    );
  }

  if (isConnecting && activeInstance) {
    // ... terminal view ...
    return (
      <div className="config-panel animate-fade" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleBack} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 700 }}>
              ← Back to List
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text)', fontSize: '0.9rem', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, background: status === 'Connected' ? '#4caf50' : 'var(--accent)', borderRadius: '50%' }}></span>
              ec2-user@{activeInstance.publicIp || activeInstance.privateIp}
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{status}</div>
        </div>

        <div style={{ flexGrow: 1, background: '#1e1e1e', borderRadius: '12px', padding: '10px', overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
          <TerminalContent 
            host={activeInstance.publicIp || activeInstance.privateIp} 
            user="ec2-user" 
            keyName={activeInstance.keyName} 
            status={status} 
            setStatus={setStatus} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="config-panel animate-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <TerminalIcon size={24} color="var(--accent)" />
            <h2 style={{ margin: 0 }}>Remote Console</h2>
          </div>
          <p style={{ color: 'var(--text-2)', margin: 0, fontSize: '0.9rem' }}>Select an active EC2 instance to establish a secure SSH connection.</p>
        </div>
        <button className="btn" onClick={onRefresh} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
          <Loader2 size={14} className={loading ? 'animate-spin' : ''} style={{ display: loading ? 'block' : 'none' }} />
          {!loading && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Loader2 size={14} style={{ opacity: 0 }} /> Refresh List</span>}
        </button>
      </div>

      {!instances || instances.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--panel-bg)', borderRadius: '16px', border: '1px dashed var(--panel-border)' }}>
          <p style={{ color: 'var(--text-2)' }}>No active EC2 instances found in {region}.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
          {instances.map(inst => (
            <div key={inst.id} className="provider-card" style={{ cursor: 'default', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,153,0,0.1)', color: '#FF9900', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Server size={20} />
                </div>
                <div style={{ fontSize: '0.7rem', background: inst.state === 'running' ? 'rgba(48,209,88,0.1)' : 'rgba(255,59,48,0.1)', color: inst.state === 'running' ? '#30d158' : '#ff3b30', padding: '3px 8px', borderRadius: '12px', fontWeight: 700, textTransform: 'uppercase' }}>
                  {inst.state}
                </div>
              </div>

              <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 700 }}>{inst.name || 'Unnamed Instance'}</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.78rem', color: 'var(--text-2)', fontFamily: 'monospace' }}>{inst.id}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <Globe size={14} color="var(--text-3)" />
                  <span style={{ color: 'var(--text-2)' }}>IP:</span>
                  <span style={{ fontWeight: 600 }}>{inst.publicIp || inst.privateIp}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <Shield size={14} color="var(--text-3)" />
                  <span style={{ color: 'var(--text-2)' }}>Key:</span>
                  <span style={{ fontWeight: 600 }}>{inst.keyName || 'None'}</span>
                </div>
              </div>

              <button 
                className="btn btn-primary" 
                onClick={() => handleConnect(inst)}
                disabled={inst.state !== 'running'}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Play size={14} fill="currentColor" /> Connect SSH
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WebTerminal;
