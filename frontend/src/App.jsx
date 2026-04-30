import React, { useState, useEffect } from 'react';
import { Server, Shield, Database, Globe, Play, Code, CheckCircle2, Loader2, Plus, Trash2, Terminal, Box, AlertTriangle, RefreshCw, Sun, Moon, Cpu, Cloud, GitBranch } from 'lucide-react';
import WebTerminal from './components/WebTerminal';

const App = () => {
  const [activeService, setActiveService] = useState('EC2');
  const [region, setRegion] = useState('us-east-1');
  const [resourceStack, setResourceStack] = useState([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [cloudProvider, setCloudProvider] = useState(null); // Start with null to show provider selection
  const [credentials, setCredentials] = useState({ accessKey: '', secretKey: '' });
  const [deploymentStatus, setDeploymentStatus] = useState({ step: '', status: '', message: '' });
  const [isConnected, setIsConnected] = useState(false);
  const [pendingKeyFile, setPendingKeyFile] = useState(null);
  const [activeTerminal, setActiveTerminal] = useState(null);

  const handleKeyUpload = async () => {
    if (!pendingKeyFile) return;
    const formData = new FormData();
    formData.append('file', pendingKeyFile);

    try {
      const res = await fetch('http://localhost:8080/api/keys/upload', {
        method: 'POST',
        body: formData
      });
      const msg = await res.text();
      setOutput(prev => prev + `\nVault: ${msg}\n`);
      setPendingKeyFile(null);
    } catch (err) {
      setOutput(prev => prev + `\nVault Error: ${err.message}\n`);
    }
  };
  
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
    acl: 'private',
    selectedSoftware: [],
    pipelineName: 'my-app-pipeline',
    repoUrl: '',
    branch: 'main',
    targetInstanceId: '',
    buildCommands: 'npm test',
    appName: 'my-beanstalk-app',
    environmentName: 'my-beanstalk-env',
    platform: 'nodejs',
    envType: 'SingleInstance'
  });

  const toggleSoftware = (software) => {
    setFormData(prev => {
      const list = prev.selectedSoftware.includes(software)
        ? prev.selectedSoftware.filter(s => s !== software)
        : [...prev.selectedSoftware, software];
      return { ...prev, selectedSoftware: list };
    });
  };

  const [terraformCode, setTerraformCode] = useState('');
  const [deploying, setDeploying] = useState(false);
  const [output, setOutput] = useState('');
  const [backendError, setBackendError] = useState(null);
  const [isLogMaximized, setIsLogMaximized] = useState(false);
  
  // Software Management States
  const [runningInstances, setRunningInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [installing, setInstalling] = useState(false);
  const [softwarePassword, setSoftwarePassword] = useState('');
  const [sshUser, setSshUser] = useState('ubuntu');
  const [showFixSsh, setShowFixSsh] = useState(false);

  const handleFixSsh = async () => {
    const instance = runningInstances.find(i => i.id === selectedInstanceId);
    if (!instance) return;

    setInstalling(true);
    setOutput(prev => prev + `\nAttempting to auto-fix Security Group for ${instance.id}...\n`);
    
    try {
      const response = await fetch(`http://localhost:8080/api/aws/fix-ssh?instanceId=${instance.id}&region=${region}`, {
        method: 'POST',
        headers: {
          'X-AWS-Access-Key': credentials.accessKey,
          'X-AWS-Secret-Key': credentials.secretKey
        }
      });
      const result = await response.text();
      setOutput(prev => prev + result + '\n');
      
      // Wait a few seconds for AWS to propagate the SG change
      setOutput(prev => prev + 'Waiting for AWS propagation (5s)...\n');
      setTimeout(() => {
        handleInstallRedis();
        setShowFixSsh(false);
      }, 5000);
    } catch (err) {
      setOutput(prev => prev + `\nFix failed: ${err.message}`);
      setInstalling(false);
    }
  };

  const handleInstallSingle = async (software) => {
    const instance = runningInstances.find(i => i.id === selectedInstanceId);
    if (!instance) return;

    setInstalling(true);
    setOutput(prev => prev + `\nInitiating installation of ${software} on ${instance.name} (${instance.ip})...\n`);
    
    try {
      const response = await fetch('http://localhost:8080/api/software/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: instance.ip,
          user: sshUser,
          password: softwarePassword,
          keyName: instance.keyName,
          softwareList: [software]
        })
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

  const fetchInstances = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/aws/instances?region=${region}`, {
        headers: {
          'X-AWS-Access-Key': credentials.accessKey,
          'X-AWS-Secret-Key': credentials.secretKey
        }
      });
      const data = await response.json();
      setRunningInstances(data);
      if (data.length > 0) setSelectedInstanceId(data[0].id);
    } catch (err) {
      console.warn('Could not fetch running instances');
    }
  };

  const handleInstallRedis = async () => {
    const instance = runningInstances.find(i => i.id === selectedInstanceId);
    if (!instance) return;

    setInstalling(true);
    setOutput(`Starting Redis installation on ${instance.name} (${instance.ip})...\n`);
    
    try {
      const response = await fetch('http://localhost:8080/api/software/install-redis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: instance.ip,
          user: sshUser,
          password: softwarePassword,
          keyName: resourceStack.find(r => r.instanceName === instance.name)?.keyPairName
        })
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

  useEffect(() => {
    document.body.className = isDarkMode ? 'dark' : 'light';
  }, [isDarkMode]);

  const [connecting, setConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleConnect = async () => {
    if (!credentials.accessKey || !credentials.secretKey) {
      setConnectionError('Please enter both Access Key and Secret Key.');
      return;
    }

    setConnecting(true);
    setConnectionError(null);
    try {
      const response = await fetch(`http://localhost:8080/api/aws/validate?region=${region}`, {
        headers: {
          'X-AWS-Access-Key': credentials.accessKey,
          'X-AWS-Secret-Key': credentials.secretKey
        }
      });

      if (response.ok) {
        setShowSuccessModal(true);
        fetchMetadata(`/regions`, setAvailableRegions);
        setTimeout(() => {
          setIsConnected(true);
          setShowSuccessModal(false);
        }, 2500);
      } else {
        const errorMsg = await response.text();
        setConnectionError(errorMsg.includes('InvalidClientTokenId') ? 'Invalid Access Key ID. Please check your credentials.' : 
                         errorMsg.includes('SignatureDoesNotMatch') ? 'Invalid Secret Access Key. Please check your credentials.' : 
                         `Connection Failed: ${errorMsg}`);
      }
    } catch (err) {
      setConnectionError('Could not reach the server. Please check your backend connection.');
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (activeService === 'Software' && isConnected) {
      fetchInstances();
    }
  }, [activeService, isConnected]);

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
      if (response.status === 401) {
        setIsConnected(false);
        setConnectionError('AWS Session Expired or Invalid Credentials. Please reconnect.');
        return;
      }
      if (!response.ok) throw new Error('Metadata fetch failed');
      const data = await response.json();
      setter(data);
      
      if (endpoint.includes('amis') && data.length > 0) {
        setFormData(prev => ({ ...prev, amiId: data[0].id }));
      }
      if (endpoint.includes('key-pairs') && data.length > 0) {
        setFormData(prev => ({ ...prev, keyPairName: data[0] }));
      }
      if (endpoint.includes('instance-types') && data.length > 0) {
        setFormData(prev => ({ ...prev, instanceType: data[0] }));
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
      selectedSoftware: activeService === 'EC2' ? [...formData.selectedSoftware] : [],
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
      
      setDeploymentStatus({ step: 'Success', status: 'success', message: 'Infrastructure & Software are being provisioned via Terraform!' });
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

      {showSuccessModal && (
        <div className="animate-fade" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.7)', zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(30px)' }}>
          <div style={{ background: 'var(--panel-bg)', padding: '4rem', borderRadius: '32px', border: '1px solid var(--success)', textAlign: 'center', maxWidth: '450px', width: '90%', boxShadow: '0 0 50px rgba(52, 199, 89, 0.2)' }}>
            <div className="animate-bounce" style={{ width: '80px', height: '80px', background: 'rgba(52, 199, 89, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
              <CheckCircle2 size={48} color="var(--success)" />
            </div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '12px' }}>Session Connected</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Successfully authenticated with <strong>{cloudProvider}</strong> in <strong>{region}</strong>.</p>
            <div style={{ marginTop: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--success)', fontWeight: 600 }}>
              <Loader2 size={16} className="animate-spin" /> Preparing Designer...
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
                <Server size={18} /> <span>EC2</span>
              </div>
              <div className={`nav-item ${activeService === 'S3' ? 'active' : ''}`} onClick={() => setActiveService('S3')}>
                <Database size={18} /> <span>S3</span>
              </div>
              <div className={`nav-item ${activeService === 'Software' ? 'active' : ''}`} onClick={() => setActiveService('Software')}>
                <Cpu size={18} /> <span>Software</span>
              </div>
              <div className={`nav-item ${activeService === 'PIPELINE' ? 'active' : ''}`} onClick={() => setActiveService('PIPELINE')}>
                <GitBranch size={18} /> <span>CI/CD</span>
              </div>
              <div className={`nav-item ${activeService === 'ELASTIC_BEANSTALK' ? 'active' : ''}`} onClick={() => setActiveService('ELASTIC_BEANSTALK')}>
                <Globe size={18} /> <span>Beanstalk</span>
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

              {connectionError && (
                <div className="animate-fade" style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--error)', padding: '16px', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--error)', textAlign: 'left', fontSize: '0.9rem' }}>
                  <AlertTriangle size={20} />
                  <span>{connectionError}</span>
                </div>
              )}
              
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
                  disabled={connecting}
                >
                  {connecting ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                  {connecting ? 'Verifying...' : 'Connect Securely'}
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

            {activeService === 'Software' ? (
              <div className="config-panel animate-fade">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                  <Cpu size={24} color="var(--accent-color)" />
                  <h2 style={{ margin: 0 }}>Software Manager</h2>
                </div>
                
                <div className="form-grid">
                  <div className="field-group">
                    <label>Target Instance</label>
                    <select 
                      value={selectedInstanceId} 
                      onChange={(e) => setSelectedInstanceId(e.target.value)}
                    >
                      {runningInstances.length === 0 ? <option>No running instances found</option> : 
                        runningInstances.map(inst => (
                          <option key={inst.id} value={inst.id}>{inst.name} ({inst.ip})</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="field-group">
                    <label>SSH User</label>
                    <input value={sshUser} onChange={(e) => setSshUser(e.target.value)} placeholder="e.g. ubuntu" />
                  </div>

                  <div className="field-group">
                    <label>SSH Password (Optional)</label>
                    <input type="password" value={softwarePassword} onChange={(e) => setSoftwarePassword(e.target.value)} placeholder="Leave blank if using Key (.pem)" />
                  </div>

                  <div className="field-group">
                    <label>Import Private Key (.pem)</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="file" 
                        accept=".pem" 
                        onChange={(e) => setPendingKeyFile(e.target.files[0])}
                        style={{ padding: '8px', fontSize: '0.8rem', background: 'var(--panel-bg)', borderRadius: '8px' }}
                      />
                      <button 
                        className="btn btn-primary" 
                        onClick={handleKeyUpload}
                        disabled={!pendingKeyFile}
                        style={{ whiteSpace: 'nowrap', padding: '0 16px' }}
                      >
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
                      {[
                        { id: 'Nodejs', icon: <Cpu size={18} />, desc: 'Modern JavaScript Runtime (Node.js 20 LTS)' },
                        { id: 'Java', icon: <Database size={18} />, desc: 'OpenJDK Development Kit (JDK)' },
                        { id: 'Python', icon: <Terminal size={18} />, desc: 'Python 3 with Pip & Dev Headers' },
                        { id: 'Laravel', icon: <Globe size={18} />, desc: 'PHP Stack with Composer for Laravel' },
                        { id: 'Redis', icon: <Database size={18} />, desc: 'High-performance In-memory Data Store' },
                        { id: 'Nginx', icon: <Globe size={18} />, desc: 'Professional Web Server & Reverse Proxy' },
                        { id: 'Kafka', icon: <Cpu size={18} />, desc: 'Distributed Event Streaming Platform' },
                        { id: 'Utilities', icon: <Server size={18} />, desc: 'Standard Linux Tools (git, curl, build-essential)' }
                      ].map(sw => (
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
                    <button className="btn" onClick={fetchInstances} style={{ border: '1px solid var(--panel-border)', fontSize: '0.8rem' }}>
                      <RefreshCw size={14} /> Refresh Machine List
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
                    <button 
                      className="btn btn-primary" 
                      style={{ background: '#FF9900', border: 'none', width: '100%' }}
                      onClick={handleFixSsh}
                      disabled={installing}
                    >
                      <Shield size={18} /> Fix Connection & Retry Installation
                    </button>
                  </div>
                )}

                <p style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Note: If using a machine created by this tool, the system will automatically use the <strong>.pem</strong> key from your session.
                </p>
              </div>
            ) : (
              <>
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
                        <div className="field-group" style={{ gridColumn: 'span 2', marginTop: '10px' }}>
                          <label>Magic Software Add-ons</label>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', padding: '16px', background: 'var(--input-bg)', borderRadius: '16px', border: '1px solid var(--panel-border)' }}>
                            {[
                              { id: 'Nodejs', icon: <Cpu size={14} /> },
                              { id: 'Java', icon: <Database size={14} /> },
                              { id: 'Python', icon: <Terminal size={14} /> },
                              { id: 'Laravel', icon: <Globe size={14} /> },
                              { id: 'Redis', icon: <Database size={14} /> },
                              { id: 'Nginx', icon: <Globe size={14} /> },
                              { id: 'Kafka', icon: <Cpu size={14} /> },
                              { id: 'Utilities', icon: <Server size={14} /> }
                            ].map(sw => (
                              <label key={sw.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.75rem' }}>
                                <input 
                                  type="checkbox" 
                                  checked={formData.selectedSoftware.includes(sw.id)} 
                                  onChange={() => toggleSoftware(sw.id)} 
                                />
                                {sw.icon} {sw.id}
                              </label>
                            ))}
                          </div>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                            Selected tools will be automatically installed and configured after provisioning.
                          </p>
                        </div>
                      </>
                      ) : activeService === 'PIPELINE' ? (
                        <>
                          <div className="field-group">
                            <label>Pipeline Name</label>
                            <input name="pipelineName" value={formData.pipelineName || ''} onChange={handleChange} placeholder="e.g. nodejs-prod-pipeline" />
                          </div>
                          <div className="field-group">
                            <label>GitHub Repo ID</label>
                            <input name="repoUrl" value={formData.repoUrl || ''} onChange={handleChange} placeholder="e.g. makhsodur/my-node-app" />
                          </div>
                          <div className="field-group">
                            <label>Source Branch</label>
                            <input name="branch" value={formData.branch || 'main'} onChange={handleChange} />
                          </div>
                          <div className="field-group">
                            <label>Target Instance</label>
                            <select name="targetInstanceId" value={formData.targetInstanceId || ''} onChange={handleChange}>
                              <option value="">-- Select Running EC2 --</option>
                              {runningInstances.map(instance => (
                                <option key={instance.id} value={instance.name}>{instance.name} ({instance.id})</option>
                              ))}
                            </select>
                            <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Only running instances in {region} are shown.</p>
                          </div>
                          <div className="field-group" style={{ gridColumn: 'span 2' }}>
                            <label>Build Commands (NPM)</label>
                            <textarea 
                              name="buildCommands" 
                              value={formData.buildCommands || 'npm test'} 
                              onChange={handleChange} 
                              placeholder="e.g. npm test && npm run build"
                              style={{ width: '100%', height: '80px', padding: '12px', background: 'var(--input-bg)', color: 'var(--text-primary)', border: '1px solid var(--panel-border)', borderRadius: '12px' }}
                            />
                          </div>
                        </>
                      ) : activeService === 'ELASTIC_BEANSTALK' ? (
                        <>
                          <div className="field-group">
                            <label>Application Name</label>
                            <input name="appName" value={formData.appName || ''} onChange={handleChange} placeholder="e.g. my-awesome-app" />
                          </div>
                          <div className="field-group">
                            <label>Environment Name</label>
                            <input name="environmentName" value={formData.environmentName || ''} onChange={handleChange} placeholder="e.g. my-awesome-app-prod" />
                          </div>
                          <div className="field-group">
                            <label>Platform (Solution Stack)</label>
                            <select name="platform" value={formData.platform || 'nodejs'} onChange={handleChange}>
                              <option value="nodejs">Node.js</option>
                              <option value="java">Java (Corretto)</option>
                              <option value="python">Python</option>
                              <option value="docker">Docker</option>
                            </select>
                          </div>
                          <div className="field-group">
                            <label>Environment Type</label>
                            <select name="envType" value={formData.envType || 'SingleInstance'} onChange={handleChange}>
                              <option value="SingleInstance">Single Instance (Free Tier / Dev)</option>
                              <option value="LoadBalanced">Load Balanced (Production)</option>
                            </select>
                          </div>
                          <div className="field-group">
                            <label>Instance Type</label>
                            <select name="instanceType" value={formData.instanceType || 't3.micro'} onChange={handleChange}>
                              <option value="t3.micro">t3.micro</option>
                              <option value="t2.micro">t2.micro</option>
                              <option value="t3.small">t3.small</option>
                            </select>
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
              </>
            )}
            
            {output && (
              <div className={`log-container animate-fade ${isLogMaximized ? 'maximized' : ''}`} style={{ marginTop: '32px' }}>
                <div className="terminal-header">
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FF5F56' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#FFBD2E' }}></div>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27C93F' }}></div>
                  </div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, opacity: 0.5, marginLeft: '12px', textTransform: 'uppercase' }}>
                    {activeService === 'Software' ? 'Execution Log' : 'Provisioning Log'}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button 
                      onClick={() => setOutput('')}
                      style={{ background: 'none', border: 'none', color: '#fff', opacity: 0.5, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.7rem' }}
                    >
                      <Trash2 size={12} /> Clear
                    </button>
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

export default App;
