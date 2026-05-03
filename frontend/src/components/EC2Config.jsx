import React from 'react';
import { Server, Cpu, Database, Terminal, Globe, Zap, Plus } from 'lucide-react';

const SOFTWARE = [
  { id: 'Nodejs',    icon: <Cpu size={13} />,      desc: 'Node.js 20 LTS' },
  { id: 'Java',      icon: <Database size={13} />,  desc: 'OpenJDK (JDK)' },
  { id: 'Python',    icon: <Terminal size={13} />,  desc: 'Python 3 + Pip' },
  { id: 'Laravel',   icon: <Globe size={13} />,     desc: 'PHP + Composer' },
  { id: 'Redis',     icon: <Database size={13} />,  desc: 'In-memory Cache' },
  { id: 'Nginx',     icon: <Globe size={13} />,     desc: 'Web Server' },
  { id: 'Kafka',     icon: <Cpu size={13} />,       desc: 'Event Streaming' },
  { id: 'Utilities', icon: <Server size={13} />,    desc: 'git, curl, build tools' },
];

const EC2Config = ({ formData, handleChange, toggleSoftware, availableAmis, availableInstanceTypes, availableKeyPairs }) => (
  <>
    <div className="field-group">
      <label className="field-label">Instance Name</label>
      <input name="instanceName" value={formData.instanceName} onChange={handleChange} placeholder="e.g. prod-web-01" />
    </div>

    <div className="field-group">
      <label className="field-label">Machine Image (AMI)</label>
      <select name="amiId" value={availableAmis.find(a => a.id === formData.amiId) ? formData.amiId : 'custom'} onChange={handleChange}>
        {availableAmis.map(ami => <option key={ami.id} value={ami.id}>{ami.name}</option>)}
        <option value="custom">-- Custom AMI ID --</option>
      </select>
    </div>

    <div className="field-group">
      <label className="field-label">Instance Type</label>
      <select name="instanceType" value={formData.instanceType} onChange={handleChange}>
        {availableInstanceTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>

    <div className="field-group">
      <label className="field-label">Open Ports</label>
      <input name="securityGroupPorts" value={formData.securityGroupPorts} onChange={handleChange} placeholder="e.g. 22, 80, 443" />
    </div>

    <div className="field-group">
      <label className="field-label">EBS Volume (GB)</label>
      <input type="number" name="ebsVolumeSize" value={formData.ebsVolumeSize} onChange={handleChange} />
    </div>

    <div className="field-group">
      <label className="field-label">Key Pair Mode</label>
      <select name="keyPairSelection" value={formData.keyPairSelection} onChange={handleChange}>
        <option value="existing">Use Existing Key</option>
        <option value="magic-new-key">Generate New Key</option>
      </select>
    </div>

    <div className="field-group">
      <label className="field-label">{formData.keyPairSelection === 'magic-new-key' ? 'New Key Name' : 'Select Key'}</label>
      {formData.keyPairSelection === 'magic-new-key'
        ? <input name="keyPairName" value={formData.keyPairName} onChange={handleChange} />
        : <select name="keyPairName" value={formData.keyPairName} onChange={handleChange}>
            {availableKeyPairs.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
      }
    </div>

    {/* Software Add-ons Redesign */}
    <div className="field-group" style={{ gridColumn: '1 / -1' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <label className="field-label" style={{ margin: 0 }}>Software Stack</label>
        {formData.selectedSoftware.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {formData.selectedSoftware.map(s => (
              <span key={s} style={{ fontSize: '0.65rem', fontWeight: 800, background: 'var(--accent-glow)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={() => {
          const el = document.getElementById('software-gallery');
          if (el) el.style.display = el.style.display === 'none' ? 'grid' : 'none';
        }}
        style={{
          width: '100%',
          padding: '14px',
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-1)',
          fontWeight: 700,
          fontSize: '0.9rem',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          transition: 'all 0.2s'
        }}
        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
      >
        <Plus size={16} /> {formData.selectedSoftware.length > 0 ? 'Modify Software Stack' : 'Configure Software Add-ons'}
      </button>

      <div 
        id="software-gallery" 
        style={{ 
          display: 'none', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '12px', 
          marginTop: '16px',
          padding: '16px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)',
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        {SOFTWARE.map(sw => {
          const isSelected = formData.selectedSoftware.includes(sw.id);
          return (
            <div
              key={sw.id}
              onClick={() => toggleSoftware(sw.id)}
              style={{
                padding: '16px',
                background: isSelected ? 'var(--accent-glow)' : 'var(--surface-3)',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseOver={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
              onMouseOut={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'; }}
            >
              {isSelected && (
                <div style={{ position: 'absolute', top: '8px', right: '8px', color: 'var(--accent)' }}>
                  <div style={{ background: 'var(--accent)', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Plus size={12} style={{ transform: 'rotate(45deg)' }} />
                  </div>
                </div>
              )}
              <div style={{ color: isSelected ? 'var(--accent)' : 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {sw.icon}
                <span style={{ fontWeight: 800, fontSize: '0.85rem' }}>{sw.id}</span>
              </div>
              <p style={{ fontSize: '0.7rem', color: isSelected ? 'var(--text-1)' : 'var(--text-2)', margin: 0, opacity: 0.8 }}>{sw.desc}</p>
            </div>
          );
        })}
      </div>
    </div>

    {/* Scaling & Availability Section */}
    <div style={{ gridColumn: '1 / -1', marginTop: '12px', padding: '20px', background: 'rgba(99, 102, 241, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(99, 102, 241, 0.1)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Zap size={20} color="var(--accent)" />
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, margin: 0, letterSpacing: '-0.3px' }}>Availability & Scaling</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* Load Balancer Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>
            <input type="checkbox" name="loadBalancerEnabled" checked={formData.loadBalancerEnabled} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
            Enable Load Balancer (ALB)
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginLeft: '28px' }}>Distribute traffic across instances. Highly recommended for production.</p>
        </div>

        {/* Auto Scaling Toggle */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>
            <input type="checkbox" name="autoScalingEnabled" checked={formData.autoScalingEnabled} onChange={handleChange} style={{ width: '18px', height: '18px' }} />
            Enable Auto Scaling (ASG)
          </label>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', marginLeft: '28px' }}>Automatically adjust capacity based on demand. Ensures high availability.</p>
        </div>
      </div>

      {(formData.loadBalancerEnabled || formData.autoScalingEnabled) && (
        <div className="animate-fade" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="field-group">
            <label className="field-label">Target Port</label>
            <input type="number" name="targetPort" value={formData.targetPort} onChange={handleChange} placeholder="80" />
          </div>
          
          {formData.autoScalingEnabled && (
            <>
              <div className="field-group">
                <label className="field-label">Min Size</label>
                <input type="number" name="minSize" value={formData.minSize} onChange={handleChange} min="1" />
              </div>
              <div className="field-group">
                <label className="field-label">Max Size</label>
                <input type="number" name="maxSize" value={formData.maxSize} onChange={handleChange} min="1" />
              </div>
              <div className="field-group">
                <label className="field-label">Desired</label>
                <input type="number" name="desiredCapacity" value={formData.desiredCapacity} onChange={handleChange} min="1" />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  </>
);

export default EC2Config;
