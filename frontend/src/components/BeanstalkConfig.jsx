import React, { useState, useEffect } from 'react';
import {
  Globe, Server, HardDrive, Shield, Activity, RefreshCw,
  Settings, Layers, ChevronDown, ChevronUp, Plus, Trash2,
  CheckCircle2, Info, AlertTriangle, Zap, Lock
} from 'lucide-react';

/* ─── Reusable section wrapper ───────────────────────────────────────────── */
const Section = ({ icon, title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', marginBottom: '20px', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '18px 20px', cursor: 'pointer', userSelect: 'none', borderBottom: open ? '1px solid var(--border)' : 'none' }}
      >
        <span style={{ color: 'var(--accent)' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', flexGrow: 1 }}>{title}</span>
        {open ? <ChevronUp size={16} color="var(--text-2)" /> : <ChevronDown size={16} color="var(--text-2)" />}
      </div>
      {open && <div style={{ padding: '20px' }}>{children}</div>}
    </div>
  );
};

/* ─── Radio card ─────────────────────────────────────────────────────────── */
const RadioCard = ({ label, desc, checked, onClick }) => (
  <div
    onClick={onClick}
    style={{
      flex: 1, padding: '16px', border: checked ? '2px solid var(--accent)' : '1px solid var(--border)',
      borderRadius: 'var(--radius-md)', cursor: 'pointer', background: checked ? 'rgba(0,122,255,0.05)' : 'var(--input-bg)',
      transition: 'all 0.2s', position: 'relative'
    }}
  >
    {checked && <CheckCircle2 size={16} color="var(--accent)" style={{ position: 'absolute', top: 10, right: 10 }} />}
    <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
    {desc && <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.5 }}>{desc}</div>}
  </div>
);

/* ─── Field helpers ──────────────────────────────────────────────────────── */
const Field = ({ label, hint, children }) => (
  <div style={{ marginBottom: '20px' }}>
    <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>{label}</label>
    {hint && <div style={{ fontSize: '0.78rem', color: 'var(--text-2)', marginBottom: 6 }}>{hint}</div>}
    {children}
  </div>
);

const inputStyle = {
  width: '100%', maxWidth: '420px', padding: '10px 12px',
  background: 'var(--input-bg)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', fontSize: '0.9rem'
};

