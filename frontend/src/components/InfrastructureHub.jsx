import React from 'react';
import {
  Server, Database, GitBranch, Globe, Plus, Play,
  Loader2, Trash2, ArrowLeft, ChevronRight, Layers,
  HardDrive, Zap
} from 'lucide-react';

import EC2Config from './EC2Config';
import S3Config from './S3Config';
import PipelineConfig from './PipelineConfig';
import BeanstalkConfig from './BeanstalkConfig';

/* ─── Service catalogue ──────────────────────────────────────────────────── */
const SERVICES = [
  {
    id: 'EC2',
    label: 'EC2 Instance',
    desc: 'Launch a virtual server in the cloud with full control over OS, storage, and networking.',
    icon: <Server size={28} />,
    color: '#FF9900',
    bg: 'rgba(255,153,0,0.12)',
    badge: 'Compute',
  },
  {
    id: 'S3',
    label: 'S3 Bucket',
    desc: 'Create scalable object storage for files, backups, static sites, and data lakes.',
    icon: <Database size={28} />,
    color: '#3F8EFC',
    bg: 'rgba(63,142,252,0.12)',
    badge: 'Storage',
  },
  {
    id: 'PIPELINE',
    label: 'CI/CD Pipeline',
    desc: 'Automate build, test, and deploy workflows triggered by GitHub pushes.',
    icon: <GitBranch size={28} />,
    color: '#30D158',
    bg: 'rgba(48,209,88,0.12)',
    badge: 'DevOps',
  },
  {
    id: 'ELASTIC_BEANSTALK',
    label: 'Elastic Beanstalk',
    desc: 'Deploy web applications without managing servers — PaaS with full visibility.',
    icon: <Globe size={28} />,
    color: '#BF5AF2',
    bg: 'rgba(191,90,242,0.12)',
    badge: 'PaaS',
  },
];

const SERVICE_ICON = { EC2: <Server size={16} />, S3: <Database size={16} />, PIPELINE: <GitBranch size={16} />, ELASTIC_BEANSTALK: <Globe size={16} /> };
const SERVICE_LABEL = { EC2: 'EC2', S3: 'S3', PIPELINE: 'CI/CD', ELASTIC_BEANSTALK: 'Beanstalk' };

