import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Database, Play, AlertCircle, CheckCircle2, Clock, Terminal, Server, Key, Shield, 
  ChevronRight, ChevronDown, Loader2, Table2, Columns, Code, LayoutGrid, Zap, RefreshCw
} from 'lucide-react';

const SqlEditor = ({ query, setQuery, onExecute, databases, tables }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 });
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const textareaRef = useRef(null);
  const highlightRef = useRef(null);

  const allTables = useMemo(() => {
    const list = [];
    Object.values(tables).forEach(dbTables => {
      dbTables.forEach(t => {
         if (!list.includes(t.name)) list.push(t.name);
      });
    });
    return list;
  }, [tables]);

  const SQL_KEYWORDS = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 
    'ALTER', 'DROP', 'INDEX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'VALUES', 
    'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'ON', 'AS', 'AND', 'OR', 'NOT', 'NULL', 
    'IS', 'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC', 'SERIAL', 
    'VARCHAR', 'UNIQUE', 'INT', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'TRUNCATE', 'VIEW'
  ];

  const highlightSql = (text) => {
    let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/('[^']*')/g, '<span style="color: #a5d6ff;">$1</span>');
    const keywordRegex = new RegExp(`\\b(${SQL_KEYWORDS.join('|')})\\b`, 'gi');
    html = html.replace(keywordRegex, '<span style="color: #ff7b72; font-weight: 600;">$1</span>');
    return html;
  };

  const getWordUnderCursor = (text, pos) => {
    const before = text.substring(0, pos);
    const match = before.match(/[a-zA-Z0-9_]+$/);
    return match ? match[0] : '';
  };

  const updateSuggestionPos = (element, position) => {
    const lines = element.value.substring(0, position).split('\n');
    const currentLineIdx = lines.length - 1;
    const currentLineLength = lines[currentLineIdx].length;
    const top = (currentLineIdx * 24) + 24; 
    const left = (currentLineLength * 9);
    setSuggestionPos({ 
      top: Math.min(top, element.clientHeight - 40), 
      left: Math.min(left, element.clientWidth - 200) 
    });
  };

  const handleInput = (e) => {
    const val = e.target.value;
    setQuery(val);
    
    const pos = e.target.selectionStart;
    const word = getWordUnderCursor(val, pos);
    
    if (word.length >= 2) {
      const lowerWord = word.toLowerCase();
      const matchedKeywords = SQL_KEYWORDS.filter(k => k.toLowerCase().includes(lowerWord)).map(k => ({ text: k, type: 'Keyword' }));
      const matchedDbs = databases.filter(db => db.toLowerCase().includes(lowerWord)).map(d => ({ text: d, type: 'Database' }));
      const matchedTables = allTables.filter(t => t.toLowerCase().includes(lowerWord)).map(t => ({ text: t, type: 'Table' }));
      
      const newSuggestions = [...matchedKeywords, ...matchedDbs, ...matchedTables].slice(0, 8);
      
      if (newSuggestions.length > 0) {
        setSuggestions(newSuggestions);
        setActiveIdx(0);
        setShowSuggestions(true);
        updateSuggestionPos(e.target, pos);
      } else {
        setShowSuggestions(false);
      }
    } else {
      setShowSuggestions(false);
    }
  };

  const insertSuggestion = (suggestion) => {
    const pos = textareaRef.current.selectionStart;
    const word = getWordUnderCursor(query, pos);
    const before = query.substring(0, pos - word.length);
    const after = query.substring(pos);
    
    const newQuery = before + suggestion + after;
    setQuery(newQuery);
    setShowSuggestions(false);
    
    setTimeout(() => {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.selectionEnd = before.length + suggestion.length;
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx(prev => (prev + 1) % suggestions.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx(prev => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertSuggestion(suggestions[activeIdx].text);
      } else if (e.key === 'Escape') {
        setShowSuggestions(false);
      }
    } else {
      if (e.key === 'F5' || (e.ctrlKey && e.key === 'Enter')) {
        e.preventDefault();
        onExecute();
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = e.target.selectionStart;
        const end = e.target.selectionEnd;
        setQuery(query.substring(0, start) + '  ' + query.substring(end));
        setTimeout(() => { e.target.selectionStart = e.target.selectionEnd = start + 2; }, 0);
      }
    }
  };

  return (
    <div style={{ flex: 1, position: 'relative', background: '#0d1117', display: 'flex' }}>
      <div style={{ padding: '20px 10px', background: '#0d1117', color: '#484f58', textAlign: 'right', userSelect: 'none', borderRight: '1px solid #21262d', fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace", fontSize: '15px', lineHeight: '24px' }}>
        {query.split('\n').map((_, i) => <div key={i}>{i + 1}</div>)}
      </div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div 
          ref={highlightRef}
          dangerouslySetInnerHTML={{ __html: highlightSql(query) + '<br/>' }}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            padding: '20px', margin: 0, boxSizing: 'border-box',
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontSize: '15px', lineHeight: '24px',
            color: '#c9d1d9', whiteSpace: 'pre', overflowWrap: 'normal',
            pointerEvents: 'none', zIndex: 1, overflow: 'hidden'
          }}
        />
        <textarea 
          ref={textareaRef}
          value={query}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
            padding: '20px', margin: 0, boxSizing: 'border-box',
            background: 'transparent', color: 'transparent', caretColor: '#e2e8f0',
            border: 'none', fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace", 
            fontSize: '15px', lineHeight: '24px', resize: 'none', outline: 'none',
            whiteSpace: 'pre', overflowWrap: 'normal', zIndex: 2, overflow: 'auto'
          }}
          onScroll={(e) => {
            if (highlightRef.current) {
              highlightRef.current.scrollTop = e.target.scrollTop;
              highlightRef.current.scrollLeft = e.target.scrollLeft;
            }
          }}
        />
        {showSuggestions && (
          <div style={{
            position: 'absolute', top: `${suggestionPos.top}px`, left: `${suggestionPos.left + 20}px`,
            background: '#161b22', border: '1px solid #30363d', borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10, minWidth: '200px', overflow: 'hidden'
          }}>
            {suggestions.map((s, idx) => (
              <div 
                key={idx}
                onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s.text); }}
                style={{
                  padding: '8px 12px', background: idx === activeIdx ? '#1f6feb' : 'transparent',
                  color: idx === activeIdx ? '#ffffff' : '#c9d1d9', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
                }}
                onMouseEnter={() => setActiveIdx(idx)}
              >
                <span style={{ fontFamily: "Consolas, monospace" }}>{s.text}</span>
                <span style={{ fontSize: '0.7rem', color: idx === activeIdx ? '#a5d6ff' : '#8b949e' }}>{s.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DatabaseConsole = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [activeTable, setActiveTable] = useState(null);
  
  // Connection State
  const [conn, setConn] = useState({
    engine: 'postgresql',
    host: '',
    port: '5432',
    database: 'postgres',
    username: 'postgres',
    password: ''
  });
  
  const [testingConn, setTestingConn] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Query State
  const [query, setQuery] = useState('-- Write your SQL queries here\nSELECT current_user, version();');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Explorer State
  const [databases, setDatabases] = useState([]);
  const [expandedDbs, setExpandedDbs] = useState(new Set());
  const [tables, setTables] = useState({}); // { "dbName": [{name: "users", type: "TABLE"}] }
  const [expandedTables, setExpandedTables] = useState(new Set()); // "dbName.tableName"
  const [columns, setColumns] = useState({}); // { "dbName.tableName": [{name: "id", type: "int4"}] }
  const [explorerLoading, setExplorerLoading] = useState(null); // 'dbName' or 'dbName.tableName'

  // Resizing State
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [editorHeight, setEditorHeight] = useState(400); // pixels
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  
  const sidebarRef = useRef(null);
  const editorRef = useRef(null);
  const sidebarWidthRef = useRef(320);
  const editorHeightRef = useRef(400);

  useEffect(() => {
    let rafId = null;
    const handleMouseMove = (e) => {
      if (rafId) cancelAnimationFrame(rafId);
      
      rafId = requestAnimationFrame(() => {
        if (isResizingSidebar) {
          const newWidth = Math.max(200, Math.min(600, e.clientX));
          sidebarWidthRef.current = newWidth;
          if (sidebarRef.current) {
            sidebarRef.current.style.width = `${newWidth}px`;
          }
        }
        if (isResizingEditor) {
          const topToolbarHeight = 60;
          const newHeight = Math.max(150, Math.min(window.innerHeight - 200, e.clientY - topToolbarHeight));
          editorHeightRef.current = newHeight;
          if (editorRef.current) {
            editorRef.current.style.height = `${newHeight}px`;
          }
        }
      });
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) setSidebarWidth(sidebarWidthRef.current);
      if (isResizingEditor) setEditorHeight(editorHeightRef.current);
      
      setIsResizingSidebar(false);
      setIsResizingEditor(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    if (isResizingSidebar || isResizingEditor) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingSidebar ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingSidebar, isResizingEditor]);

  const handleConnChange = (e) => {
    const { name, value } = e.target;
    setConn(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'engine') {
        if (value === 'postgresql') { next.port = '5432'; next.database = 'postgres'; }
        if (value === 'mysql') { next.port = '3306'; next.database = 'mysql'; }
        if (value === 'sqlserver') { next.port = '1433'; next.database = 'master'; }
      }
      return next;
    });
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
      return data.status === 'success';
    } catch (err) {
      setTestResult({ status: 'error', message: 'Network error. Backend not reachable.' });
      return false;
    } finally {
      setTestingConn(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    const success = await handleTestConnection();
    if (success) {
      setIsConnected(true);
      fetchDatabases();
    }
    setConnecting(false);
  };

  const fetchMetadata = async (action, targetDatabase = null, targetTable = null) => {
    try {
      const res = await fetch('http://localhost:8080/api/db-console/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...conn, action, targetDatabase, targetTable })
      });
      const data = await res.json();
      if (data.status === 'success') {
        return data.data;
      }
      return null;
    } catch (err) {
      console.error("Metadata fetch error:", err);
      return null;
    }
  };

  const fetchDatabases = async () => {
    setExplorerLoading('root');
    const dbs = await fetchMetadata('databases');
    if (dbs) setDatabases(dbs);
    setExplorerLoading(null);
  };

  const toggleDb = async (dbName) => {
    const newExpanded = new Set(expandedDbs);
    if (newExpanded.has(dbName)) {
      newExpanded.delete(dbName);
      setExpandedDbs(newExpanded);
    } else {
      newExpanded.add(dbName);
      setExpandedDbs(newExpanded);
      if (!tables[dbName]) {
        setExplorerLoading(dbName);
        const tbls = await fetchMetadata('tables', dbName);
        if (tbls) {
          setTables(prev => ({ ...prev, [dbName]: tbls }));
        }
        setExplorerLoading(null);
      }
    }
  };

  const toggleTable = async (dbName, tableName) => {
    const key = `${dbName}.${tableName}`;
    const newExpanded = new Set(expandedTables);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
      setExpandedTables(newExpanded);
    } else {
      newExpanded.add(key);
      setExpandedTables(newExpanded);
      if (!columns[key]) {
        setExplorerLoading(key);
        const cols = await fetchMetadata('columns', dbName, tableName);
        if (cols) {
          setColumns(prev => ({ ...prev, [key]: cols }));
        }
        setExplorerLoading(null);
      }
    }
  };

  const previewTable = (dbName, tableName) => {
    const key = `${dbName}.${tableName}`;
    setActiveTable(key);
    let newQuery = `SELECT * FROM ${tableName} LIMIT 100;`;
    if (conn.engine === 'postgresql' && dbName !== conn.database) {
      // Postgres cross-db query isn't natively supported like this, but we'll try to just set the query
      // Real SSMS would switch the context.
      setConn(prev => ({...prev, database: dbName}));
    }
    setQuery(newQuery);
    setTimeout(() => {
      executeSQL(newQuery, dbName);
    }, 10);
  };

  const handleExecute = () => {
    executeSQL(query, conn.database);
  };

  const executeSQL = async (sqlText, targetDb) => {
    if (!sqlText.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const dbToUse = targetDb || conn.database;
      const res = await fetch('http://localhost:8080/api/db-console/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...conn, database: dbToUse, query: sqlText })
      });
      const data = await res.json();
      setResult(data);

      if (data.status === 'success' && expandedDbs.has(dbToUse)) {
        const upperQuery = sqlText.toUpperCase();
        if (upperQuery.includes('CREATE ') || upperQuery.includes('DROP ') || upperQuery.includes('ALTER ') || upperQuery.includes('TRUNCATE ')) {
          const tbls = await fetchMetadata('tables', dbToUse);
          if (tbls) {
            setTables(prev => ({ ...prev, [dbToUse]: tbls }));
          }
        }
      }
    } catch (err) {
      setResult({ status: 'error', message: 'Network error: Could not reach backend.' });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // RENDER CONNECTION SCREEN
  // ---------------------------------------------------------------------------
  if (!isConnected) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#0f111a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif" }}>
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          .spinner { animation: spin 1s linear infinite; }
        `}</style>
        <div style={{ width: '450px', background: '#161b22', border: '1px solid #30363d', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          
          {/* Header */}
          <div style={{ padding: '24px', borderBottom: '1px solid #30363d', background: 'linear-gradient(180deg, #1f242c 0%, #161b22 100%)', textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '12px', marginBottom: '16px' }}>
              <Database size={32} color="#38bdf8" />
            </div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 8px 0', color: '#f8fafc' }}>Connect to Database</h1>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#8b949e' }}>CloudMagic Studio - Database Explorer</p>
          </div>

          {/* Form */}
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Database Engine</label>
              <select name="engine" value={conn.engine} onChange={handleConnChange} style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }}>
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Host</label>
              <input type="text" name="host" value={conn.host} onChange={handleConnChange} placeholder="db.xyz.us-east-1.rds.amazonaws.com" style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Port</label>
                <input type="text" name="port" value={conn.port} onChange={handleConnChange} style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Database Name</label>
                <input type="text" name="database" value={conn.database} onChange={handleConnChange} style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Username</label>
                <input type="text" name="username" value={conn.username} onChange={handleConnChange} style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase' }}>Password</label>
                <input type="password" name="password" value={conn.password} onChange={handleConnChange} style={{ width: '100%', padding: '10px 12px', background: '#0d1117', border: '1px solid #30363d', borderRadius: '6px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', letterSpacing: '2px' }} />
              </div>
            </div>

            {testResult && (
              <div style={{ padding: '12px', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', gap: '8px',
                background: testResult.status === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: testResult.status === 'success' ? '#10b981' : '#fca5a5',
                border: `1px solid ${testResult.status === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
              }}>
                {testResult.status === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />}
                <span style={{ lineHeight: '1.4' }}>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div style={{ padding: '20px 24px', borderTop: '1px solid #30363d', background: '#0d1117', display: 'flex', gap: '12px' }}>
            <button 
              onClick={handleTestConnection}
              disabled={testingConn || connecting || !conn.host}
              style={{ flex: 1, padding: '10px', background: 'transparent', color: '#e2e8f0', border: '1px solid #30363d', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
            >
              {testingConn ? <Loader2 size={16} className="spinner" /> : <Zap size={16} />} Test
            </button>
            <button 
              onClick={handleConnect}
              disabled={testingConn || connecting || !conn.host}
              style={{ flex: 2, padding: '10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(37, 99, 235, 0.4)' }}
            >
              {connecting ? <Loader2 size={16} className="spinner" /> : <CheckCircle2 size={16} />} Connect
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER WORKSPACE (SSMS-like)
  // ---------------------------------------------------------------------------
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f111a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", overflow: 'hidden' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spinner { animation: spin 1s linear infinite; }
      `}</style>
      
      {/* Resizing Overlay (Prevents event flickering) */}
      {(isResizingSidebar || isResizingEditor) && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, cursor: isResizingSidebar ? 'col-resize' : 'row-resize' }} />
      )}
      
      {/* LEFT SIDEBAR: Object Explorer */}
      <div 
        ref={sidebarRef}
        style={{ width: `${sidebarWidth}px`, background: '#161b22', borderRight: '1px solid #30363d', display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'relative', willChange: 'width' }}
      >
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '12px', background: 'linear-gradient(180deg, #1f242c 0%, #161b22 100%)' }}>
          <Server size={20} color="#38bdf8" />
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{conn.host.split('.')[0]}</div>
            <div style={{ fontSize: '0.75rem', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></div>
              Connected to {conn.engine}
            </div>
          </div>
        </div>
        
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #30363d', background: '#0d1117', fontSize: '0.75rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Object Explorer
        </div>

        {/* Tree View */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0', fontSize: '0.85rem' }}>
          {explorerLoading === 'root' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', color: '#8b949e' }}>
              <Loader2 size={14} className="spinner" /> Loading databases...
            </div>
          )}

          {databases.map(db => (
            <div key={db}>
              {/* Database Node */}
              <div 
                onClick={() => { toggleDb(db); setConn(prev => ({...prev, database: db})); }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s', color: '#e2e8f0' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#21262d'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                {expandedDbs.has(db) ? <ChevronDown size={14} color="#8b949e" /> : <ChevronRight size={14} color="#8b949e" />}
                <Database size={14} color="#38bdf8" />
                <span style={{ fontWeight: conn.database === db ? 600 : 400 }}>{db}</span>
                {explorerLoading === db && <Loader2 size={12} className="spinner" style={{ marginLeft: 'auto' }} />}
              </div>

              {/* Tables Container */}
              {expandedDbs.has(db) && tables[db] && (
                <div style={{ paddingLeft: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 16px', color: '#8b949e' }}>
                    <ChevronDown size={14} />
                    <LayoutGrid size={14} />
                    <span style={{ flex: 1 }}>Tables</span>
                    <RefreshCw 
                      size={14} 
                      style={{ cursor: 'pointer', transition: 'color 0.2s' }} 
                      color="#8b949e"
                      onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#8b949e'}
                      title="Refresh Tables"
                      onClick={async (e) => {
                        e.stopPropagation();
                        setExplorerLoading(db);
                        const tbls = await fetchMetadata('tables', db);
                        if (tbls) setTables(prev => ({ ...prev, [db]: tbls }));
                        setExplorerLoading(null);
                      }} 
                    />
                  </div>
                  <div style={{ paddingLeft: '16px' }}>
                    {tables[db].length === 0 && <div style={{ padding: '4px 16px', color: '#8b949e', fontStyle: 'italic', fontSize: '0.8rem' }}>No tables found</div>}
                    
                    {tables[db].map(tbl => {
                      const key = `${db}.${tbl.name}`;
                      const isExpanded = expandedTables.has(key);
                      return (
                        <div key={key}>
                          <div 
                            onClick={() => { toggleTable(db, tbl.name); previewTable(db, tbl.name); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 16px', cursor: 'pointer', userSelect: 'none', transition: 'background 0.1s', background: activeTable === key ? 'rgba(56, 189, 248, 0.15)' : 'transparent' }}
                            onMouseEnter={(e) => { if(activeTable !== key) e.currentTarget.style.background = '#21262d'; }}
                            onMouseLeave={(e) => { if(activeTable !== key) e.currentTarget.style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {isExpanded ? <ChevronDown size={14} color="#8b949e" /> : <ChevronRight size={14} color="#8b949e" />}
                            </div>
                            <Table2 size={14} color="#10b981" />
                            <span style={{ flex: 1, color: activeTable === key ? '#38bdf8' : '#e2e8f0', fontWeight: activeTable === key ? 600 : 400 }}>
                              {tbl.name}
                            </span>
                            {explorerLoading === key && <Loader2 size={12} className="spinner" />}
                          </div>

                          {/* Columns */}
                          {isExpanded && columns[key] && (
                            <div style={{ paddingLeft: '24px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 16px', color: '#8b949e' }}>
                                <ChevronDown size={14} /> <Columns size={14} /> Columns
                              </div>
                              <div style={{ paddingLeft: '16px' }}>
                                {columns[key].map((col, idx) => (
                                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '2px 16px', color: '#c9d1d9', fontSize: '0.8rem' }}>
                                    <div style={{ width: '12px' }}></div>
                                    <span style={{ color: '#8b949e' }}>•</span>
                                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{col.name}</span>
                                    <span style={{ color: '#8b949e', fontSize: '0.75rem' }}>{col.type}{col.size ? `(${col.size})` : ''}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Disconnect Button */}
        <div style={{ padding: '16px', borderTop: '1px solid #30363d', background: '#0d1117' }}>
          <button 
            onClick={() => setIsConnected(false)}
            style={{ width: '100%', padding: '8px', background: 'transparent', color: '#fca5a5', border: '1px solid #ef4444', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Sidebar Resizer (Vertical Bar) */}
      <div 
        onMouseDown={() => setIsResizingSidebar(true)}
        style={{ 
          width: '2px', 
          cursor: 'col-resize', 
          background: isResizingSidebar ? '#38bdf8' : '#30363d',
          transition: 'all 0.2s',
          zIndex: 10,
          flexShrink: 0,
          borderLeft: '2px solid transparent',
          borderRight: '2px solid transparent',
          backgroundClip: 'padding-box'
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#38bdf8'}
        onMouseLeave={(e) => { if(!isResizingSidebar) e.currentTarget.style.background = '#30363d' }}
      />

      {/* RIGHT SIDE: Main Workspace */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        
        {/* Top Toolbar */}
        <div style={{ height: '60px', borderBottom: '1px solid #30363d', background: '#161b22', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.9rem', fontWeight: 500, background: '#0d1117', padding: '6px 12px', borderRadius: '6px', border: '1px solid #30363d' }}>
              <Database size={14} />
              <select 
                value={conn.database} 
                onChange={(e) => setConn({...conn, database: e.target.value})}
                style={{ background: 'transparent', color: '#e2e8f0', border: 'none', outline: 'none', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                {databases.map(db => <option key={db} value={db}>{db}</option>)}
              </select>
            </div>
          </div>
          
          <button 
            onClick={handleExecute} 
            disabled={loading}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '8px', 
              padding: '8px 24px', background: loading ? '#374151' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
              color: loading ? '#9ca3af' : 'white', 
              border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer', 
              boxShadow: loading ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.3)',
              transition: 'all 0.2s ease',
            }}
          >
            {loading ? <Loader2 size={16} className="spinner" /> : <Play size={16} fill="currentColor" />}
            Execute
            <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '4px' }}>F5</span>
          </button>
        </div>

        {/* Editor Area */}
        <div 
          ref={editorRef}
          style={{ height: `${editorHeight}px`, borderBottom: '1px solid #30363d', position: 'relative', display: 'flex', flexDirection: 'column', flexShrink: 0, willChange: 'height' }}
        >
          <SqlEditor 
            query={query} 
            setQuery={setQuery} 
            onExecute={handleExecute} 
            databases={databases} 
            tables={tables} 
          />
        </div>

        {/* Editor Resizer */}
        <div 
          onMouseDown={() => setIsResizingEditor(true)}
          style={{ 
            height: '6px', 
            cursor: 'row-resize', 
            background: isResizingEditor ? '#38bdf8' : 'transparent',
            transition: 'background 0.2s',
            zIndex: 10,
            marginTop: '-6px',
            position: 'relative'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#38bdf8'}
          onMouseLeave={(e) => { if(!isResizingEditor) e.currentTarget.style.background = 'transparent' }}
        />

        {/* Results Data Grid */}
        <div style={{ flex: 1, background: '#0f111a', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', background: '#161b22', borderBottom: '1px solid #30363d' }}>
            <div style={{ padding: '10px 24px', background: '#0d1117', color: '#c9d1d9', fontSize: '0.8rem', fontWeight: 600, borderTop: '2px solid #38bdf8', borderRight: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Table2 size={14} /> Results
            </div>
            <div style={{ padding: '10px 24px', color: '#8b949e', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <AlertCircle size={14} /> Messages
            </div>
          </div>
          
          <div style={{ flex: 1, overflow: 'auto', padding: result && result.status === 'success' && result.rows ? '0' : '24px', position: 'relative' }}>
            
            {!result && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#484f58', gap: '16px' }}>
                <Code size={48} strokeWidth={1} />
                <div style={{ fontSize: '0.95rem' }}>Write a query and press Execute to see results.</div>
              </div>
            )}

            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#10b981', gap: '16px' }}>
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
                    <th style={{ padding: '8px 16px', fontWeight: 600, color: '#8b949e', borderRight: '1px solid #30363d', width: '50px', textAlign: 'center', background: '#0d1117' }}></th>
                    {result.columns.map((col, i) => (
                      <th key={i} style={{ padding: '8px 16px', fontWeight: 600, color: '#c9d1d9', borderRight: '1px solid #30363d' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, rIdx) => (
                    <tr key={rIdx} style={{ borderBottom: '1px solid #21262d', background: rIdx % 2 === 0 ? '#0d1117' : '#0f111a' }}>
                      <td style={{ padding: '6px 16px', color: '#484f58', borderRight: '1px solid #21262d', textAlign: 'center', fontFamily: "Consolas, monospace", background: '#0d1117' }}>{rIdx + 1}</td>
                      {result.columns.map((col, cIdx) => (
                        <td key={cIdx} style={{ padding: '6px 16px', color: '#e2e8f0', borderRight: '1px solid #21262d', fontFamily: "Consolas, monospace", whiteSpace: 'pre' }}>
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
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>Command Completed Successfully</div>
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
                  <CheckCircle2 size={12} strokeWidth={3} /> Query executed successfully.
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} /> {result.executionTimeMs} ms
                </span>
                {result.rows && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Table2 size={12} /> {result.rows.length} rows
                  </span>
                )}
              </>
            ) : result && result.status === 'error' ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 600 }}>
                <AlertCircle size={12} strokeWidth={3} /> Query completed with errors.
              </span>
            ) : (
              <span>Ready.</span>
            )}
            
            <div style={{ marginLeft: 'auto' }}>{conn.host} | {conn.database}</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DatabaseConsole;
