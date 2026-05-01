import React, { useState } from 'react';
import {
  Server, Shield, Database, Globe, Cpu, Terminal,
  RefreshCw, AlertTriangle, Compass
} from 'lucide-react';
import WebTerminal from './WebTerminal';

const SOFTWARE_LIST = [
  { id: 'Nodejs', icon: <Cpu size={18} />, desc: 'Modern JavaScript Runtime (Node.js 20 LTS)' },
  { id: 'Java', icon: <Database size={18} />, desc: 'OpenJDK Development Kit (JDK)' },
  { id: 'Python', icon: <Terminal size={18} />, desc: 'Python 3 with Pip & Dev Headers' },
  { id: 'Laravel', icon: <Globe size={18} />, desc: 'PHP Stack with Composer for Laravel' },
  { id: 'Redis', icon: <Database size={18} />, desc: 'High-performance In-memory Data Store' },
  { id: 'Nginx', icon: <Globe size={18} />, desc: 'Professional Web Server & Reverse Proxy' },
  { id: 'Kafka', icon: <Cpu size={18} />, desc: 'Distributed Event Streaming Platform' },
  { id: 'Utilities', icon: <Server size={18} />, desc: 'Standard Linux Tools (git, curl, build-essential)' },
];

const SoftwareManager = ({
  runningInstances,
  selectedInstanceId,
  setSelectedInstanceId,
  sshUser,
  setSshUser,
  softwarePassword,
  setSoftwarePassword,
  credentials,
  region,
  setOutput,
  pendingKeyFile,
  setPendingKeyFile,
  formData,
}) => {
  const [installing, setInstalling] = useState(false);
  const [showFixSsh, setShowFixSsh] = useState(false);
  const [activeTerminal, setActiveTerminal] = useState(null);

  const handleKeyUpload = async () => {
    if (!pendingKeyFile) return;
    const fd = new FormData();
    fd.append('file', pendingKeyFile);
    try {
      const res = await fetch('http://localhost:8080/api/keys/upload', { method: 'POST', body: fd });
      const msg = await res.text();
      setOutput(prev => prev + `\nVault: ${msg}\n`);
      setPendingKeyFile(null);
    } catch (err) {
      setOutput(prev => prev + `\nVault Error: ${err.message}\n`);
    }
  };

  const handleInstallSingle = async (software) => {
    const instance = runningInstances.find(i => i.id === selectedInstanceId);
    if (!instance) return;
    setInstalling(true);
    setOutput(prev => prev + `\nInstalling ${software} on ${instance.name} (${instance.ip})...\n`);
    try {
      const response = await fetch('http://localhost:8080/api/software/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: instance.ip, user: sshUser, password: softwarePassword, keyName: instance.keyName, softwareList: [software] }),
      });
      const result = await response.text();
      setOutput(prev => prev + result);
      if (result.toLowerCase().includes('timeout')) setShowFixSsh(true);
    } catch (err) {
      setOutput(prev => prev + `\nInstallation failed: ${err.message}`);
      if (err.message.toLowerCase().includes('timeout')) setShowFixSsh(true);
    } finally {
      setInstalling(false);
    }
  };

  const handleFixSsh = async () => {
    const instance = runningInstances.find(i => i.id === selectedInstanceId);
    if (!instance) return;
    setInstalling(true);
    setOutput(prev => prev + `\nAttempting to auto-fix Security Group for ${instance.id}...\n`);
    try {
      const response = await fetch(`http://localhost:8080/api/aws/fix-ssh?instanceId=${instance.id}&region=${region}`, {
        method: 'POST',
        headers: { 'X-AWS-Access-Key': credentials.accessKey, 'X-AWS-Secret-Key': credentials.secretKey },
      });
      const result = await response.text();
      setOutput(prev => prev + result + '\n');
      setShowFixSsh(false);
    } catch (err) {
      setOutput(prev => prev + `\nFix failed: ${err.message}`);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div className="config-panel animate-fade">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Cpu size={24} color="var(--accent-color)" />
        <h2 style={{ margin: 0 }}>Software Manager</h2>
      </div>

      <div className="form-grid">
        <div className="field-group">
          <label>Target Instance</label>
          <select value={selectedInstanceId} onChange={e => setSelectedInstanceId(e.target.value)}>
            {runningInstances.length === 0
              ? <option>No running instances found</option>
              : runningInstances.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name} ({inst.ip})</option>
                ))
            }
          </select>
        </div>

        <div className="field-group">
          <label>SSH User</label>
          <input value={sshUser} onChange={e => setSshUser(e.target.value)} placeholder="e.g. ubuntu" />
        </div>

        <div className="field-group">
          <label>SSH Password (Optional)</label>
          <input type="password" value={softwarePassword} onChange={e => setSoftwarePassword(e.target.value)} placeholder="Leave blank if using Key (.pem)" />
        </div>

        <div className="field-group">
          <label>Import Private Key (.pem)</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="file"
              accept=".pem"
              onChange={e => setPendingKeyFile(e.target.files[0])}
              style={{ padding: '8px', fontSize: '0.8rem', background: 'var(--panel-bg)', borderRadius: '8px' }}
            />
            <button className="btn btn-primary" onClick={handleKeyUpload} disabled={!pendingKeyFile} style={{ whiteSpace: 'nowrap', padding: '0 16px' }}>
              <Shield size={14} /> Upload to Vault
            </button>
          </div>
        </div>
      </div>

      <div className="config-panel" style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Server size={20} color="var(--accent-color)" /> Available Software Catalog
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: '12px', overflow: 'hidden' }}>
          <thead>
            <tr style={{ background: 'var(--panel-bg)', textAlign: 'left', fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '16px' }}>Software</th>
              <th style={{ padding: '16px' }}>Description</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {SOFTWARE_LIST.map(sw => (
              <tr key={sw.id} style={{ borderBottom: '1px solid var(--panel-border)', transition: 'background 0.2s' }}>
                <td style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600 }}>
                  <div style={{ background: 'var(--panel-bg)', padding: '8px', borderRadius: '8px' }}>{sw.icon}</div>
                  {sw.id}
                </td>
                <td style={{ padding: '16px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{sw.desc}</td>
                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => handleInstallSingle(sw.id)}
                    disabled={installing || !selectedInstanceId}
                    style={{ padding: '6px 16px', fontSize: '0.8rem' }}
                  >
                    Install {sw.id}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            className="btn btn-primary"
            onClick={() => setActiveTerminal(runningInstances.find(i => i.id === selectedInstanceId))}
            disabled={!selectedInstanceId}
            style={{ padding: '6px 16px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Terminal size={14} /> Open SSH Terminal
          </button>
        </div>
      </div>

      {showFixSsh && (
        <div className="animate-fade" style={{ marginTop: '24px', padding: '20px', background: 'rgba(255, 153, 0, 0.1)', border: '1px solid #FF9900', borderRadius: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#FF9900', fontWeight: 700, marginBottom: '12px' }}>
            <AlertTriangle size={24} />
            <span>Connection Blocked by Security Group</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            AWS is blocking our connection because Port 22 (SSH) is closed. Would you like CloudMagic to automatically open it for you?
          </p>
          <button className="btn btn-primary" style={{ background: '#FF9900', border: 'none', width: '100%' }} onClick={handleFixSsh} disabled={installing}>
            <Shield size={18} /> Fix Connection & Retry Installation
          </button>
        </div>
      )}

      <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
        Note: If using a machine created by this tool, the system will automatically use the <strong>.pem</strong> key from your session.
      </p>

      {activeTerminal && (
        <WebTerminal
          host={activeTerminal.ip}
          user={sshUser}
          keyName={activeTerminal.keyName || formData.keyPairName}
          onClose={() => setActiveTerminal(null)}
        />
      )}
    </div>
  );
};

export default SoftwareManager;
