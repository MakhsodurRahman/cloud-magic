import React, { useState } from 'react';
import { Database, Play, AlertCircle, CheckCircle2, Clock, Terminal, Server, Key, Shield, ChevronRight, Loader2 } from 'lucide-react';

const DatabaseConsole = () => {
  const [conn, setConn] = useState({
    engine: 'postgresql',
    host: '',
    port: '5432',
    database: 'postgres',
    username: 'postgres',
    password: ''
  });
  
  const [query, setQuery] = useState('-- Welcome to CloudMagic SQL Console\n-- Write your SQL queries here and press F5 or click Execute\n\nSELECT current_user, version();');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleConnChange = (e) => {
    const { name, value } = e.target;
    setConn(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'engine') {
        if (value === 'postgresql') next.port = '5432';
        if (value === 'mysql') next.port = '3306';
      }
      return next;
    });
  };

  const handleExecute = async () => {
    if (!conn.host) {
      setResult({ status: 'error', message: 'Host endpoint is required to connect to the database.' });
      return;
    }
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('http://localhost:8080/api/db-console/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...conn, query })
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ status: 'error', message: 'Network error: Could not reach the backend. Ensure Spring Boot is running.' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!conn.host) return;
    setTestingConn(true);
    setTestResult(null);
    try {
      const res = await fetch('http://localhost:8080/api/db-console/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conn)
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ status: 'error', message: 'Network error. Backend not reachable.' });
    } finally {
      setTestingConn(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f111a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      
      {/* Sleek Left Sidebar - Connection Settings */}
      <div style={{ width: '320px', background: '#161b22', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', flexShrink: 0, boxShadow: '4px 0 24px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(180deg, #1f242c 0%, #161b22 100%)' }}>
          <div style={{ padding: '8px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px' }}>
            <Database size={24} color="#38bdf8" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '0.5px' }}>SQL Console</h2>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>CloudMagic Premium</div>
          </div>
        </div>
        
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Server size={14} /> Database Engine
            </label>
            <select name="engine" value={conn.engine} onChange={handleConnChange} style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s', appearance: 'none' }}>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
            </select>
          </div>
          
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Host Endpoint</label>
            <input type="text" name="host" value={conn.host} onChange={handleConnChange} placeholder="mydb.xyz.us-east-1.rds.amazonaws.com" style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Port</label>
              <input type="text" name="port" value={conn.port} onChange={handleConnChange} style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Database</label>
              <input type="text" name="database" value={conn.database} onChange={handleConnChange} style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s' }} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #30363d', margin: '10px 0', paddingTop: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Shield size={14} /> Credentials
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="text" name="username" value={conn.username} onChange={handleConnChange} placeholder="Username" style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s' }} />
              <input type="password" name="password" value={conn.password} onChange={handleConnChange} placeholder="Password" style={{ width: '100%', padding: '12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', transition: 'border-color 0.2s', letterSpacing: '2px' }} />
            </div>
            
            <button 
              onClick={handleTestConnection}
              disabled={testingConn || !conn.host}
              style={{
                marginTop: '16px', width: '100%', padding: '10px',
                background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8',
                border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '6px',
                fontWeight: 600, fontSize: '0.85rem', cursor: (testingConn || !conn.host) ? 'not-allowed' : 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                opacity: (testingConn || !conn.host) ? 0.6 : 1, transition: 'all 0.2s'
              }}
            >
              {testingConn ? <Loader2 size={14} className="spinner" /> : <Shield size={14} />}
              Test Connection
            </button>
            
            {testResult && (
              <div style={{ 
                marginTop: '12px', padding: '12px', borderRadius: '6px', fontSize: '0.8rem',
                background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: testResult.status === 'success' ? '#10b981' : '#fca5a5',
                border: `1px solid ${testResult.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }}>
                  {testResult.status === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {testResult.status === 'success' ? 'Success' : 'Connection Failed'}
                </div>
                <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{testResult.message}</div>
              </div>
            )}
          </div>
        </div>
        
        {/* Connection Status indicator */}
        <div style={{ marginTop: 'auto', padding: '20px 24px', borderTop: '1px solid #30363d', background: '#161b22', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: conn.host ? '#10b981' : '#f59e0b', boxShadow: conn.host ? '0 0 10px #10b981' : '0 0 10px #f59e0b' }}></div>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 500 }}>{conn.host ? 'Ready to connect' : 'Awaiting endpoint...'}</span>
        </div>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Toolbar */}
        <div style={{ height: '60px', borderBottom: '1px solid #30363d', background: '#161b22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500 }}>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <span style={{ color: '#e2e8f0' }}>Query.sql</span>
          </div>
          
          <button 
            onClick={handleExecute} 
            disabled={loading || !conn.host}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '8px 24px', background: (loading || !conn.host) ? '#374151' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', 
              color: (loading || !conn.host) ? '#9ca3af' : 'white', 
              border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem',
              cursor: (loading || !conn.host) ? 'not-allowed' : 'pointer', 
              boxShadow: (loading || !conn.host) ? 'none' : '0 4px 14px rgba(37, 99, 235, 0.4)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.8 : 1
            }}
          >
            {loading ? <Loader2 size={16} className="spinner" /> : <Play size={16} fill="currentColor" />}
            Execute Query
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '4px' }}>F5</span>
          </button>
        </div>

        {/* Editor Area */}
        <div style={{ height: '50%', borderBottom: '1px solid #30363d', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '10px 24px', background: '#0d1117', borderBottom: '1px solid #21262d', fontSize: '0.8rem', color: '#8b949e', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Terminal size={14} /> query.sql</span>
            <span>{conn.engine.toUpperCase()}</span>
          </div>
          <div style={{ flex: 1, position: 'relative', background: '#0d1117', display: 'flex' }}>
            {/* Line Numbers Mockup */}
            <div style={{ padding: '20px 10px', background: '#0d1117', color: '#484f58', textAlign: 'right', userSelect: 'none', borderRight: '1px solid #21262d', fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace", fontSize: '15px', lineHeight: '1.6' }}>
              {query.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            {/* Textarea */}
            <textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
                  e.preventDefault();
                  handleExecute();
                }
                // Handle tab
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const start = e.target.selectionStart;
                  const end = e.target.selectionEnd;
                  setQuery(query.substring(0, start) + '  ' + query.substring(end));
                  setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 2; }, 0);
                }
              }}
              spellCheck={false}
              style={{ 
                flex: 1, padding: '20px', background: 'transparent', color: '#c9d1d9', 
                border: 'none', fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace", 
                fontSize: '15px', lineHeight: '1.6', resize: 'none', outline: 'none',
                whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto'
              }}
            />
          </div>
        </div>

        {/* Results Data Grid */}
        <div style={{ flex: 1, background: '#0f111a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ padding: '10px 24px', background: '#161b22', borderBottom: '1px solid #30363d', fontSize: '0.8rem', color: '#8b949e', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Data Output
          </div>
          
          <div style={{ flex: 1, overflow: 'auto', padding: result && result.status === 'success' && result.rows ? '0' : '24px', position: 'relative' }}>
            
            {!result && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#484f58', gap: '16px' }}>
                <Database size={48} strokeWidth={1} />
                <div style={{ fontSize: '0.95rem' }}>Run a query to display results here.</div>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#38bdf8', gap: '16px' }}>
                <Loader2 size={40} className="spinner" />
                <div style={{ fontSize: '0.95rem', color: '#94a3b8' }}>Executing query...</div>
              </div>
            )}

            {result?.status === 'error' && (
              <div style={{ padding: '20px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#fca5a5', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} color="#ef4444" />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '8px', color: '#ef4444' }}>Execution Error</div>
                  <div style={{ fontFamily: "Consolas, monospace", whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.9rem', lineHeight: '1.5' }}>{result.message}</div>
                </div>
              </div>
            )}

            {result?.status === 'success' && result.rows && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#161b22', zIndex: 1, boxShadow: '0 1px 0 #30363d' }}>
                  <tr>
                    <th style={{ padding: '12px 16px', fontWeight: 600, color: '#8b949e', borderRight: '1px solid #30363d', width: '50px', textAlign: 'center' }}>#</th>
                    {result.columns.map((col, i) => (
                      <th key={i} style={{ padding: '12px 16px', fontWeight: 600, color: '#c9d1d9', borderRight: '1px solid #30363d' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #21262d', background: rIdx % 2 === 0 ? '#0d1117' : '#0f111a', transition: 'background 0.1s' }} onMouseEnter={(e) => e.currentTarget.style.background = '#161b22'} onMouseLeave={(e) => e.currentTarget.style.background = rIdx % 2 === 0 ? '#0d1117' : '#0f111a'}>
                      <td style={{ padding: '10px 16px', color: '#484f58', borderRight: '1px solid #21262d', textAlign: 'center', fontFamily: "Consolas, monospace" }}>{rIdx + 1}</td>
                      {result.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ padding: '10px 16px', color: '#e2e8f0', borderRight: '1px solid #21262d', fontFamily: "Consolas, monospace", whiteSpace: 'pre' }}>
                          {row[col] === null ? <span style={{ color: '#484f58', fontStyle: 'italic' }}>NULL</span> : 
                           typeof row[col] === 'boolean' ? <span style={{ color: '#a5d6ff' }}>{String(row[col])}</span> :
                           typeof row[col] === 'number' ? <span style={{ color: '#79c0ff' }}>{row[col]}</span> :
                           String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {result?.status === 'success' && !result.rows && (
              <div style={{ padding: '24px', display: 'flex', alignItems: 'flex-start', gap: '12px', color: '#10b981' }}>
                <CheckCircle2 size={24} style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Success</div>
                  <div style={{ fontFamily: "Consolas, monospace", color: '#a7f3d0' }}>{result.message}</div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Status Bar */}
          <div style={{ height: '32px', background: '#0d1117', borderTop: '1px solid #30363d', display: 'flex', alignItems: 'center', padding: '0 16px', gap: '20px', fontSize: '0.75rem', color: '#8b949e' }}>
            {result && result.status === 'success' ? (
              <>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10b981', fontWeight: 600 }}>
                  <CheckCircle2 size={12} strokeWidth={3} /> Query OK
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} /> {result.executionTimeMs} ms
                </span>
                {result.rows && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={12} /> {result.rows.length} rows fetched
                  </span>
                )}
              </>
            ) : result && result.status === 'error' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600 }}>
                <AlertCircle size={12} strokeWidth={3} /> Execution Failed
              </span>
            ) : (
              <span>Ready. Press F5 to execute.</span>
            )}
            
            <div style={{ marginLeft: 'auto' }}>CloudMagic Serverless SQL Engine</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DatabaseConsole;
