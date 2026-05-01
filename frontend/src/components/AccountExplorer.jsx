import React, { useState } from 'react';
import { Compass, Server, Database, Shield, Cpu, RefreshCw, Loader2 } from 'lucide-react';

const SERVICE_DEFS = [
  { id: 'EC2',    label: 'EC2 Instances',    icon: <Server size={36} />,   color: '#FF9900' },
  { id: 'S3',     label: 'S3 Buckets',       icon: <Database size={36} />, color: '#3F8EFC' },
  { id: 'RDS',    label: 'RDS Databases',    icon: <Database size={36} />, color: '#7B61FF' },
  { id: 'Lambda', label: 'Lambda Functions', icon: <Cpu size={36} />,      color: '#00C7B7' },
  { id: 'IAM',    label: 'IAM Users',        icon: <Shield size={36} />,   color: '#FF5F56' },
];

const AccountExplorer = ({ region, explorationData, loadingExploration, onRefresh, onInstanceAction, onDeleteBucket }) => {
  const [activeService, setActiveService] = useState(null);
  const [performingAction, setPerformingAction] = useState(null); // stores item ID being acted upon

  const handleAction = async (type, item, action) => {
    const id = item.id || item.name;
    setPerformingAction(id);
    if (type === 'EC2') await onInstanceAction(item.id, action);
    if (type === 'S3') await onDeleteBucket(item.name);
    setPerformingAction(null);
  };

  if (loadingExploration) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 20px auto', color: 'var(--accent-color)' }} />
        <p style={{ fontSize: '1.1rem' }}>Scanning AWS Account for Resources...</p>
      </div>
    );
  }

  return (
    <div className="config-panel animate-fade">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {activeService ? (
            <button
              onClick={() => setActiveService(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.9rem', padding: 0 }}
            >
              ← Services
            </button>
          ) : (
            <>
              <Compass size={24} color="var(--accent-color)" />
              <h2 style={{ margin: 0 }}>Account Explorer <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({region})</span></h2>
            </>
          )}
        </div>
        <button className="btn" onClick={onRefresh} style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Error banner */}
      {explorationData?.error && (
        <div style={{ color: 'var(--error)', padding: '14px 16px', background: 'rgba(255,59,48,0.1)', borderRadius: '10px', marginBottom: '24px', fontSize: '0.9rem' }}>
          {explorationData.error}
        </div>
      )}

      {/* Service Cards Grid */}
      {!activeService ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '20px' }}>
          {SERVICE_DEFS.map(svc => {
            const items = explorationData ? (explorationData[svc.id] || []) : [];
            const count = Array.isArray(items) ? items.length : 0;
            return (
              <div
                key={svc.id}
                onClick={() => explorationData && setActiveService(svc.id)}
                style={{
                  background: 'var(--panel-bg)',
                  borderRadius: '18px',
                  border: `1px solid var(--panel-border)`,
                  padding: '28px 20px',
                  cursor: explorationData ? 'pointer' : 'default',
                  transition: 'all 0.25s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '14px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  textAlign: 'center',
                }}
                onMouseOver={e => { if (explorationData) e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.borderColor = svc.color; }}
                onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--panel-border)'; }}
              >
                <div style={{ color: svc.color, padding: '14px', background: `${svc.color}18`, borderRadius: '16px' }}>
                  {svc.icon}
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700 }}>{svc.id}</h3>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{svc.label}</p>
                </div>
                <div style={{
                  background: explorationData && count > 0 ? `${svc.color}22` : 'rgba(0,0,0,0.06)',
                  color: explorationData && count > 0 ? svc.color : 'var(--text-secondary)',
                  padding: '5px 14px',
                  borderRadius: '20px',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  minWidth: '70px',
                }}>
                  {explorationData ? `${count} found` : '—'}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detail view */
        <div className="animate-fade">
          {(() => {
            const svc = SERVICE_DEFS.find(s => s.id === activeService);
            const items = explorationData?.[activeService] || [];
            return (
              <div style={{ background: 'var(--panel-bg)', borderRadius: '14px', border: '1px solid var(--panel-border)', overflow: 'hidden' }}>
                {/* Panel header */}
                <div style={{ background: 'rgba(0,0,0,0.18)', padding: '16px 20px', borderBottom: '1px solid var(--panel-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ color: svc.color }}>{svc.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{svc.label}</span>
                  </div>
                  <span style={{ background: svc.color, color: '#fff', padding: '4px 14px', borderRadius: '14px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {items.length} Total
                  </span>
                </div>

                <div style={{ padding: '20px' }}>
                  {items.length === 0 ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Compass size={48} style={{ opacity: 0.15, display: 'block', margin: '0 auto 16px auto' }} />
                      <p style={{ fontSize: '1rem', margin: 0 }}>No {activeService} resources found in {region}.</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                      {items.map((item, idx) => {
                        const itemId = item.id || item.name;
                        const isActing = performingAction === itemId;
                        return (
                          <div key={idx} style={{ background: 'rgba(0,0,0,0.1)', padding: '16px', borderRadius: '12px', fontSize: '0.85rem', border: `1px solid ${svc.color}22`, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ flexGrow: 1, marginBottom: '16px' }}>
                              {Object.entries(item).map(([k, v]) => (
                                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                  <span style={{ color: 'var(--text-secondary)', textTransform: 'capitalize', fontWeight: 500 }}>{k}</span>
                                  <span style={{ fontWeight: 700, maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right', color: svc.color }} title={String(v)}>
                                    {String(v)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Resource Actions */}
                            {['EC2', 'S3'].includes(activeService) && (
                              <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
                                {activeService === 'EC2' && (
                                  <>
                                    <button 
                                      className="btn" 
                                      disabled={isActing || item.state === 'running'} 
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', flexGrow: 1 }}
                                      onClick={() => handleAction('EC2', item, 'start')}
                                    >
                                      {isActing ? '...' : 'Start'}
                                    </button>
                                    <button 
                                      className="btn" 
                                      disabled={isActing || item.state === 'stopped'} 
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', flexGrow: 1 }}
                                      onClick={() => handleAction('EC2', item, 'stop')}
                                    >
                                      {isActing ? '...' : 'Stop'}
                                    </button>
                                    <button 
                                      className="btn" 
                                      disabled={isActing} 
                                      style={{ padding: '6px 12px', fontSize: '0.75rem', flexGrow: 1, color: '#FF5F56', borderColor: 'rgba(255,95,86,0.3)' }}
                                      onClick={() => { if(window.confirm('Terminate this instance?')) handleAction('EC2', item, 'terminate') }}
                                    >
                                      Terminate
                                    </button>
                                  </>
                                )}
                                {activeService === 'S3' && (
                                  <button 
                                    className="btn" 
                                    disabled={isActing} 
                                    style={{ padding: '6px 12px', fontSize: '0.75rem', flexGrow: 1, color: '#FF5F56', borderColor: 'rgba(255,95,86,0.3)' }}
                                    onClick={() => { if(window.confirm('Delete this bucket?')) handleAction('S3', item, 'delete') }}
                                  >
                                    {isActing ? 'Deleting...' : 'Delete Bucket'}
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default AccountExplorer;
