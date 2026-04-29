import React, { useState, useEffect } from 'react';
import { Server, Shield, Database, Globe, Play, Code, CheckCircle2, Loader2, Plus, Trash2, Box, AlertTriangle, RefreshCw, Sun, Moon, Cpu, Cloud } from 'lucide-react';

const App = () => {
  const [activeService, setActiveService] = useState('EC2');
  const [region, setRegion] = useState('us-east-1');
  const [resourceStack, setResourceStack] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cloudProvider, setCloudProvider] = useState(null); // Start with null to show provider selection
  const [credentials, setCredentials] = useState({ accessKey: '', secretKey: '' });
  const [deploymentStatus, setDeploymentStatus] = useState({ step: '', status: '', message: '' });
  const [isConnected, setIsConnected] = useState(false);
  
  // Dynamic Metadata States
  const [availableRegions, setAvailableRegions] = useState(['us-east-1', 'us-west-2', 'eu-west-1', 'ap-south-1', 'eu-central-1']);
  const [availableAmis, setAvailableAmis] = useState([]);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState(['t3.micro', 't2.micro', 't3.small', 'c7i-flex.large', 'm7i-flex.large']);
  const [availableKeyPairs, setAvailableKeyPairs] = useState([]);
  const [loadingMetadata, setLoadingMetadata] = useState(false);

  const [formData, setFormData] = useState({
    instanceName: 'MyMagicInstance',
    amiId: '',
    instanceType: 't3.micro',
    keyPairName: 'my-key-pair',
    keyPairSelection: 'existing',
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
  const [isLogMaximized, setIsLogMaximized] = useState(false);

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const handleConnect = () => {
    if (credentials.accessKey && credentials.secretKey) {
      setIsConnected(true);
      fetchMetadata(`/regions`, setAvailableRegions);
    } else {
      alert('Please enter your IAM credentials to connect.');
    }
  };

  // Fetch Metadata on Load & Region Change
  useEffect(() => {
    if (isConnected && cloudProvider === 'AWS' && region) {
      fetchMetadata(`/amis?region=${region}`, setAvailableAmis);
      fetchMetadata(`/instance-types?region=${region}`, setAvailableInstanceTypes);
      fetchMetadata(`/key-pairs?region=${region}`, setAvailableKeyPairs);
    }
  }, [region, cloudProvider, isConnected]);

  const fetchMetadata = async (endpoint, setter) => {
    setLoadingMetadata(true);
    try {
      const headers = {};
      if (credentials.accessKey) headers['X-AWS-Access-Key'] = credentials.accessKey;
      if (credentials.secretKey) headers['X-AWS-Secret-Key'] = credentials.secretKey;

      const response = await fetch(`http://localhost:8080/api/aws${endpoint}`, { headers });
      if (!response.ok) throw new Error('Metadata fetch failed');
      const data = await response.json();
      setter(data);
      
      if (endpoint.includes('amis') && data.length > 0) {
        setFormData(prev => ({ ...prev, amiId: data[0].id }));
      }
      if (endpoint.includes('key-pairs') && data.length > 0) {
        setFormData(prev => ({ ...prev, keyPairName: data[0] }));
      }
    } catch (err) {
      console.warn(`Could not fetch metadata for ${endpoint}`);
    } finally {
      setLoadingMetadata(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const addToStack = () => {
    const ports = typeof formData.securityGroupPorts === 'string' 
      ? formData.securityGroupPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
      : [];

    const newResource = { 
      ...formData, 
      securityGroupPorts: ports,
      ebsVolumeSize: parseInt(formData.ebsVolumeSize) || 20,
      serviceType: activeService, 
      id: Date.now() 
    };
    setResourceStack([...resourceStack, newResource]);
  };

  const removeFromStack = (id) => {
    setResourceStack(resourceStack.filter(r => r.id !== id));
  };

  const handleStepByStepDeploy = async () => {
    if (resourceStack.length === 0) {
      setOutput('Add at least one resource before deploying.');
      return;
    }

    setDeploying(true);
    setOutput('Starting sequential deployment...\n');

    const steps = [
      { id: 'init', label: 'Initializing', endpoint: '/init' },
      { id: 'validate', label: 'Validating', endpoint: '/validate' },
      { id: 'plan', label: 'Planning', endpoint: '/plan' },
      { id: 'apply', label: 'Applying', endpoint: '/apply' }
    ];

    try {
      for (const step of steps) {
        setDeploymentStatus({ step: step.label, status: 'loading', message: `Executing ${step.label.toLowerCase()}...` });
        setOutput(prev => prev + `\n--- Stage: ${step.label} ---\n`);

        const response = await fetch(`http://localhost:8080/api/terraform${step.endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            region, 
            resources: resourceStack, 
            cloudProvider, 
            accessKey: credentials.accessKey, 
            secretKey: credentials.secretKey 
          })
        });

        const result = await response.text();
        setOutput(prev => prev + result + '\n');
        if (!response.ok) throw new Error(`${step.label} failed: ${result}`);
      }
      setDeploymentStatus({ step: 'Success', status: 'success', message: 'Infrastructure deployed successfully!' });
    } catch (err) {
      setDeploymentStatus({ step: 'Failed', status: 'error', message: err.message });
      setOutput(prev => prev + '\nDeployment aborted.');
    } finally {
      setDeploying(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      const timer = setTimeout(() => generateCode(), 500);
      return () => clearTimeout(timer);
    }
  }, [resourceStack, region, cloudProvider, isConnected]);

  const generateCode = async () => {
    try {
      const response = await fetch('http://localhost:8080/api/terraform/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, resources: resourceStack, cloudProvider, accessKey: credentials.accessKey, secretKey: credentials.secretKey })
      });
      const code = await response.text();
      setTerraformCode(code);
      setBackendError(null);
    } catch (err) {
      setBackendError('Backend connection failed.');
    }
  };

  return (
    <div className="dashboard">
      {deploying && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(20px)' }}>
          <div style={{ background: 'var(--panel-bg)', padding: '3rem', borderRadius: 'var(--radius-lg)', border: '1px solid var(--panel-border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem', maxWidth: '550px', width: '90%' }}>
            <Loader2 className="animate-spin" size={64} color="var(--accent-color)" />
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{deploymentStatus.step}</h2>
              <p style={{ color: 'var(--text-secondary)' }}>{deploymentStatus.message}</p>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {['Initializing', 'Validating', 'Planning', 'Applying'].map((step) => {
                const isCurrent = deploymentStatus.step === step;
                const isPast = ['Initializing', 'Validating', 'Planning', 'Applying'].indexOf(deploymentStatus.step) > ['Initializing', 'Validating', 'Planning', 'Applying'].indexOf(step);
                return (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '12px', opacity: isPast || isCurrent ? 1 : 0.3 }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: isPast ? 'var(--success)' : isCurrent ? 'var(--accent-color)' : 'gray', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
                      {isPast ? <CheckCircle2 size={14} /> : isCurrent ? <Loader2 size={14} className="animate-spin" /> : null}
                    </div>
                    <span style={{ fontWeight: isCurrent ? 600 : 400, color: 'var(--text-primary)' }}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="logo"><Box size={28} /> <span>CloudMagic</span></div>
          <div className="theme-toggle-icon" onClick={() => setIsDarkMode(!isDarkMode)} style={{ cursor: 'pointer', color: 'var(--accent-color)' }}>
            {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
          </div>
        </div>
        
        {isConnected && (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <nav className="service-nav">
              <div className={`nav-item ${activeService === 'EC2' ? 'active' : ''}`} onClick={() => setActiveService('EC2')}>
                <Server size={18} /> <span>{cloudProvider === 'AWS' ? 'EC2' : 'VM'}</span>
              </div>
              <div className={`nav-item ${activeService === 'S3' ? 'active' : ''}`} onClick={() => setActiveService('S3')}>
                <Database size={18} /> <span>{cloudProvider === 'AWS' ? 'S3' : 'Storage'}</span>
              </div>
            </nav>

            <div className="field-group">
              <label>Session</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'var(--input-bg)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                 <Cloud size={18} color="var(--accent-color)" />
                 <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{cloudProvider}</span>
                 <button onClick={() => { setCloudProvider(null); setIsConnected(false); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-color)', fontSize: '0.6rem', fontWeight: 800, cursor: 'pointer' }}>LOGOUT</button>
              </div>
            </div>
          </div>
        )}

        {isConnected && resourceStack.length > 0 && (
          <div className="project-stack animate-fade" style={{ flexGrow: 1, overflowY: 'auto', paddingRight: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'sticky', top: 0, background: 'var(--panel-bg)', zIndex: 10 }}>
               <h4 style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Project Stack</h4>
               <span style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '10px' }}>{resourceStack.length}</span>
            </div>
            {resourceStack.map(res => (
              <div key={res.id} className="stack-item animate-fade" style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem' }}>{res.serviceType}: {res.instanceName || res.bucketName}</span>
                <Trash2 size={14} onClick={() => removeFromStack(res.id)} style={{ cursor: 'pointer', color: 'var(--error)' }} />
              </div>
            ))}
          </div>
        )}
      </aside>

      <main className="main-content">
        {!cloudProvider ? (
          <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '40px' }}>
            <div style={{ textAlign: 'center' }}>
              <h1 style={{ fontSize: '3.5rem', fontWeight: 800, letterSpacing: '-2px', marginBottom: '16px' }}>Select Provider</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem' }}>Choose a cloud ecosystem to start architecting.</p>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', width: '100%', maxWidth: '900px' }}>
              {[
                { id: 'AWS', name: 'Amazon Web Services', icon: <Box size={40} />, color: '#FF9900' },
                { id: 'Azure', name: 'Microsoft Azure', icon: <Cloud size={40} />, color: '#0089D6' },
                { id: 'GCP', name: 'Google Cloud', icon: <Globe size={40} />, color: '#4285F4' }
              ].map(provider => (
                <div 
                  key={provider.id} 
                  className="provider-card"
                  onClick={() => setCloudProvider(provider.id)}
                  style={{ 
                    background: 'var(--panel-bg)', 
                    padding: '40px', 
                    borderRadius: '24px', 
                    border: '1px solid var(--panel-border)', 
                    textAlign: 'center', 
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                >
                  <div style={{ color: provider.color }}>{provider.icon}</div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>{provider.name}</h3>
                </div>
              ))}
            </div>
          </div>
        ) : !isConnected ? (
          <div className="animate-fade" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
            <section style={{ 
              background: 'var(--panel-bg)', 
              padding: '48px', 
              borderRadius: '24px', 
              border: '1px solid var(--panel-border)', 
              textAlign: 'center', 
              maxWidth: '550px', 
              width: '100%',
              boxShadow: 'var(--shadow-lg)',
              backdropFilter: 'blur(40px) saturate(180%)'
            }}>
              <button onClick={() => setCloudProvider(null)} style={{ position: 'absolute', top: '24px', left: '24px', background: 'none', border: 'none', color: 'var(--accent-color)', fontWeight: 700, cursor: 'pointer' }}>← BACK</button>
              
              <div style={{ 
                width: '64px', 
                height: '64px', 
                background: 'rgba(0, 122, 255, 0.1)', 
                borderRadius: '16px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 24px auto' 
              }}>
                <Shield size={32} color="var(--accent-color)" />
              </div>
              
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px' }}>Connect to {cloudProvider}</h2>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '1rem' }}>
                Secure session-based authentication. No local configuration required.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left' }}>
                <div className="field-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                  <label style={{ width: 'auto' }}>Access Key ID</label>
                  <input 
                    type="password" 
                    placeholder="AKIAXXXXXXXXXXXXXXXX" 
                    value={credentials.accessKey} 
                    onChange={(e) => setCredentials({ ...credentials, accessKey: e.target.value })} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="field-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                  <label style={{ width: 'auto' }}>Secret Access Key</label>
                  <input 
                    type="password" 
                    placeholder="••••••••••••••••••••••••••••••••" 
                    value={credentials.secretKey} 
                    onChange={(e) => setCredentials({ ...credentials, secretKey: e.target.value })} 
                    style={{ width: '100%' }}
                  />
                </div>
                
                <div className="field-group" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
                  <label style={{ width: 'auto' }}>Default Region</label>
                  <select 
                    value={region} 
                    onChange={(e) => setRegion(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                
                <button 
                  className="btn btn-primary" 
                  style={{ marginTop: '12px', height: '56px', width: '100%' }} 
                  onClick={handleConnect}
                >
                  <Globe size={18} /> Connect Securely
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="animate-fade">
            <header className="form-header">
              <h1>Cloud Architect</h1>
              <p>Secure {cloudProvider} infrastructure orchestration.</p>
            </header>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0', padding: '16px 24px', background: 'rgba(52, 199, 89, 0.1)', borderRadius: '16px', border: '1px solid var(--success)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <CheckCircle2 color="var(--success)" size={20} />
                  <span style={{ fontWeight: 600 }}>{cloudProvider} Connected Session</span>
               </div>
               <button onClick={() => setIsConnected(false)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', fontWeight: 600, cursor: 'pointer' }}>Switch Keys</button>
            </div>

            <div className="config-panel">
              <h2 style={{ marginBottom: '24px' }}>Configure {activeService}</h2>
              <div className="form-grid">
                {activeService === 'EC2' ? (
                  <>
                    <div className="field-group">
                      <label>Instance Name</label>
                      <input name="instanceName" value={formData.instanceName} onChange={handleChange} placeholder="e.g. prod-web-01" />
                    </div>
                    <div className="field-group">
                      <label>Machine Image (AMI)</label>
                      <select name="amiId" value={availableAmis.find(a => a.id === formData.amiId) ? formData.amiId : 'custom'} onChange={handleChange}>
                        {availableAmis.map(ami => <option key={ami.id} value={ami.id}>{ami.name}</option>)}
                        <option value="custom">-- Custom AMI ID --</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Instance Type</label>
                      <select name="instanceType" value={formData.instanceType} onChange={handleChange}>
                        {availableInstanceTypes.map(type => <option key={type} value={type}>{type} (Free Tier Eligible)</option>)}
                      </select>
                    </div>
                    <div className="field-group">
                      <label>Security Group Ports</label>
                      <input name="securityGroupPorts" value={formData.securityGroupPorts} onChange={handleChange} placeholder="e.g. 22, 80, 443" />
                    </div>
                    <div className="field-group">
                      <label>EBS Volume Size (GB)</label>
                      <input type="number" name="ebsVolumeSize" value={formData.ebsVolumeSize} onChange={handleChange} />
                    </div>
                    <div className="field-group">
                      <label>Key Pair</label>
                      <select name="keyPairSelection" value={formData.keyPairSelection} onChange={handleChange}>
                        <option value="existing">Use Existing Key</option>
                        <option value="magic-new-key">Generate New Key</option>
                      </select>
                    </div>
                    <div className="field-group">
                      <label>{formData.keyPairSelection === 'magic-new-key' ? 'New Key Name' : 'Select Key'}</label>
                      {formData.keyPairSelection === 'magic-new-key' ? (
                        <input name="keyPairName" value={formData.keyPairName} onChange={handleChange} />
                      ) : (
                        <select name="keyPairName" value={formData.keyPairName} onChange={handleChange}>
                          {availableKeyPairs.map(k => <option key={k} value={k}>{k}</option>)}
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
                      <label>ACL / Privacy</label>
                      <select name="acl" value={formData.acl} onChange={handleChange}>
                        <option value="private">Private (Encrypted)</option>
                        <option value="public-read">Public Read</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              <button className="btn btn-primary" style={{ marginTop: '24px' }} onClick={addToStack}><Plus size={18} /> Add to Stack</button>
            </div>

            <div style={{ marginTop: '40px' }}>
              <button className="btn btn-deploy" onClick={handleStepByStepDeploy} disabled={deploying || resourceStack.length === 0} style={{ width: '100%' }}>
                {deploying ? <Loader2 className="animate-spin" size={20} /> : <Play size={18} />}
                <span>{deploying ? 'Deploying...' : `Deploy Infrastructure to ${cloudProvider}`}</span>
              </button>
            </div>
            
            {output && (
              <div className={`log-container animate-fade ${isLogMaximized ? 'maximized' : ''}`} style={{ marginTop: '32px' }}>
                <div className="terminal-header">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F56' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFBD2E' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27C93F' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.5, marginLeft: '12px' }}>TERRAFORM OUTPUT</span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
                    <button 
                      onClick={() => setIsLogMaximized(!isLogMaximized)}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'inherit', padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {isLogMaximized ? 'RESTORE' : 'MAXIMIZE'}
                    </button>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(output);
                        alert('Logs copied to clipboard!');
                      }}
                      style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'inherit', padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      COPY LOGS
                    </button>
                  </div>
                </div>
                <div 
                  className="log-card" 
                  ref={(el) => {
                    if (el) el.scrollTop = el.scrollHeight;
                  }}
                >
                  {output}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <section className="preview-panel">
        <div className="preview-header">
           <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Code size={20} color="var(--accent-color)" /> <h3>main.tf</h3></div>
           <button 
             onClick={() => {
               navigator.clipboard.writeText(terraformCode);
               alert('Terraform code copied to clipboard!');
             }}
             style={{ background: 'rgba(0, 122, 255, 0.1)', border: 'none', color: 'var(--accent-color)', padding: '4px 12px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer' }}
           >
             COPY
           </button>
        </div>
        <div className="code-block">{terraformCode || "# Build your stack to see HCL..."}</div>
      </section>
    </div>
  );
};

export default App;
