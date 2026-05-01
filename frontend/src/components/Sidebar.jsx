import React from 'react';
import {
  Box, Cpu, Compass, Cloud, Sun, Moon,
  Trash2, ChevronRight, Layers, Terminal,
  Database, Server
} from 'lucide-react';

const TOP_NAV = [
  { id: 'INFRASTRUCTURE', label: 'Infrastructure', icon: <Layers size={16} /> },
  { id: 'Software', label: 'Software Manager', icon: <Cpu size={16} /> },
  { id: 'EXPLORE', label: 'Explore Account', icon: <Compass size={16} /> },
];

const Sidebar = ({
  isDarkMode, setIsDarkMode,
  activeService, setActiveService,
  cloudProvider, setCloudProvider, setIsConnected,
  resourceStack, removeFromStack,
  onPreviewResource, setShowPreview,
}) => (
  <div className="sidebar">
    {/* Logo + theme */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div className="logo"><Box size={22} /><span>CloudMagic</span></div>
      <button className="theme-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>

    {/* Navigation */}
    <div style={{ flexGrow: 1 }}>
      <div className="nav-section-label">Navigation</div>
      <nav className="service-nav" style={{ marginTop: '6px' }}>
        {TOP_NAV.map(item => (
          <div
            key={item.id}
            className={`nav-item ${activeService === item.id ? 'active' : ''}`}
            onClick={() => {
              setActiveService(item.id);
              setShowPreview(false); // Close preview when switching main tabs
            }}
          >
            {item.icon}
            <span style={{ flexGrow: 1 }}>{item.label}</span>
            {activeService === item.id && <ChevronRight size={14} />}
          </div>
        ))}
      </nav>
    </div>

    {/* Resource stack summary */}
    {resourceStack.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="nav-section-label" style={{ padding: 0 }}>Stack</span>
          <span style={{ fontSize: '0.7rem', background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>
            {resourceStack.length}
          </span>
        </div>
        {resourceStack.map((res, idx) => {
          const type = (res.serviceType || "").toUpperCase();
          const getIcon = () => {
            // Priority 1: Service Type
            if (type === 'S3' || res.bucketName) return <Database size={13} />;
            if (type === 'EC2' || res.instanceName) return <Server size={13} />;
            if (type === 'PIPELINE' || res.pipelineName) return <Terminal size={13} />;
            if (type === 'ELASTIC_BEANSTALK' || res.appName) return <Cpu size={13} />;
            return <Terminal size={13} />;
          };

          return (
            <div key={res.id || `fallback-${idx}`} className="stack-item" style={{ cursor: 'pointer' }} onClick={() => onPreviewResource(res)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexGrow: 1, overflow: 'hidden' }}>
                <span style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', opacity: 0.8 }}>
                  {getIcon()}
                </span>
                <span style={{ fontSize: '0.8rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                  {res.bucketName || res.instanceName || res.pipelineName || res.appName || res.serviceType || 'Resource'}
                </span>
              </div>
              <Trash2
                size={13}
                onClick={(e) => { e.stopPropagation(); removeFromStack(res.id); }}
                style={{ cursor: 'pointer', color: 'var(--error)', flexShrink: 0, marginLeft: '6px', opacity: 0.6 }}
              />
            </div>
          );
        })}
      </div>
    )}

    {/* Session chip */}
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
      <Cloud size={15} color="var(--accent)" />
      <span style={{ fontWeight: 600, fontSize: '0.82rem', flexGrow: 1 }}>{cloudProvider}</span>
      <button
        onClick={() => { setCloudProvider(null); setIsConnected(false); }}
        style={{ background: 'none', border: 'none', color: 'var(--error)', fontSize: '0.65rem', fontWeight: 800, cursor: 'pointer', letterSpacing: '0.5px' }}
      >
        LOGOUT
      </button>
    </div>
  </div>
);

export default Sidebar;
