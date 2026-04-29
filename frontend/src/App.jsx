import React, { useState, useEffect } from 'react';
import { Server, Shield, Database, Globe, Play, Code, CheckCircle2, Loader2, Plus, Trash2, Box, AlertTriangle, RefreshCw } from 'lucide-react';

const App = () => {
  const [activeService, setActiveService] = useState('EC2');
  const [region, setRegion] = useState('us-east-1');
  const [resourceStack, setResourceStack] = useState([]);

  // Dynamic Metadata States
  const [availableRegions, setAvailableRegions] = useState(['us-east-1', 'us-west-2', 'eu-west-1']);
  const [availableAmis, setAvailableAmis] = useState([]);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState(['t3.micro', 't2.micro', 't3.small', 'c7i-flex.large', 'm7i-flex.large']);
  const [availableKeyPairs, setAvailableKeyPairs] = useState([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const [formData, setFormData] = useState({
    instanceName: 'MyMagicInstance',
    amiId: '',
    instanceType: 't3.micro',
    keyPairName: 'my-key-pair',
    securityGroupPorts: '22, 80',
    ebsVolumeSize: 20,
    bucketName: 'my-magic-bucket-' + Math.floor(Math.random() * 10000),
    versioningEnabled: false,
    acl: 'private'
  });

  const [terraformCode, setTerraformCode] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [output, setOutput] = useState('');
  const [backendError, setBackendError] = useState(null);

  // Fetch Regions on Load
  useEffect(() => {
    fetchMetadata('/regions', setAvailableRegions);
  }, []);

  // Fetch Region-Specific Metadata
  useEffect(() => {
    if (region) {
      fetchMetadata(`/amis?region=${region}`, setAvailableAmis);
      fetchMetadata(`/instance-types?region=${region}`, setAvailableInstanceTypes);
      fetchMetadata(`/key-pairs?region=${region}`, setAvailableKeyPairs);
    }
  }, [region]);

  const fetchMetadata = async (endpoint, setter) => {
    setLoadingMetadata(true);
    try {
      const response = await fetch(`http://localhost:8080/api/aws${endpoint}`);
      if (!response.ok) throw new Error('Metadata fetch failed');
      const data = await response.json();
      setter(data);

      // Update defaults if available
      if (endpoint.includes('amis') && data.length > 0) {
        setFormData(prev => ({ ...prev, amiId: data[0].id }));
      }
    } catch (err) {
      console.warn(`Could not fetch metadata for ${endpoint}`, err);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const addToStack = () => {
    const ports = typeof formData.securityGroupPorts === 'string'
      ? formData.securityGroupPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
      : [];

    const newResource = {
      ...formData,
      serviceType: activeService,
      securityGroupPorts: ports,
      id: Date.now()
    };
    setResourceStack([...resourceStack, newResource]);
  };

  const removeFromStack = (id) => {
    setResourceStack(resourceStack.filter(r => r.id !== id));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      generateCode();
    }, 500);
    return () => clearTimeout(timer);
  }, [resourceStack, region]);

  const generateCode = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/terraform/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, resources: resourceStack })
      });
      if (!response.ok) throw new Error('Backend error: ' + response.statusText);
      const code = await response.text();
      setTerraformCode(code);
      setBackendError(null);
    } catch (err) {
      console.error('Failed to generate code', err);
      setBackendError('Connection to backend failed. Please ensure the Spring Boot app is running on port 8080.');
    }
  };

  const handleDeploy = async () => {
    if (resourceStack.length === 0) {
      setOutput('Add at least one resource to the project before deploying.');
      return;
    }
    setDeploying(true);
    setOutput('Deploying full infrastructure stack...');
    try {
      const response = await fetch('http://localhost:8080/api/terraform/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, resources: resourceStack })
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
      {deploying && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(255, 255, 255, 0.8)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(30px)'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            padding: '4rem',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--panel-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2.5rem',
            boxShadow: '0 20px 80px rgba(0, 0, 0, 0.1)',
            maxWidth: '550px',
            width: '90%'
          }}>
            <div style={{ position: 'relative' }}>
              <Loader2 className="animate-spin" size={64} color="var(--accent-color)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>Provisioning Cloud</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Terraform is currently architecting your AWS resources.</p>
            </div>
            <div className="pulse" style={{
              width: '100%',
              height: '8px',
              background: '#F2F2F7',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '60%',
                height: '100%',
                background: 'var(--accent-color)',
                borderRadius: '10px'
              }} />
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="logo">
          <Box size={28} />
          <span>CloudMagic</span>
        </div>

        <nav className="service-nav">
          <div className={`nav-item ${activeService === 'EC2' ? 'active' : ''}`} onClick={() => setActiveService('EC2')}>
            <Server size={18} />
            <span>EC2 Instances</span>
          </div>
          <div className={`nav-item ${activeService === 'S3' ? 'active' : ''}`} onClick={() => setActiveService('S3')}>
            <Database size={18} />
            <span>S3 Buckets</span>
          </div>
          <div className="nav-item">
            <Shield size={18} />
            <span>IAM Access</span>
          </div>
        </nav>

        <div className="project-stack" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Active Stack</h4>
            <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>{resourceStack.length} items</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
            {resourceStack.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--panel-border)', borderRadius: 'var(--radius-md)' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Empty Workspace</p>
              </div>
            ) : (
              resourceStack.map(res => (
                <div key={res.id} className="stack-item animate-fade">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                    <div style={{ color: 'var(--accent-color)' }}>
                      {res.serviceType === 'EC2' ? <Server size={14} /> : <Database size={14} />}
                    </div>
                    <span style={{ fontWeight: 500 }}>{res.serviceType === 'EC2' ? res.instanceName : res.bucketName}</span>
                  </div>
                  <button
                    onClick={() => removeFromStack(res.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                    className="hover-error"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="form-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Infrastructure</h1>
            <p>Compose and deploy professional-grade AWS resources.</p>
          </div>
          <div className="field-group" style={{ width: '240px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              Region {loadingMetadata && <RefreshCw size={12} className="animate-spin" />}
            </label>
            <select value={region} onChange={(e) => setRegion(e.target.value)}>
              {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </header>

        {backendError && (
          <div style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--error)', padding: '16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--error)' }} className="animate-fade">
            <AlertTriangle size={20} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{backendError}</span>
          </div>
        )}

        <div className="config-panel animate-fade" key={activeService}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0, 122, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-color)' }}>
              {activeService === 'EC2' ? <Server size={20} /> : <Database size={20} />}
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.5px' }}>Configure {activeService}</h2>
          </div>

          <div className="form-grid">
            {activeService === 'EC2' ? (
              <>
                <div className="field-group">
                  <label>Instance Name</label>
                  <input name="instanceName" value={formData.instanceName} onChange={handleChange} placeholder="e.g. production-web-01" />
                </div>
                <div className="field-group">
                  <label>Amazon Machine Image</label>
                  <select name="amiId" value={availableAmis.find(a => a.id === formData.amiId) ? formData.amiId : 'custom'} onChange={handleChange}>
                    {availableAmis.map(ami => <option key={ami.id} value={ami.id}>{ami.name}</option>)}
                    <option value="custom">-- Custom AMI ID --</option>
                  </select>
                </div>

                {(!availableAmis.find(a => a.id === formData.amiId) || formData.amiId === 'custom') && (
                  <div className="field-group animate-fade">
                    <label>Custom AMI ID</label>
                    <input name="amiId" value={formData.amiId === 'custom' ? '' : formData.amiId} onChange={handleChange} placeholder="ami-xxxxxxxxxxxx" />
                  </div>
                )}

                <div className="field-group">
                  <label>Instance Type</label>
                  <select name="instanceType" value={formData.instanceType} onChange={handleChange}>
                    {availableInstanceTypes.map(type => (
                      <option key={type} value={type}>
                        {type} (Free Tier Eligible)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field-group">
                  <label>Security Access (Ports)</label>
                  <input name="securityGroupPorts" value={formData.securityGroupPorts} onChange={handleChange} placeholder="22, 80, 443" />
                </div>

                <div className="field-group">
                  <label>Key Pair Management</label>
                  <select name="keyPairSelection" value={formData.keyPairSelection || 'existing'} onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      keyPairSelection: val,
                      keyPairName: val === 'magic-new-key' ? 'my-new-key' : (availableKeyPairs[0] || 'my-key-pair')
                    }));
                  }}>
                    <option value="existing">Use Existing Key Pair</option>
                    <option value="magic-new-key">Create New Key Pair (Auto-Generate)</option>
                  </select>
                </div>

                <div className="field-group animate-fade">
                  <label>{formData.keyPairSelection === 'magic-new-key' ? 'New Key Pair Name' : 'Select Key Pair'}</label>
                  {formData.keyPairSelection === 'magic-new-key' ? (
                    <input name="keyPairName" value={formData.keyPairName} onChange={handleChange} placeholder="e.g. prod-key-v1" />
                  ) : (
                    <select name="keyPairName" value={formData.keyPairName} onChange={handleChange}>
                      {availableKeyPairs.length > 0 ? (
                        availableKeyPairs.map(key => <option key={key} value={key}>{key}</option>)
                      ) : (
                        <option value="my-key-pair">No keys found (using placeholder)</option>
                      )}
                    </select>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="field-group">
                  <label>Bucket Name</label>
                  <input name="bucketName" value={formData.bucketName} onChange={handleChange} placeholder="unique-bucket-name" />
                </div>
                <div className="field-group">
                  <label>Privacy Level (ACL)</label>
                  <select name="acl" value={formData.acl} onChange={handleChange}>
                    <option value="private">Private (Encrypted)</option>
                    <option value="public-read">Public Read</option>
                  </select>
                </div>
                <div className="field-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '12px', marginTop: '12px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: 'var(--radius-md)' }}>
                  <input type="checkbox" name="versioningEnabled" checked={formData.versioningEnabled} onChange={handleChange} id="versioning" style={{ width: '20px', height: '20px' }} />
                  <label htmlFor="versioning" style={{ textTransform: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}>Enable Object Versioning</label>
                </div>
              </>
            )}
          </div>

          <button className="btn btn-primary" onClick={addToStack}>
            <Plus size={18} /> Add to Stack
          </button>
        </div>

        <div style={{ marginTop: 'auto', pt: '20px' }}>
          <button className="btn btn-deploy" onClick={handleDeploy} disabled={deploying || resourceStack.length === 0} style={{ width: '100%' }}>
            {deploying ? <Loader2 className="animate-spin" size={20} /> : <Box size={18} />}
            <span>{deploying ? 'Deploying Stack...' : `Push to AWS (${resourceStack.length} Resources)`}</span>
          </button>
        </div>

        {output && (
          <div style={{ marginTop: '24px' }} className="animate-fade">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <label style={{ margin: 0 }}>Deployment Logs</label>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(output);
                  alert('Logs copied to clipboard!');
                }}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--panel-border)',
                  color: 'var(--text-primary)',
                  padding: '6px 14px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle2 size={14} /> Copy
              </button>
            </div>
            <div className="log-card">
              {deploying && <div style={{ color: 'var(--accent-color)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}><Loader2 size={14} className="animate-spin" /> Provisioning resources via Terraform...</div>}
              {output}
            </div>
          </div>
        )}
      </main>

      <section className="preview-panel">
        <div className="preview-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Code size={20} color="var(--accent-color)" />
            <h3>main.tf</h3>
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>HCL GENERATOR</span>
        </div>
        <div className="code-block" style={{ color: backendError ? 'var(--error)' : '#79C0FF' }}>
          {backendError || terraformCode || "# Generate your infrastructure stack to see HCL..."}
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', opacity: 0.5 }}>
          Generated by CloudMagic Engine v1.0
        </div>
      </section>
    </div>
  );
};

export default App;
