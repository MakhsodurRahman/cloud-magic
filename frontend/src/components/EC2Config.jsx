import React from 'react';
import { Server, Cpu, Database, Terminal, Globe } from 'lucide-react';

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

    {/* Software add-ons */}
    <div className="field-group">
      <label className="field-label">Software Add-ons</label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', padding: '16px', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--input-border)' }}>
        {SOFTWARE.map(sw => (
          <label key={sw.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, color: formData.selectedSoftware.includes(sw.id) ? 'var(--accent)' : 'var(--text-2)', textTransform: 'none', letterSpacing: 0 }}>
            <input type="checkbox" checked={formData.selectedSoftware.includes(sw.id)} onChange={() => toggleSoftware(sw.id)} style={{ width: 'auto', flex: 'none' }} />
            {sw.icon} {sw.id}
          </label>
        ))}
      </div>
    </div>
  </>
);

export default EC2Config;
