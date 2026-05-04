import React from 'react';
import { 
  GitBranch, 
  Server, 
  Settings, 
  Zap, 
  Globe, 
  Layers,
  Cpu
} from 'lucide-react';

const PipelineConfig = ({ formData, handleChange, runningInstances, region }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
      
      {/* ── Section 1: Source (GitHub) ────────────────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <div style={iconContainer('#3F8EFC')}>
            <GitBranch size={20} />
          </div>
          <div>
            <h3 style={titleStyle}>Source Control</h3>
            <p style={subTitleStyle}>Connect your repository and specify the branch</p>
          </div>
        </div>

        <div style={formGrid}>
          <div className="field-group">
            <label style={labelStyle}>Pipeline Name</label>
            <div style={inputWrapper}>
              <Settings size={16} style={inputIcon} />
              <input 
                name="pipelineName" 
                value={formData.pipelineName || ''} 
                onChange={handleChange} 
                placeholder="my-awesome-pipeline" 
                style={modernInput}
              />
            </div>
          </div>

          <div className="field-group">
            <label style={labelStyle}>GitHub Repository ID</label>
            <div style={inputWrapper}>
              <Globe size={16} style={inputIcon} />
              <input 
                name="repoUrl" 
                value={formData.repoUrl || ''} 
                onChange={handleChange} 
                placeholder="username/repository" 
                style={modernInput}
              />
            </div>
          </div>
        </div>

        <div style={{...formGrid, marginTop: '20px'}}>
          <div className="field-group">
            <label style={labelStyle}>Branch Name</label>
            <div style={inputWrapper}>
              <Layers size={16} style={inputIcon} />
              <input 
                name="branch" 
                value={formData.branch || 'main'} 
                onChange={handleChange} 
                placeholder="main" 
                style={modernInput}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Deployment Target (EC2 Only) ────────────────────────────── */}
      <div style={sectionStyle}>
        <div style={headerStyle}>
          <div style={iconContainer('#FF9900')}>
            <Server size={20} />
          </div>
          <div>
            <h3 style={titleStyle}>EC2 Target Instance</h3>
            <p style={subTitleStyle}>Select the server for automated deployment</p>
          </div>
        </div>

        <div className="field-group">
          <label style={labelStyle}>Select Target Instance</label>
          <div style={inputWrapper}>
            <Cpu size={16} style={inputIcon} />
            <select name="targetInstanceId" value={formData.targetInstanceId || ''} onChange={handleChange} style={modernSelect}>
              <option value="">-- Select Running EC2 --</option>
              {runningInstances.map(instance => (
                <option key={instance.id} value={instance.name}>{instance.name} ({instance.ip})</option>
              ))}
            </select>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-2)', marginTop: '8px', fontStyle: 'italic' }}>
            The pipeline will automatically deploy to this instance in <strong>{region}</strong>.
          </p>
        </div>
      </div>

      <div style={footerGlow}>
        <Zap size={16} />
        <span>Pipeline-as-Code: Define your build and port mapping directly in your 'buildspec.yml'.</span>
      </div>
    </div>
  );
};

/* ── Styles ──────────────────────────────────────────────────────────────── */

const sectionStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid var(--border)',
  borderRadius: '24px',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
};

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '16px',
};

const iconContainer = (color) => ({
  width: '42px',
  height: '42px',
  borderRadius: '12px',
  background: `${color}15`,
  color: color,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${color}30`,
});

const titleStyle = {
  fontSize: '1.05rem',
  fontWeight: 800,
  margin: 0,
  letterSpacing: '-0.3px',
};

const subTitleStyle = {
  fontSize: '0.8rem',
  color: 'var(--text-2)',
  margin: '2px 0 0 0',
};

const formGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '20px',
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 700,
  color: 'var(--text-2)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: '8px',
  display: 'block',
};

const inputWrapper = {
  position: 'relative',
  display: 'flex',
  alignItems: 'center',
};

const inputIcon = {
  position: 'absolute',
  left: '14px',
  color: 'var(--text-2)',
  pointerEvents: 'none',
};

const modernInput = {
  width: '100%',
  background: 'rgba(0,0,0,0.2)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '12px 12px 12px 42px',
  fontSize: '0.9rem',
  color: 'white',
  outline: 'none',
  transition: 'border 0.2s',
};

const modernSelect = {
  ...modernInput,
  appearance: 'none',
  cursor: 'pointer',
};

const footerGlow = {
  padding: '16px',
  borderRadius: '16px',
  background: 'var(--accent-glow)',
  border: '1px solid var(--accent-30)',
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  fontSize: '0.85rem',
  color: 'var(--accent)',
  fontWeight: 600,
};

export default PipelineConfig;