const selectStyle = { ...inputStyle };
const numberStyle = { ...inputStyle, maxWidth: '180px' };

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
const BeanstalkConfig = ({  formData,
  handleChange,
  availableVpcs = [],
  resourceStack = []
}) => {
  /* ── Env-var table state ── */
  const [envVarKey, setEnvVarKey] = useState('');
  const [envVarVal, setEnvVarVal] = useState('');

  /* ── Sensible defaults (mirrors AWS console) ── */
  useEffect(() => {
    const set = (name, value) => {
      if (formData[name] === undefined || formData[name] === '')
        handleChange({ target: { name, value } });
    };
    const setB = (name, value) => {
      if (formData[name] === undefined)
        handleChange({ target: { name, value, type: 'checkbox', checked: value } });
    };
    set('platform', 'nodejs');
    set('envType', 'LoadBalanced');
    set('instanceType', 't2.micro');
    set('minSize', 1);
    set('maxSize', 4);
    set('deploymentPolicy', 'Rolling');
    set('healthReporting', 'enhanced');
    set('rootVolumeType', 'gp3');
    set('rootVolumeSize', 8);
    set('updateLevel', 'minor');
    setB('managedUpdatesEnabled', true);
  }, []);

  /* ── Env-var helpers ── */
  const envVars = formData.environmentVariables || {};

  const addEnvVar = () => {
    if (!envVarKey.trim()) return;
    const updated = { ...envVars, [envVarKey.trim()]: envVarVal };
    handleChange({ target: { name: 'environmentVariables', value: updated } });
    setEnvVarKey(''); setEnvVarVal('');
  };

  const removeEnvVar = (key) => {
    const updated = { ...envVars };
    delete updated[key];
    handleChange({ target: { name: 'environmentVariables', value: updated } });
  };

  /* ── Helper: set a numeric field ── */
  const setNum = (name, val) =>
    handleChange({ target: { name, value: Number(val) } });

  const isLoadBalanced = (formData.envType || 'LoadBalanced') === 'LoadBalanced';

  return (
    <div style={{ color: 'var(--text-1)' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ padding: '0 0 24px 0' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
          <Globe size={28} color="var(--accent)" /> Create Elastic Beanstalk Environment
        </h2>
        <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: '0.9rem' }}>
          Configure a fully managed PaaS environment. All fields map directly to AWS Elastic Beanstalk Option Settings, generated as Terraform HCL.
        </p>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — Application & Environment Info
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Layers size={18} />} title="Application & Environment">

        <Field label="Application Name" hint="A logical container for your environments. Must be unique in your AWS account.">
          <input style={inputStyle} name="appName" value={formData.appName || ''} onChange={handleChange} placeholder="my-web-application" />
        </Field>

        <Field label="Environment Name" hint="A unique name for this environment (e.g. my-app-prod, my-app-staging).">
          <input style={inputStyle} name="environmentName" value={formData.environmentName || ''} onChange={handleChange} placeholder="my-web-application-prod" />
        </Field>

        <Field label="Platform (Solution Stack)" hint="The runtime that Beanstalk will provision on Amazon Linux 2023.">
          <select style={selectStyle} name="platform" value={formData.platform || 'nodejs'} onChange={handleChange}>
            <option value="nodejs">Node.js 20 — Amazon Linux 2023</option>
            <option value="java">Java / Corretto 21 — Amazon Linux 2023</option>
            <option value="python">Python 3.11 — Amazon Linux 2023</option>
            <option value="docker">Docker — Amazon Linux 2023</option>
          </select>
        </Field>

        <Field label="Environment Tier">
          <div style={{ display: 'flex', gap: 12, maxWidth: 580 }}>
            <RadioCard
              label="Web Server"
              desc="Runs your web application. Includes a load balancer and auto scaling group."
              checked={true}
              onClick={() => {}}
            />
          </div>
        </Field>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — Software (Environment Variables)
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Settings size={18} />} title="Software — Environment Variables">

        <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 16 }}>
          These are passed to your application as OS-level environment variables (e.g. <code>DB_URL</code>, <code>API_KEY</code>).
          Mapped to <code style={{ color: 'var(--accent)' }}>aws:elasticbeanstalk:application:environment</code>.
        </p>

        {/* Existing vars */}
        {Object.keys(envVars).length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {Object.entries(envVars).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, padding: '8px 12px', background: 'var(--input-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <code style={{ color: 'var(--accent)', fontWeight: 700, minWidth: 140 }}>{k}</code>
                <span style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>=</span>
                <span style={{ flexGrow: 1, fontFamily: 'monospace', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
                <Trash2 size={14} style={{ cursor: 'pointer', color: 'var(--error)', flexShrink: 0 }} onClick={() => removeEnvVar(k)} />
              </div>
            ))}
          </div>
        )}

        {/* Add new var */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>Key</label>
            <input
              style={{ ...inputStyle, maxWidth: '100%' }}
              value={envVarKey} onChange={e => setEnvVarKey(e.target.value)}
              placeholder="DATABASE_URL"
              onKeyDown={e => e.key === 'Enter' && addEnvVar()}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: 4, display: 'block' }}>Value</label>
            <input
              style={{ ...inputStyle, maxWidth: '100%' }}
              value={envVarVal} onChange={e => setEnvVarVal(e.target.value)}
              placeholder="postgres://..."
              onKeyDown={e => e.key === 'Enter' && addEnvVar()}
            />
          </div>
          <button
            onClick={addEnvVar}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
          >
            <Plus size={14} /> Add
          </button>
        </div>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — Instances
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Server size={18} />} title="Instances">

        <Field label="Instance Type" hint="The EC2 instance type for all instances in this environment.">
          <select style={selectStyle} name="instanceType" value={formData.instanceType || 't2.micro'} onChange={handleChange}>
            <optgroup label="Burstable (T-series)">
              <option value="t2.micro">t2.micro — 1 vCPU, 1 GiB (Free Tier)</option>
              <option value="t3.micro">t3.micro — 2 vCPU, 1 GiB</option>
              <option value="t3.small">t3.small — 2 vCPU, 2 GiB</option>
              <option value="t3.medium">t3.medium — 2 vCPU, 4 GiB</option>
              <option value="t3.large">t3.large — 2 vCPU, 8 GiB</option>
            </optgroup>
            <optgroup label="General Purpose (M-series)">
              <option value="m5.large">m5.large — 2 vCPU, 8 GiB</option>
              <option value="m5.xlarge">m5.xlarge — 4 vCPU, 16 GiB</option>
              <option value="m6i.large">m6i.large — 2 vCPU, 8 GiB</option>
            </optgroup>
            <optgroup label="Compute Optimised (C-series)">
              <option value="c5.large">c5.large — 2 vCPU, 4 GiB</option>
              <option value="c6i.large">c6i.large — 2 vCPU, 4 GiB</option>
            </optgroup>
          </select>
        </Field>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <Field label="Root Volume Type" hint="Storage type for the EC2 root volume.">
            <select style={selectStyle} name="rootVolumeType" value={formData.rootVolumeType || 'gp3'} onChange={handleChange}>
              <option value="gp3">General Purpose SSD (gp3) — Recommended</option>
              <option value="gp2">General Purpose SSD (gp2)</option>
              <option value="io1">Provisioned IOPS (io1)</option>
            </select>
          </Field>
          <Field label="Root Volume Size (GiB)" hint="Size of the EC2 root volume.">
            <input style={numberStyle} type="number" min={8} max={1024}
              value={formData.rootVolumeSize || 8}
              onChange={e => setNum('rootVolumeSize', e.target.value)}
            />
          </Field>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: 'rgba(0,122,255,0.07)', border: '1px solid rgba(0,122,255,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-2)' }}>
          <Lock size={14} color="var(--accent)" />
          <span><strong style={{ color: 'var(--accent)' }}>IMDSv2 Enforced</strong> — Instance Metadata Service v1 is automatically disabled per 2026 security standards.</span>
        </div>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 4 — Capacity & Auto Scaling
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Zap size={18} />} title="Capacity & Auto Scaling">

        <Field label="Environment Type">
          <div style={{ display: 'flex', gap: 12, maxWidth: 580 }}>
            <RadioCard
              label="Single Instance"
              desc="One EC2 instance. No load balancer. Ideal for dev/test."
              checked={!isLoadBalanced}
              onClick={() => handleChange({ target: { name: 'envType', value: 'SingleInstance' } })}
            />
            <RadioCard
              label="Load Balanced"
              desc="Auto Scaling Group + Application Load Balancer. For production workloads."
              checked={isLoadBalanced}
              onClick={() => handleChange({ target: { name: 'envType', value: 'LoadBalanced' } })}
            />
          </div>
        </Field>

        {isLoadBalanced && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Field label="Minimum Instances" hint="The ASG will never scale below this.">
                <input style={numberStyle} type="number" min={1} max={100}
                  value={formData.minSize || 1}
                  onChange={e => setNum('minSize', e.target.value)}
                />
              </Field>
              <Field label="Maximum Instances" hint="The ASG will never scale above this.">
                <input style={numberStyle} type="number" min={1} max={100}
                  value={formData.maxSize || 4}
                  onChange={e => setNum('maxSize', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Load Balancer Type">
              <div style={{ display: 'flex', gap: 12, maxWidth: 580 }}>
                <RadioCard label="Application (ALB)" desc="HTTP/HTTPS, path-based routing. Recommended for web apps." checked={true} onClick={() => {}} />
                <RadioCard label="Network (NLB)" desc="TCP/UDP, ultra-low latency for non-HTTP workloads." checked={false} onClick={() => {}} />
              </div>
            </Field>
          </>
        )}

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 5 — Deployments
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<RefreshCw size={18} />} title="Deployment Policy">

        <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginBottom: 16 }}>
          Controls how new application versions are deployed to instances.
          Mapped to <code style={{ color: 'var(--accent)' }}>aws:elasticbeanstalk:command → DeploymentPolicy</code>.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { value: 'AllAtOnce', label: 'All at once', desc: 'Fastest. Deploys to all instances simultaneously. Causes downtime.' },
            { value: 'Rolling', label: 'Rolling', desc: 'Deploys in batches. Reduces downtime but briefly lowers capacity.' },
            { value: 'RollingWithAdditionalBatch', label: 'Rolling with extra batch', desc: 'Adds a new batch before removing old. Maintains full capacity.' },
            { value: 'Immutable', label: 'Immutable', desc: 'Launches a fresh parallel fleet. Safest, but slowest and costliest.' },
          ].map(p => (
            <RadioCard
              key={p.value}
              label={p.label}
              desc={p.desc}
              checked={(formData.deploymentPolicy || 'Rolling') === p.value}
              onClick={() => handleChange({ target: { name: 'deploymentPolicy', value: p.value } })}
            />
          ))}
        </div>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 6 — Monitoring & Health
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Activity size={18} />} title="Monitoring & Health Reporting">

        <Field label="Health Reporting System" hint="Enhanced health provides real-time metrics per instance, beyond basic EC2 status checks.">
          <div style={{ display: 'flex', gap: 12, maxWidth: 580 }}>
            <RadioCard
              label="Enhanced"
              desc="Detailed health data sent to CloudWatch. Required for Managed Updates. Recommended."
              checked={(formData.healthReporting || 'enhanced') === 'enhanced'}
              onClick={() => handleChange({ target: { name: 'healthReporting', value: 'enhanced' } })}
            />
            <RadioCard
              label="Basic"
              desc="EC2 instance status checks only. No per-request metrics."
              checked={formData.healthReporting === 'basic'}
              onClick={() => handleChange({ target: { name: 'healthReporting', value: 'basic' } })}
            />
          </div>
        </Field>

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 7 — Managed Platform Updates
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<Shield size={18} />} title="Managed Platform Updates">

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <input
            type="checkbox" id="managedUpdatesEnabled"
            checked={formData.managedUpdatesEnabled !== false}
            onChange={e => handleChange({ target: { name: 'managedUpdatesEnabled', value: e.target.checked, type: 'checkbox', checked: e.target.checked } })}
            style={{ width: 16, height: 16 }}
          />
          <label htmlFor="managedUpdatesEnabled" style={{ fontWeight: 600 }}>
            Enable managed platform updates
          </label>
        </div>

        {formData.managedUpdatesEnabled !== false && (
          <>
            <Field label="Update Level" hint="The type of platform updates that Elastic Beanstalk applies.">
              <select style={selectStyle} name="updateLevel" value={formData.updateLevel || 'minor'} onChange={handleChange}>
                <option value="patch">Patch — Only patch releases (e.g. 3.5.1 → 3.5.2). Safest.</option>
                <option value="minor">Minor — Minor + patch releases (e.g. 3.5.x → 3.6.x). Recommended.</option>
              </select>
            </Field>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'rgba(52,199,89,0.08)', border: '1px solid rgba(52,199,89,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-2)' }}>
              <Info size={14} color="#34C759" style={{ marginTop: 1, flexShrink: 0 }} />
              <span>Updates are applied weekly during the maintenance window: <strong style={{ color: 'var(--text-1)' }}>Sunday 02:00 UTC</strong>. Instances are updated in a rolling fashion with zero downtime.</span>
            </div>
          </>
        )}

      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 8 — Networking (VPC)
      ══════════════════════════════════════════════════════════════════ */}
      <Section icon={<HardDrive size={18} />} title="Networking & VPC">

        <Field
          label="Selected VPC"
          hint="Select a VPC. Public subnets are used for the ALB; private subnets for EC2 instances."
        >
          <select
            style={selectStyle} name="selectedVpc"
            value={formData.selectedVpc || ''}
            onChange={handleChange}
          >
            <option value="">Use Default VPC (AWS Default)</option>
            {resourceStack.filter(r => r.serviceType === 'VPC').map(vpc => (
              <option key={`stack-${vpc.id}`} value={vpc.vpcName}>
                Custom (In Stack): {vpc.vpcName}
              </option>
            ))}
            {availableVpcs.map(vpc => (
              <option key={`aws-${vpc.vpcId}`} value={vpc.name || vpc.vpcId}>
                {vpc.label}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 14px', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--text-2)' }}>
          <AlertTriangle size={14} color="#FF9F0A" style={{ marginTop: 1, flexShrink: 0 }} />
          <span>For a <strong>Load Balanced</strong> environment, public subnets (tagged <code>*-public-*</code>) must exist in at least <strong>2 Availability Zones</strong> for the ALB to work correctly.</span>
        </div>

      </Section>

    </div>
  );
};

export default BeanstalkConfig;