/* ─── Component ──────────────────────────────────────────────────────────── */
const InfrastructureHub = ({
  formData, handleChange, toggleSoftware,
  availableAmis, availableInstanceTypes, availableKeyPairs,
  runningInstances, region,
  resourceStack, addToStack, removeFromStack,
  deploying, handleDeploy, handleDestroy,
  cloudProvider,
  output, isLogMax, setIsLogMax, setOutput,
  selectedService, setSelectedService,
  editStackItem,
  permissions = { EC2: true, S3: true, PIPELINE: true, ELASTIC_BEANSTALK: true },
}) => {
  const svc = SERVICES.find(s => s.id === selectedService);

  const renderConfig = () => {
    const p = { formData, handleChange };
    if (selectedService === 'EC2') return <EC2Config {...p} toggleSoftware={toggleSoftware} availableAmis={availableAmis} availableInstanceTypes={availableInstanceTypes} availableKeyPairs={availableKeyPairs} />;
    if (selectedService === 'S3') return <S3Config {...p} />;
    if (selectedService === 'PIPELINE') return <PipelineConfig {...p} runningInstances={runningInstances} region={region} />;
    if (selectedService === 'ELASTIC_BEANSTALK') return <BeanstalkConfig {...p} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Breadcrumb header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers size={20} color="var(--accent)" />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Infrastructure</h2>
        {selectedService && (
          <>
            <ChevronRight size={16} color="var(--text-2)" />
            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1rem' }}>{svc?.label}</span>
          </>
        )}
      </div>

      {/* ── Service selection grid ── */}
      {!selectedService ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>
            Choose a service type to configure and add to your deployment stack.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {SERVICES.filter(s => permissions && permissions[s.id] !== false).map(sv => (
              <div
                key={sv.id}
                onClick={() => setSelectedService(sv.id)}
                style={{
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '24px 20px',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = sv.color;
                  e.currentTarget.style.transform = 'translateY(-3px)';
                  e.currentTarget.style.boxShadow = `0 12px 32px ${sv.bg}`;
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {/* Badge */}
                <span style={{
                  position: 'absolute', top: '14px', right: '14px',
                  fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.8px',
                  textTransform: 'uppercase', color: sv.color,
                  background: sv.bg, padding: '3px 8px', borderRadius: '20px',
                }}>
                  {sv.badge}
                </span>

                {/* Icon */}
                <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: sv.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sv.color }}>
                  {sv.icon}
                </div>

                {/* Text */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px' }}>{sv.label}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{sv.desc}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: sv.color, fontSize: '0.8rem', fontWeight: 700, marginTop: 'auto' }}>
                  Configure <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>

          {/* Stack summary (if not empty) */}
          {resourceStack.length > 0 && (
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <HardDrive size={16} color="var(--accent)" />
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Deployment Stack</span>
                <span style={{ marginLeft: 'auto', background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: '0.72rem', fontWeight: 800, padding: '2px 8px', borderRadius: '20px' }}>
                  {resourceStack.length} resource{resourceStack.length > 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {resourceStack.map(res => (
                  <div key={res.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--accent)' }}>{SERVICE_ICON[res.serviceType]}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {SERVICE_LABEL[res.serviceType]}: {res.instanceName || res.bucketName || res.pipelineName || res.appName}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        ID: {res.id ? res.id.toString().slice(-6) : 'NEW'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => editStackItem(res)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px' }}
                        title="Edit Resource"
                      >
                        <Plus size={14} style={{ transform: 'rotate(45deg)' }} />
                      </button>
                      <Trash2
                        size={14}
                        onClick={() => removeFromStack(res.id)}
                        style={{ cursor: 'pointer', color: 'var(--error)', padding: '4px' }}
                        title="Remove from Stack (Will destroy on next deploy)"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn btn-deploy"
                  onClick={handleDeploy}
                  disabled={deploying}
                  style={{ flexGrow: 1 }}
                >
                  {deploying
                    ? <><Loader2 size={17} className="animate-spin" /> Working...</>
                    : <><Zap size={17} /> Sync {resourceStack.length} Resource{resourceStack.length > 1 ? 's' : ''}</>
                  }
                </button>
                <button
                  className="btn"
                  onClick={handleDestroy}
                  disabled={deploying}
                  style={{ borderColor: 'var(--error)', color: 'var(--error)', width: 'fit-content' }}
                  title="Destroy ALL resources in this org"
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '12px', textAlign: 'center', fontStyle: 'italic' }}>
                Removing a resource from the stack and clicking "Sync" will destroy it in AWS.
              </p>
            </div>
          )}
        </div>

      ) : (
        /* ── Config form for selected service ── */
        <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Back button */}
          <button
            onClick={() => setSelectedService(null)}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', padding: 0, width: 'fit-content' }}
          >
            <ArrowLeft size={15} /> Back to Services
          </button>

          {/* Service banner */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px', background: svc.bg, border: `1px solid ${svc.color}44`, borderRadius: 'var(--radius-xl)' }}>
            <div style={{ color: svc.color }}>{svc.icon}</div>
            <div>
              <h3 style={{ fontWeight: 800, fontSize: '1.05rem', color: svc.color }}>{svc.label}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '2px' }}>{svc.desc}</p>
            </div>
          </div>

          {/* Form */}
          <div className="config-panel">
            <div className="form-grid">{renderConfig()}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                className="btn btn-primary"
                onClick={() => { addToStack(selectedService); setSelectedService(null); }}
                style={{ width: 'fit-content' }}
              >
                <Plus size={16} /> {formData.id ? 'Update Item' : 'Add to Stack'}
              </button>
              <button className="btn" onClick={() => {
                setSelectedService(null);
                setFormData(p => { const { id, ...rest } = p; return rest; });
              }} style={{ width: 'fit-content' }}>
                Cancel
              </button>
            </div>
          </div>

          {/* Deploy section */}
          {resourceStack.length > 0 && (
            <button className="btn btn-deploy" onClick={handleDeploy} disabled={deploying}>
              {deploying
                ? <><Loader2 size={17} className="animate-spin" /> Deploying...</>
                : <><Zap size={17} /> Deploy Stack to {cloudProvider}</>
              }
            </button>
          )}
        </div>
      )}

      {/* ── Log output ── */}
      {output && (
        <div className={`log-container animate-fade ${isLogMax ? 'maximized' : ''}`}>
          <div className="terminal-header">
            <div className="terminal-dots">
              <span style={{ background: '#FF5F56' }} />
              <span style={{ background: '#FFBD2E' }} />
              <span style={{ background: '#27C93F' }} />
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.5, marginLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Provisioning Log
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button onClick={() => setOutput('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '0.7rem' }}>Clear</button>
              <button onClick={() => setIsLogMax(!isLogMax)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', padding: '3px 10px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}>
                {isLogMax ? 'RESTORE' : 'EXPAND'}
              </button>
            </div>
          </div>
          <div className="log-card" ref={el => { if (el) el.scrollTop = el.scrollHeight; }}>
            {output}
          </div>
        </div>
      )}
    </div>
  );
};

export default InfrastructureHub;
