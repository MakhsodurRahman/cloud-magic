import React, { useState, useEffect } from 'react';
import {
  Box, Shield, Globe, Cloud, CheckCircle2, Loader2, Plus, Play,
  AlertTriangle, Trash2, Sun, Moon, Server, Database, Zap, Layers
} from 'lucide-react';

import Sidebar from './components/Sidebar';
import TerraformSidebar from './components/TerraformSidebar';
import InfrastructureHub from './components/InfrastructureHub';
import SoftwareManager from './components/SoftwareManager';
import AccountExplorer from './components/AccountExplorer';

/* ─── Provider definitions ─────────────────────────────────────────────────── */
const PROVIDERS = [
  { id: 'AWS', name: 'Amazon Web Services', tagline: 'The industry leader', icon: <Box size={34} />, color: '#FF9900', bg: 'rgba(255,153,0,0.12)' },
  { id: 'Azure', name: 'Microsoft Azure', tagline: 'Enterprise cloud', icon: <Cloud size={34} />, color: '#0089D6', bg: 'rgba(0,137,214,0.12)' },
  { id: 'GCP', name: 'Google Cloud', tagline: 'Data & AI platform', icon: <Globe size={34} />, color: '#4285F4', bg: 'rgba(66,133,244,0.12)' },
];

const REGIONS = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-south-1', 'ap-southeast-1', 'sa-east-1'];

const DEPLOY_STEPS = ['Initializing', 'Validating', 'Planning', 'Applying'];

