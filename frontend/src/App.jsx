import React, { useState, useEffect } from 'react';
import { Server, Shield, Database, Globe, Play, Code, CheckCircle2, Loader2 } from 'lucide-react';

const App = () => {
  const [activeService, setActiveService] = useState('EC2');
  const [formData, setFormData] = useState({
    instanceName: 'MyMagicInstance',
    amiId: 'ami-04e5276ebb8451442',
    instanceType: 't3.micro',
    keyPairName: 'my-key-pair',
    securityGroupPorts: '22, 80',
    ebsVolumeSize: 20,
    region: 'us-east-1'
  });

  const [terraformCode, setTerraformCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [output, setOutput] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      generateCode();
    }, 500);
    return () => clearTimeout(timer);
  }, [formData]);

  const generateCode = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/terraform/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          securityGroupPorts: formData.securityGroupPorts.split(',').map(p => parseInt(p.trim()))
        })
      });
      const code = await response.text();
      setTerraformCode(code);
    } catch (err) {
      console.error('Failed to generate code', err);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setOutput('Deploying infrastructure...');
    try {
      const response = await fetch('http://localhost:8080/api/terraform/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          securityGroupPorts: formData.securityGroupPorts.split(',').map(p => parseInt(p.trim()))
        })
      });
      const result = await response.text();
      setOutput(result);
    } catch (err) {
      setOutput('Deployment failed: ' + err.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="logo">
          <Globe size={32} />
          <span>AWS Magic</span>
        </div>
        
        <nav className="service-nav">
          <div className={`nav-item ${activeService === 'EC2' ? 'active' : ''}`} onClick={() => setActiveService('EC2')}>
            <Server size={20} />
            <span>EC2 Instances</span>
          </div>
          <div className="nav-item">
            <Database size={20} />
            <span>S3 Buckets</span>
          </div>
          <div className="nav-item">
            <Shield size={20} />
            <span>IAM Roles</span>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="form-header">
          <h1>Configure EC2 Instance</h1>
          <p style={{color: 'var(--text-secondary)'}}>Define your virtual server parameters</p>
        </header>

        <div className="form-grid animate-fade">
          <div className="field-group">
            <label>Instance Name</label>
            <input name="instanceName" value={formData.instanceName} onChange={handleChange} placeholder="web-server-prod" />
          </div>

          <div className="field-group">
            <label>Region</label>
            <select name="region" value={formData.region} onChange={handleChange}>
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">Europe (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>

          <div className="field-group">
            <label>Amazon Machine Image (AMI)</label>
            <select name="amiId" value={formData.amiId} onChange={handleChange}>
              <option value="ami-04e5276ebb8451442">Amazon Linux 2023 (al2023-ami-2023.4.20240416.0-kernel-6.1-x86_64)</option>
              <option value="ami-07d9b9ddc6cd8dd30">Ubuntu 22.04 LTS (ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server)</option>
              <option value="ami-0c55b159cbfafe1f0">Amazon Linux 2 (Old Stable)</option>
            </select>
          </div>

          <div className="field-group">
            <label>Instance Type</label>
            <select name="instanceType" value={formData.instanceType} onChange={handleChange}>
              <option value="t3.micro">t3.micro (Free Tier)</option>
              <option value="t3.small">t3.small</option>
              <option value="c7i-flex.large">c7i-flex.large</option>
            </select>
          </div>

          <div className="field-group">
            <label>Key Pair Name</label>
            <input name="keyPairName" value={formData.keyPairName} onChange={handleChange} />
          </div>

          <div className="field-group">
            <label>Security Group Ports (comma separated)</label>
            <input name="securityGroupPorts" value={formData.securityGroupPorts} onChange={handleChange} placeholder="22, 80, 443" />
          </div>

          <div className="field-group">
            <label>EBS Volume Size (GB)</label>
            <input type="number" name="ebsVolumeSize" value={formData.ebsVolumeSize} onChange={handleChange} />
          </div>
        </div>

        <div style={{marginTop: '3rem'}}>
           <button className="btn btn-deploy" onClick={handleDeploy} disabled={deploying}>
              {deploying ? <Loader2 className="animate-spin" /> : <Play size={18} />}
              {deploying ? 'Deploying...' : 'Deploy Infrastructure'}
           </button>
        </div>

        {output && (
          <div style={{marginTop: '2rem'}} className="animate-fade">
            <label>Console Output</label>
            <div className="code-block" style={{fontSize: '0.8rem', height: '200px', overflowY: 'auto', marginTop: '0.5rem'}}>
              {output}
            </div>
          </div>
        )}
      </main>

      <section className="preview-panel">
        <div className="preview-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Code size={20} color="var(--accent-color)" />
            <h3>main.tf Preview</h3>
          </div>
          <CheckCircle2 size={18} color="var(--success)" />
        </div>
        <div className="code-block">
          {terraformCode}
        </div>
        <p style={{fontSize: '0.75rem', color: 'var(--text-secondary)'}}>
          Automatically generated HCL code based on your configuration.
        </p>
      </section>
    </div>
  );
};

export default App;
