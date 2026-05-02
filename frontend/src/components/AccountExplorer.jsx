import React, { useState } from 'react';
import { Compass, Server, Database, Shield, Cpu, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import ConfirmModal from './ConfirmModal';

const SERVICE_DEFS = [
  { id: 'EC2', label: 'EC2 Instances', icon: <Server size={36} />, color: '#FF9900' },
  { id: 'S3', label: 'S3 Buckets', icon: <Database size={36} />, color: '#3F8EFC' },
  { id: 'RDS', label: 'RDS Databases', icon: <Database size={36} />, color: '#7B61FF' },
  { id: 'Lambda', label: 'Lambda Functions', icon: <Cpu size={36} />, color: '#00C7B7' },
  { id: 'IAM', label: 'IAM Users', icon: <Shield size={36} />, color: '#FF5F56' },
];

const AccountExplorer = ({ region, explorationData, loadingExploration, onRefresh, onInstanceAction, onDeleteBucket, onDeleteResource }) => {
  const [activeService, setActiveService] = useState(null);
  const [expandedItems, setExpandedItems] = useState({});
  const [performingAction, setPerformingAction] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, service: '', item: null, action: '' });

  const toggleExpand = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleAction = (service, item, action) => {
    if (action === 'terminate' || action === 'delete') {
      setConfirmModal({ show: true, service, item, action });
      return;
    }
    executeAction(service, item, action);
  };

  const executeAction = async (service, item, action) => {
    setPerformingAction(item.id || item.name);
    try {
      if (service === 'EC2') await onInstanceAction(item.id, action);
      else if (service === 'S3') await onDeleteBucket(item.name);
      else await onDeleteResource(service, item.id || item.name);
      onRefresh();
    } catch (err) {
      console.error("Action failed", err);
    } finally {
      setPerformingAction(null);
      setConfirmModal({ show: false, item: null, action: '', service: '' });
    }
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
      {/* Header logic ... */}
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

      {/* Error banner ... */}
      {explorationData?.error && (
        <div style={{ color: 'var(--error)', padding: '14px 16px', background: 'rgba(255,59,48,0.1)', borderRadius: '10px', marginBottom: '24px', fontSize: '0.9rem' }}>
          {explorationData.error}
        </div>
      )}

      {/* Service Cards Grid ... */}
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
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                        {items.map((item, idx) => {
                          const itemId = item.id || item.name;
                          const isActing = performingAction === itemId;
                          const isExpanded = expandedItems[itemId];
                          const isRunning = item.state === 'running';

                          return (
                            <div
                              key={idx}
                              style={{
                                background: 'var(--surface)',
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'var(--transition)',
                                boxShadow: 'var(--shadow)',
                                overflow: 'hidden',
                                cursor: 'default'
                              }}
                              onMouseOver={e => {
                                e.currentTarget.style.transform = 'translateY(-6px)';
                                e.currentTarget.style.borderColor = svc.color;
                                e.currentTarget.style.boxShadow = `0 12px 30px -10px ${svc.color}44`;
                              }}
                              onMouseOut={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'var(--border)';
                                e.currentTarget.style.boxShadow = 'var(--shadow)';
                              }}
                            >
                              {/* Card Header */}
                              <div style={{ padding: '20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                                    {item.name || 'Resource'}
                                  </h4>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--text-2)', fontFamily: 'var(--font-mono)' }}>
                                    {item.id}
                                  </span>
                                </div>
                                <div style={{
                                  padding: '4px 12px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: isRunning ? 'var(--success)22' : 'var(--error)22',
                                  color: isRunning ? 'var(--success)' : 'var(--error)',
                                  fontSize: '0.65rem',
                                  fontWeight: 900,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px',
                                  border: `1px solid ${isRunning ? 'var(--success)' : 'var(--error)'}33`
                                }}>
                                  {item.state || item.status || 'ACTIVE'}
                                </div>
                              </div>

                              {/* Card Body (Specs Grid) */}
                              <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 700 }}>Type</span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{item.type || 'Standard'}</span>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-2)', textTransform: 'uppercase', fontWeight: 700 }}>Public IP</span>
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>{item.publicIp || '—'}</span>
                                </div>
                              </div>

                              {/* Expansion Content */}
                              {isExpanded && (
                                <div style={{ padding: '0 20px 20px 20px', animation: 'fadeIn 0.2s ease' }}>
                                  <div style={{ background: 'var(--surface-2)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                                    {Object.entries(item).map(([k, v]) => {
                                      if (['id', 'name', 'state', 'status', 'type', 'publicIp'].includes(k)) return null;
                                      return (
                                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '0.75rem' }}>
                                          <span style={{ color: 'var(--text-2)', textTransform: 'capitalize' }}>{k.replace(/([A-Z])/g, ' $1')}</span>
                                          <span style={{ color: 'var(--text)', fontWeight: 500, maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(v)}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Card Footer (Actions) */}
                              <div style={{ padding: '16px 20px', background: 'var(--surface-2)', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                  <button
                                    onClick={() => toggleExpand(itemId)}
                                    style={{ background: 'transparent', border: 'none', color: svc.color, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, padding: 0 }}
                                    title="Toggle detailed technical specifications"
                                  >
                                    {isExpanded ? 'Hide Specs' : 'Show Specs'}
                                  </button>

                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    {activeService === 'EC2' && (
                                      <>
                                        <button
                                          className="btn-console"
                                          disabled={isActing || isRunning}
                                          onClick={() => handleAction('EC2', item, 'start')}
                                          title={isRunning ? "Instance is already running" : "Start Instance"}
                                          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isRunning ? 'var(--border)' : 'var(--success)', color: isRunning ? 'var(--text-2)' : '#fff', borderRadius: 'var(--radius-sm)', border: 'none', cursor: isRunning ? 'default' : 'pointer' }}
                                        >
                                          {isActing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                                        </button>
                                        <button
                                          className="btn-console"
                                          disabled={isActing || !isRunning}
                                          onClick={() => handleAction('EC2', item, 'stop')}
                                          title={!isRunning ? "Instance is already stopped" : "Stop Instance"}
                                          style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: !isRunning ? 'var(--border)' : 'var(--warning)', color: !isRunning ? 'var(--text-2)' : '#fff', borderRadius: 'var(--radius-sm)', border: 'none', cursor: !isRunning ? 'default' : 'pointer' }}
                                        >
                                          <Shield size={14} />
                                        </button>
                                      </>
                                    )}
                                    <button 
                                      className="btn-console"
                                      disabled={isActing}
                                      onClick={() => handleAction(activeService, item, activeService === 'EC2' ? 'terminate' : 'delete')}
                                      title={activeService === 'EC2' ? "Terminate Instance" : "Delete Resource"}
                                      style={{ width: '34px', height: '34px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--error)22', color: 'var(--error)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--error)44', cursor: 'pointer', transition: 'all 0.2s' }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
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
      {/* Reusable Confirmation Modal */}
      <ConfirmModal 
        isOpen={confirmModal.show}
        onClose={() => setConfirmModal({ show: false, item: null, action: '', service: '' })}
        onConfirm={() => executeAction(confirmModal.service, confirmModal.item, confirmModal.action)}
        title={confirmModal.action === 'terminate' ? "Terminate Instance?" : "Delete Bucket?"}
        message={
          <>You are about to permanently {confirmModal.action} <strong>{confirmModal.item?.name || confirmModal.item?.id}</strong>. This action cannot be undone.</>
        }
        confirmText={confirmModal.action === 'terminate' ? "Terminate" : "Delete"}
        type="danger"
      />
    </div>
  );
};

export default AccountExplorer;
