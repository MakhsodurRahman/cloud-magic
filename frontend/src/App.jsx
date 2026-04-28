import React, { useState, useEffect } from 'react';
import { Server, Shield, Database, Globe, Play, Code, CheckCircle2, Loader2, Plus, Trash2, Box, AlertTriangle, RefreshCw } from 'lucide-react';

const App = () => {
  const [activeService, setActiveService] = useState('EC2');
  const [region, setRegion] = useState('us-east-1');
  const [resourceStack, setResourceStack] = useState([]);
  
  // Dynamic Metadata States
  const [availableRegions, setAvailableRegions] = useState(['us-east-1', 'us-west-2', 'eu-west-1']);
  const [availableAmis, setAvailableAmis] = useState([]);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState(['t3.micro', 't3.small']);
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
          background: 'rgba(0, 0, 0, 0.85)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: 'var(--panel-bg)',
            padding: '3rem',
            borderRadius: '24px',
            border: '1px solid var(--accent-color)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2rem',
            boxShadow: '0 0 50px rgba(79, 70, 229, 0.3)'
          }}>
            <Loader2 className="animate-spin" size={64} color="var(--accent-color)" />
            <div style={{textAlign: 'center'}}>
              <h2 style={{fontSize: '2rem', marginBottom: '0.5rem'}}>Architecting Your Infrastructure</h2>
              <p style={{color: 'var(--text-secondary)'}}>Terraform is currently provisioning your AWS resources...</p>
            </div>
            <div className="pulse" style={{
              width: '100%',
              height: '4px',
              background: 'var(--border-color)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: '50%',
                height: '100%',
                background: 'var(--accent-color)',
                animation: 'loading-bar 2s infinite ease-in-out'
              }} />
            </div>
          </div>
        </div>
      )}

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
          <div className={`nav-item ${activeService === 'S3' ? 'active' : ''}`} onClick={() => setActiveService('S3')}>
            <Database size={20} />
            <span>S3 Buckets</span>
          </div>
          <div className="nav-item">
            <Shield size={20} />
            <span>IAM Roles</span>
          </div>
        </nav>

        <div className="project-stack" style={{marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '1rem'}}>
          <h4 style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1rem', textTransform: 'uppercase'}}>Project Stack ({resourceStack.length})</h4>
          <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto'}}>
            {resourceStack.length === 0 && <p style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>No resources added yet.</p>}
            {resourceStack.map(res => (
              <div key={res.id} style={{background: 'var(--bg-color)', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem'}}>
                  {res.serviceType === 'EC2' ? <Server size={14} /> : <Database size={14} />}
                  <span>{res.serviceType === 'EC2' ? res.instanceName : res.bucketName}</span>
                </div>
                <Trash2 size={14} color="var(--error)" style={{cursor: 'pointer'}} onClick={() => removeFromStack(res.id)} />
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="form-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <h1>Infrastructure Architect</h1>
            <p style={{color: 'var(--text-secondary)'}}>Compose your entire cloud project by adding multiple resources.</p>
          </div>
          <div className="field-group">
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              Project Region {loadingMetadata && <RefreshCw size={12} className="animate-spin" />}
            </label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} style={{minWidth: '200px'}}>
              {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </header>

        {backendError && (
          <div style={{background: 'rgba(218, 54, 51, 0.1)', border: '1px solid var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--error)'}}>
            <AlertTriangle size={20} />
            <span style={{fontSize: '0.9rem'}}>{backendError}</span>
          </div>
        )}

        <div className="config-panel animate-fade" key={activeService} style={{background: 'var(--panel-bg)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-color)'}}>
          <h2 style={{marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Plus size={24} color="var(--accent-color)" />
            Add {activeService}
          </h2>
          
          <div className="form-grid">
            {activeService === 'EC2' ? (
              <>
                <div className="field-group">
                  <label>Instance Name</label>
                  <input name="instanceName" value={formData.instanceName} onChange={handleChange} />
                </div>
                <div className="field-group">
                  <label>Select AMI</label>
                  <select name="amiId" value={availableAmis.find(a => a.id === formData.amiId) ? formData.amiId : 'custom'} onChange={handleChange}>
                    {availableAmis.map(ami => <option key={ami.id} value={ami.id}>{ami.name} ({ami.id})</option>)}
                    <option value="custom">-- Enter Custom AMI ID --</option>
                  </select>
                </div>
                
                {(!availableAmis.find(a => a.id === formData.amiId) || formData.amiId === 'custom') && (
                  <div className="field-group animate-fade">
                    <label>Custom AMI ID</label>
                    <input name="amiId" value={formData.amiId === 'custom' ? '' : formData.amiId} onChange={handleChange} placeholder="ami-0123456789abcdef0" />
                  </div>
                )}

                <div className="field-group">
                  <label>Instance Type</label>
                  <select name="instanceType" value={formData.instanceType} onChange={handleChange}>
                    {availableInstanceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>

                <div className="field-group">
                  <label>Key Pair</label>
                  <select name="keyPairSelection" value={formData.keyPairSelection || 'existing'} onChange={(e) => {
                    const val = e.target.value;
                    setFormData(prev => ({ 
                      ...prev, 
                      keyPairSelection: val,
                      keyPairName: val === 'magic-new-key' ? 'my-new-key' : (availableKeyPairs[0] || 'my-key-pair')
                    }));
                  }}>
                    <option value="existing">Use Existing Key Pair</option>
                    <option value="magic-new-key">Create New Key Pair (Magic)</option>
                  </select>
                </div>

                <div className="field-group animate-fade">
                  <label>{formData.keyPairSelection === 'magic-new-key' ? 'New Key Pair Name' : 'Select Key Pair'}</label>
                  {formData.keyPairSelection === 'magic-new-key' ? (
                    <input name="keyPairName" value={formData.keyPairName} onChange={handleChange} placeholder="e.g., prod-key" />
                  ) : (
                    <select name="keyPairName" value={formData.keyPairName} onChange={handleChange}>
                      {availableKeyPairs.length > 0 ? (
                        availableKeyPairs.map(key => <option key={key} value={key}>{key}</option>)
                      ) : (
                        <option value="my-key-pair">No keys found (using default placeholder)</option>
                      )}
                    </select>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="field-group">
                  <label>Bucket Name</label>
                  <input name="bucketName" value={formData.bucketName} onChange={handleChange} />
                </div>
                <div className="field-group">
                  <label>ACL</label>
                  <select name="acl" value={formData.acl} onChange={handleChange}>
                    <option value="private">Private</option>
                    <option value="public-read">Public Read</option>
                  </select>
                </div>
                <div className="field-group" style={{flexDirection: 'row', alignItems: 'center', gap: '1rem', marginTop: '1rem'}}>
                  <input type="checkbox" name="versioningEnabled" checked={formData.versioningEnabled} onChange={handleChange} id="versioning" />
                  <label htmlFor="versioning">Enable Versioning</label>
                </div>
              </>
            )}
          </div>
          
          <button className="btn btn-primary" style={{marginTop: '2rem', width: '100%'}} onClick={addToStack}>
            <Plus size={18} /> Add to Project Stack
          </button>
        </div>

        <div style={{marginTop: '3rem', display: 'flex', gap: '1rem'}}>
           <button className="btn btn-deploy" onClick={handleDeploy} disabled={deploying || resourceStack.length === 0} style={{flexGrow: 1, position: 'relative'}}>
              {deploying ? <Loader2 className="animate-spin" size={20} /> : <Box size={18} />}
              <span style={{marginLeft: '0.5rem'}}>{deploying ? 'Provisioning Full Stack... Please Wait' : `Deploy Project (${resourceStack.length} Resources)`}</span>
           </button>
        </div>

        {output && (
          <div style={{marginTop: '2rem'}} className="animate-fade">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem'}}>
              <label style={{margin: 0}}>Deployment Logs</label>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(output);
                  alert('Logs copied to clipboard!');
                }}
                style={{
                  background: 'var(--bg-color)', 
                  border: '1px solid var(--border-color)', 
                  color: 'var(--text-primary)', 
                  padding: '4px 12px', 
                  borderRadius: '4px', 
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <CheckCircle2 size={14} /> Copy Logs
              </button>
            </div>
            <div className="code-block" style={{fontSize: '0.8rem', height: '250px', overflowY: 'auto', border: deploying ? '1px solid var(--accent-color)' : '1px solid var(--border-color)'}}>
              {deploying && <div style={{color: 'var(--accent-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}><Loader2 size={14} className="animate-spin" /> Terraform is executing commands...</div>}
              {output}
            </div>
          </div>
        )}
      </main>

      <section className="preview-panel">
        <div className="preview-header">
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
            <Code size={20} color="var(--accent-color)" />
            <h3>Project HCL (main.tf)</h3>
          </div>
          <span style={{fontSize: '0.75rem', background: 'var(--bg-color)', padding: '2px 8px', borderRadius: '10px'}}>{resourceStack.length} Resources</span>
        </div>
        <div className="code-block" style={{color: backendError ? 'var(--error)' : 'inherit'}}>
          {backendError || terraformCode || "# Add resources to see the generated code..."}
        </div>
      </section>
    </div>
  );
};

export default App;