export default function App() {
  /* ── Stages ── */
  const [stage, setStage] = useState('landing'); // 'landing' | 'login' | 'dashboard'
  const [cloudProvider, setCloudProvider] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  /* ── Auth ── */
  const [credentials, setCredentials] = useState({ accessKey: '', secretKey: '' });
  const [orgName, setOrgName] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [connecting, setConnecting] = useState(false);
  const [authError, setAuthError] = useState('');

  /* ── Theme ── */
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => { document.body.className = isDarkMode ? 'dark' : 'light'; }, [isDarkMode]);

  /* ── Navigation ── */
  const [activeService, setActiveService] = useState('INFRASTRUCTURE');
  const [selectedService, setSelectedService] = useState(null); // service selected inside InfrastructureHub

  /* ── AWS Metadata ── */
  const [availableRegions, setAvailableRegions] = useState(REGIONS);
  const [availableAmis, setAvailableAmis] = useState([]);
  const [availableInstanceTypes, setAvailableInstanceTypes] = useState(['t3.micro', 't2.micro', 't3.small']);
  const [availableKeyPairs, setAvailableKeyPairs] = useState([]);
  const [runningInstances, setRunningInstances] = useState([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');

  /* ── Form ── */
  const [formData, setFormData] = useState({
    instanceName: 'MyMagicInstance', amiId: '', instanceType: 't3.micro',
    keyPairName: 'my-key-pair', keyPairSelection: 'existing',
    securityGroupPorts: '22, 80', ebsVolumeSize: 20,
    bucketName: 'my-magic-bucket-' + Math.floor(Math.random() * 9999),
    acl: 'private', selectedSoftware: [],
    pipelineName: 'my-app-pipeline', repoUrl: '', branch: 'main',
    targetInstanceId: '', buildCommands: 'npm test',
    appName: 'my-beanstalk-app', environmentName: 'my-beanstalk-env',
    platform: 'nodejs', envType: 'SingleInstance',
  });
  const [resourceStack, setResourceStack] = useState([]);

  /* ── Software ── */
  const [sshUser, setSshUser] = useState('ubuntu');
  const [softwarePassword, setSoftwarePassword] = useState('');
  const [pendingKeyFile, setPendingKeyFile] = useState(null);

  /* ── Deployment ── */
  const [deploying, setDeploying] = useState(false);
  const [deployStep, setDeployStep] = useState('');
  const [output, setOutput] = useState('');
  const [isLogMax, setIsLogMax] = useState(false);
  const [terraformCode, setTerraformCode] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  /* ── Explore ── */
  const [explorationData, setExplorationData] = useState(null);
  const [loadingExplore, setLoadingExplore] = useState(false);

  /* ─── Helpers ──────────────────────────────────────────────────────────── */
  const hdrs = () => ({
    'X-AWS-Access-Key': credentials.accessKey,
    'X-AWS-Secret-Key': credentials.secretKey,
  });

  const fetchMeta = async (endpoint, setter, autoSet) => {
    try {
      const res = await fetch(`http://localhost:8080/api/aws${endpoint}`, { headers: hdrs() });
      if (!res.ok) return;
      const data = await res.json();
      setter(data);
      if (autoSet && data.length > 0) setFormData(p => ({ ...p, ...autoSet(data) }));
    } catch { }
  };

  const fetchInstances = async () => {
    try {
      const res = await fetch(`http://localhost:8080/api/aws/instances?region=${region}`, { headers: hdrs() });
      const data = await res.json();
      setRunningInstances(data);
      if (data.length > 0) setSelectedInstanceId(data[0].id);
    } catch { }
  };

  const generateCode = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/terraform/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, resources: resourceStack, cloudProvider, orgName, accessKey: credentials.accessKey, secretKey: credentials.secretKey }),
      });
      setTerraformCode(await res.text());
    } catch { }
  };

  /* ─── Effects ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (isConnected && cloudProvider === 'AWS' && region) {
      fetchMeta(`/amis?region=${region}`, setAvailableAmis, d => ({ amiId: d[0].id }));
      fetchMeta(`/instance-types?region=${region}`, setAvailableInstanceTypes, d => ({ instanceType: d[0] }));
      fetchMeta(`/key-pairs?region=${region}`, setAvailableKeyPairs, d => ({ keyPairName: d[0] }));
    }
  }, [region, cloudProvider, isConnected]);

  useEffect(() => {
    if (activeService === 'Software' && isConnected) fetchInstances();
  }, [activeService, isConnected]);

  useEffect(() => {
    if (activeService === 'EXPLORE' && isConnected) handleExplore();
  }, [activeService, isConnected, region]);

  useEffect(() => {
    if (isConnected && resourceStack.length >= 0) {
      const t = setTimeout(generateCode, 400);
      return () => clearTimeout(t);
    }
  }, [resourceStack, region, cloudProvider, isConnected]);

  /* ─── Handlers ─────────────────────────────────────────────────────────── */
  const selectProvider = (id) => {
    setCloudProvider(id);
    setStage('login');
    setAuthError('');
  };

  const handleConnect = async () => {
    if (!credentials.accessKey || !credentials.secretKey) {
      setAuthError('Please enter both Access Key and Secret Key.'); return;
    }
    setConnecting(true); setAuthError('');
    try {
      const res = await fetch(`http://localhost:8080/api/aws/validate?region=${region}`, { headers: hdrs() });
      if (res.ok) {
        fetchMeta('/regions', setAvailableRegions);
        setIsConnected(true);
        setStage('dashboard');
        // Small delay to ensure state is committed before heavy dashboard rendering
        setTimeout(() => fetchSavedStack(), 100);
      } else {
        const msg = await res.text();
        setAuthError(msg.length > 100 ? 'Authentication failed. Check your keys.' : msg);
      }
    } catch (err) {
      console.error('Login error:', err);
      setAuthError('Cannot reach the backend server.');
    }
    finally { setConnecting(false); }
  };

  const fetchSavedStack = async () => {
    try {
      const res = await fetch(`http://localhost:8080/api/terraform/get-stack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgName: orgName || 'default',
          accessKey: credentials.accessKey,
          secretKey: credentials.secretKey,
          region
        })
      });
      if (res.ok) {
        const saved = await res.json();
        if (Array.isArray(saved)) {
          // If any item is missing an ID (legacy data), assign one now
          const repaired = saved.map(item => item.id ? item : { ...item, id: Date.now() + Math.random() });
          setResourceStack(repaired);
        }
      }
    } catch (err) {
      console.error('Failed to fetch saved stack:', err);
    }
  };

  const handleRefreshStack = fetchSavedStack;

  const handleLogout = () => {
    setCloudProvider(null); setIsConnected(false);
    setStage('landing'); setCredentials({ accessKey: '', secretKey: '' });
    setOrgName('');
    setTerraformCode(''); setResourceStack([]); setOutput('');
  };

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setFormData(p => ({ ...p, [name]: type === 'checkbox' ? checked : value }));
  };

  const toggleSoftware = sw => setFormData(p => ({
    ...p, selectedSoftware: p.selectedSoftware.includes(sw)
      ? p.selectedSoftware.filter(s => s !== sw) : [...p.selectedSoftware, sw],
  }));

  const addToStack = (serviceType) => {
    const ports = typeof formData.securityGroupPorts === 'string'
      ? formData.securityGroupPorts.split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p))
      : [];

    const resourceData = {
      ...formData,
      securityGroupPorts: ports,
      ebsVolumeSize: parseInt(formData.ebsVolumeSize) || 20,
      selectedSoftware: serviceType === 'EC2' ? [...formData.selectedSoftware] : [],
      serviceType,
    };

    setResourceStack(prev => {
      // If we're editing (id exists in formData), replace it
      if (formData.id) {
        return prev.map(r => r.id === formData.id ? { ...resourceData, id: formData.id } : r);
      }
      // Otherwise add new
      return [...prev, { ...resourceData, id: Date.now() }];
    });

    // Reset form ID after adding/updating
    setFormData(p => {
      const { id, ...rest } = p;
      return rest;
    });
  };

  const editStackItem = (item) => {
    setFormData({ ...item, securityGroupPorts: item.securityGroupPorts.join(', ') });
    setSelectedService(item.serviceType);
  };

  const removeFromStack = async (res) => {
    try {
      const type = (res.serviceType || 'unknown').toLowerCase();
      const name = res.bucketName || res.instanceName || res.appName || res.environmentName || res.name;
      
      if (!name) return;

      // Reconstruct module folder name (must match backend's getModuleName)
      const safeName = name.replaceAll(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
      const moduleName = `${type}_${safeName}`;

      console.log(`Attempting physical deletion of module: ${moduleName} for org: ${orgName}`);

      const response = await fetch(`http://localhost:8080/api/terraform/delete-module?moduleName=${moduleName}&orgName=${orgName || ''}`, {
        method: 'POST',
        headers: hdrs()
      });
      
      if (!response.ok) {
        console.warn("Backend failed to delete folder physically. Folder might not exist.");
      }
      
      await handleRefreshStack();
    } catch (err) {
      console.error("Failed to physically delete module:", err);
    }
  };

  const handleSelectResource = async (res) => {
    setShowPreview(true); // Open the preview panel
    setTerraformCode("# Loading code from disk...");
    try {
      const type = res.serviceType.toLowerCase();
      const name = res.instanceName || res.bucketName || res.appName || res.environmentName || res.name;
      // Re-construct the exact folder name used on disk
      const safeName = name.replaceAll(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
      const moduleName = `${type}_${safeName}`;

      const response = await fetch(`http://localhost:8080/api/terraform/preview-resource?moduleName=${moduleName}&orgName=${orgName}`, {
        method: 'POST',
        headers: hdrs()
      });
      setTerraformCode(await response.text());
    } catch (err) {
      setTerraformCode("# Error loading code from disk.");
    }
  };

  const handleDeploy = async () => {
    if (!resourceStack.length) { setOutput('⚠ Add at least one resource before deploying.\n'); return; }
    setDeploying(true); setOutput('Starting deployment...\n');
    const steps = [
      { label: 'Initializing', ep: '/init' },
      { label: 'Validating', ep: '/validate' },
      { label: 'Planning', ep: '/plan' },
      { label: 'Applying', ep: '/apply' },
    ];
    try {
      for (const step of steps) {
        setDeployStep(step.label);
        setOutput(prev => prev + `\n── ${step.label} ──\n`);
        const res = await fetch(`http://localhost:8080/api/terraform${step.ep}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ region, resources: resourceStack, cloudProvider, orgName, accessKey: credentials.accessKey, secretKey: credentials.secretKey }),
        });
        const text = await res.text();
        setOutput(prev => prev + text + '\n');
        if (!res.ok) throw new Error(`${step.label} failed`);
      }
      setDeployStep('Done');
    } catch (err) {
      setDeployStep('Failed');
      setOutput(prev => prev + `\n✗ Deployment aborted: ${err.message}`);
    } finally { setDeploying(false); }
  };

  const handleDestroy = async () => {
    if (!window.confirm('WARNING: This will permanently destroy ALL managed resources in this organization. Continue?')) return;

    setDeploying(true); setDeployStep('Destroying'); setOutput('Starting infrastructure destruction...\n');
    try {
      const res = await fetch(`http://localhost:8080/api/terraform/destroy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region, resources: resourceStack, cloudProvider, orgName, accessKey: credentials.accessKey, secretKey: credentials.secretKey }),
      });
      const text = await res.text();
      setOutput(prev => prev + text + '\n');
      if (res.ok) {
        setResourceStack([]);
        setDeployStep('Destroyed');
      } else {
        throw new Error('Destruction failed');
      }
    } catch (err) {
      setDeployStep('Failed');
      setOutput(prev => prev + `\n✗ Destruction aborted: ${err.message}`);
    } finally { setDeploying(false); }
  };

  const handleExplore = async () => {
    setLoadingExplore(true); setExplorationData(null);
    try {
      const res = await fetch(`http://localhost:8080/api/aws/explore?region=${region}`, { headers: hdrs() });
      setExplorationData(await res.json());
    } catch { setExplorationData({ error: 'Failed to explore account.' }); }
    finally { setLoadingExplore(false); }
  };

  const handleInstanceAction = async (instanceId, action) => {
    try {
      const res = await fetch(`http://localhost:8080/api/aws/instance-action?action=${action}&instanceId=${instanceId}&region=${region}`, {
        method: 'POST',
        headers: hdrs()
      });
      if (res.ok) {
        // If terminated, also delete the Terraform module if it matches this instance
        if (action === 'terminate') {
          const instance = explorationData?.instances?.find(i => i.id === instanceId);
          if (instance) {
             await removeFromStack({ serviceType: 'EC2', instanceName: instance.name || instanceId });
          }
        }
        await handleRefreshStack();
        await handleExplore();
      } else {
        alert(await res.text());
      }
    } catch (err) { alert('Action failed: ' + err.message); }
  };

  const handleDeleteBucket = async (bucketName) => {
    try {
      const res = await fetch(`http://localhost:8080/api/aws/s3-bucket?bucketName=${bucketName}&region=${region}`, {
        method: 'DELETE',
        headers: hdrs()
      });
      if (res.ok) {
        // Physically delete the module from Terraform disk
        await removeFromStack({ serviceType: 'S3', bucketName: bucketName });
        await handleRefreshStack();
        await handleExplore();
      } else {
        alert(await res.text());
      }
    } catch (err) { alert('Delete failed: ' + err.message); }
  };


  /* ─── STAGE 0: Landing ─────────────────────────────────────────────────── */
  if (stage === 'landing') return (
    <div className="app-stage-landing">
      {/* Theme btn top-right */}
      <button className="theme-btn" onClick={() => setIsDarkMode(!isDarkMode)} style={{ position: 'absolute', top: '24px', right: '24px' }}>
        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="landing-page animate-fade">
        {/* Badge */}
        <div className="landing-badge">
          <Zap size={12} /> Cloud Infrastructure Platform
        </div>

        {/* Hero */}
        <div>
          <h1 className="landing-title">CloudMagic</h1>
          <p className="landing-sub" style={{ margin: '16px auto 0' }}>
            Provision, deploy, and manage cloud infrastructure — visually, without the complexity.
          </p>
        </div>

        {/* Provider cards */}
        <div>
          <p style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-2)', fontWeight: 700, marginBottom: '16px' }}>
            Select a Provider to Begin
          </p>
          <div className="provider-grid">
            {PROVIDERS.map(pv => (
              <div key={pv.id} className="provider-card" onClick={() => selectProvider(pv.id)}>
                <div className="provider-icon" style={{ background: pv.bg }}>
                  <span style={{ color: pv.color }}>{pv.icon}</span>
                </div>
                <div>
                  <h3>{pv.name}</h3>
                  <p>{pv.tagline}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ fontSize: '0.78rem', color: 'var(--text-2)' }}>
          Session-based auth · No local config required · Terraform-powered
        </p>
      </div>
    </div>
  );

  /* ─── STAGE 1: Login ───────────────────────────────────────────────────── */
  if (stage === 'login') {
    const pv = PROVIDERS.find(p => p.id === cloudProvider);
    return (
      <div className="app-stage-landing">
        {/* Theme btn */}
        <button className="theme-btn" onClick={() => setIsDarkMode(!isDarkMode)} style={{ position: 'absolute', top: '24px', right: '24px' }}>
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        <div className="login-card animate-fade" style={{ maxWidth: '460px', width: '100%' }}>
          <button onClick={() => { setStage('landing'); setCloudProvider(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ← Back
          </button>

          {/* Provider header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: pv.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: pv.color }}>
              {pv.icon}
            </div>
            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Connect to {pv.name}</h2>
              <p style={{ color: 'var(--text-2)', fontSize: '0.88rem' }}>Secure session-based auth</p>
            </div>
          </div>

          {authError && (
            <div className="alert-error animate-fade" style={{ marginBottom: '20px' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          <div className="form-grid">
            <div className="field-group">
              <label className="field-label">Organisation Name</label>
              <input
                type="text"
                id="orgName"
                placeholder="e.g. acme-corp"
                value={orgName}
                onChange={e => setOrgName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-2)', marginTop: '4px', display: 'block' }}>
                Used to organise your Terraform workspace. Optional.
              </span>
            </div>
            <div className="field-group">
              <label className="field-label">Access Key ID</label>
              <input type="password" placeholder="AKIAXXXXXXXXXXXXXXXX" value={credentials.accessKey}
                onChange={e => setCredentials({ ...credentials, accessKey: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Secret Access Key</label>
              <input type="password" placeholder="••••••••••••••••••••••••••••••••" value={credentials.secretKey}
                onChange={e => setCredentials({ ...credentials, secretKey: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleConnect()}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Default Region</label>
              <select value={region} onChange={e => setRegion(e.target.value)}>
                {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <button className="btn btn-primary" style={{ marginTop: '8px', height: '50px', width: '100%', fontSize: '0.95rem' }} onClick={handleConnect} disabled={connecting}>
              {connecting ? <><Loader2 size={17} className="animate-spin" /> Verifying...</> : <><Shield size={17} /> Connect Securely</>}
            </button>
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--text-2)', textAlign: 'center', marginTop: '20px' }}>
            Credentials are used only for this session and never stored.
          </p>
        </div>
      </div>
    );
  }

  /* ─── STAGE 2: Dashboard ─────────────────────────────────────── */
  // Show the terraform right-panel when a service is selected, deploying, OR previewing a stack item
  const showTerraformPanel = !!selectedService || deploying || showPreview;

  return (
    <div className={showTerraformPanel ? 'app-stage-dashboard' : 'app-stage-dashboard-slim'}>

      {/* Deployment overlay */}
      {deploying && (
        <div className="provision-overlay">
          <div className="provision-card animate-fade">
            <div style={{ textAlign: 'center' }}>
              <Loader2 size={52} className="animate-spin" color="var(--accent)" />
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginTop: '20px' }}>{deployStep}</h2>
              <p style={{ color: 'var(--text-2)', marginTop: '8px' }}>Provisioning infrastructure on {cloudProvider}...</p>
            </div>
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {DEPLOY_STEPS.map(step => {
                const idx = DEPLOY_STEPS.indexOf(step);
                const cur = DEPLOY_STEPS.indexOf(deployStep);
                const done = cur > idx;
                const active = cur === idx;
                return (
                  <div key={step} className="step-row" style={{ opacity: done || active ? 1 : 0.3 }}>
                    <div className="step-dot" style={{ background: done ? 'var(--success)' : active ? 'var(--accent)' : '#444' }}>
                      {done ? <CheckCircle2 size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : null}
                    </div>
                    <span style={{ fontWeight: active ? 700 : 400, fontSize: '0.9rem' }}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Left sidebar */}
      <Sidebar
        isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode}
        activeService={activeService} setActiveService={setActiveService}
        cloudProvider={cloudProvider} setCloudProvider={setCloudProvider}
        setIsConnected={handleLogout}
        resourceStack={resourceStack} removeFromStack={removeFromStack}
        onPreviewResource={handleSelectResource}
        setShowPreview={setShowPreview}
      />

      {/* Main content */}
      <main className="main-content">
        {/* Session bar */}
        <div className="session-bar">
          <CheckCircle2 size={16} color="var(--success)" />
          <span style={{ flexGrow: 1 }}>Connected to <strong>{cloudProvider}</strong> · {region}</span>
          {orgName && (
            <span style={{ fontSize: '0.72rem', fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#818cf8', padding: '3px 10px', borderRadius: '20px', letterSpacing: '0.3px' }}>
              🏢 {orgName}
            </span>
          )}
          <select value={region} onChange={e => setRegion(e.target.value)} style={{ width: 'auto', padding: '4px 10px', fontSize: '0.82rem', border: '1px solid rgba(48,209,88,0.3)', background: 'transparent', borderRadius: 'var(--radius-sm)' }}>
            {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Feature routing */}
        {activeService === 'EXPLORE' ? (
          <AccountExplorer
            region={region}
            explorationData={explorationData}
            loadingExploration={loadingExplore}
            onRefresh={handleExplore}
            onInstanceAction={handleInstanceAction}
            onDeleteBucket={handleDeleteBucket}
          />
        ) : activeService === 'Software' ? (
          <SoftwareManager
            runningInstances={runningInstances} selectedInstanceId={selectedInstanceId} setSelectedInstanceId={setSelectedInstanceId}
            sshUser={sshUser} setSshUser={setSshUser} softwarePassword={softwarePassword} setSoftwarePassword={setSoftwarePassword}
            credentials={credentials} region={region} setOutput={setOutput}
            pendingKeyFile={pendingKeyFile} setPendingKeyFile={setPendingKeyFile} formData={formData}
          />
        ) : (
          <InfrastructureHub
            formData={formData} handleChange={handleChange}
            toggleSoftware={toggleSoftware}
            availableAmis={availableAmis} availableInstanceTypes={availableInstanceTypes} availableKeyPairs={availableKeyPairs}
            runningInstances={runningInstances} region={region}
            resourceStack={resourceStack} addToStack={addToStack} removeFromStack={removeFromStack}
            deploying={deploying} handleDeploy={handleDeploy} handleDestroy={handleDestroy}
            cloudProvider={cloudProvider}
            output={output} isLogMax={isLogMax} setIsLogMax={setIsLogMax} setOutput={setOutput}
            selectedService={selectedService} setSelectedService={setSelectedService}
            editStackItem={editStackItem}
          />
        )}
      </main>

      {/* Right sidebar: only when a service is configured or deploying */}
      {showTerraformPanel && <TerraformSidebar terraformCode={terraformCode} deploying={deploying} />}
    </div>
  );
}
