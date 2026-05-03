import React, { useState, useEffect } from 'react';
import { Database, AlertTriangle, Loader2, Info, CheckCircle2, Server, HardDrive, Shield } from 'lucide-react';

const RdsConfig = ({ formData, handleChange, region }) => {
  const [engines, setEngines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Advanced AWS-like state defaults
  useEffect(() => {
    if (!formData.creationMethod) handleChange({ target: { name: 'creationMethod', value: 'standard' } });
    if (!formData.rdsTemplate) handleChange({ target: { name: 'rdsTemplate', value: 'devtest' } });
    if (!formData.storageType) handleChange({ target: { name: 'storageType', value: 'gp3' } });
    if (formData.multiAz === undefined) handleChange({ target: { name: 'multiAz', value: false, type: 'checkbox' } });
    if (formData.storageAutoscaling === undefined) handleChange({ target: { name: 'storageAutoscaling', value: true, type: 'checkbox' } });
    if (!formData.maxAllocatedStorage) handleChange({ target: { name: 'maxAllocatedStorage', value: 1000 } });
    if (formData.autoGeneratePassword === undefined) handleChange({ target: { name: 'autoGeneratePassword', value: false, type: 'checkbox' } });
  }, []);

  useEffect(() => {
    const fetchEngines = async () => {
      try {
        setLoading(true);
        const ak = localStorage.getItem('aws_access_key') || '';
        const sk = localStorage.getItem('aws_secret_key') || '';
        const r = region || 'us-east-1';

        const res = await fetch(`http://localhost:8080/api/aws/rds-engines?region=${r}`, {
          headers: { 'X-AWS-Access-Key': ak, 'X-AWS-Secret-Key': sk }
        });

        if (res.ok) {
          const data = await res.json();
          const uniqueEngines = [];
          const seen = new Set();
          for (const eng of data) {
            // Group logical engines
            let baseEngine = eng.engine;
            if (baseEngine.includes('postgres')) baseEngine = 'postgres';
            if (baseEngine.includes('mysql')) baseEngine = 'mysql';
            if (baseEngine.includes('mariadb')) baseEngine = 'mariadb';
            if (baseEngine.includes('sqlserver')) baseEngine = 'sqlserver';
            if (baseEngine.includes('oracle')) baseEngine = 'oracle';

            if (!seen.has(baseEngine)) {
              seen.add(baseEngine);
              uniqueEngines.push({ ...eng, baseEngine });
            }
          }
          setEngines(uniqueEngines.length > 0 ? uniqueEngines : getFallbackEngines());
        } else {
          setEngines(getFallbackEngines());
        }
      } catch (err) {
        setEngines(getFallbackEngines());
        setError('Failed to fetch live RDS engines. Using fallbacks.');
      } finally {
        setLoading(false);
      }
    };
    fetchEngines();
  }, [region]);

  const getFallbackEngines = () => [
    { baseEngine: 'mysql', engine: 'mysql', description: 'MySQL' },
    { baseEngine: 'postgres', engine: 'postgres', description: 'PostgreSQL' },
    { baseEngine: 'mariadb', engine: 'mariadb', description: 'MariaDB' },
    { baseEngine: 'sqlserver', engine: 'sqlserver-ex', description: 'SQL Server' },
    { baseEngine: 'oracle', engine: 'oracle-ee', description: 'Oracle' }
  ];

  const handleEngineSelect = (baseEngine) => {
    const engObj = engines.find(e => e.baseEngine === baseEngine);
    if (engObj) {
      handleChange({ target: { name: 'engine', value: engObj.engine } });
      handleChange({ target: { name: 'baseEngine', value: baseEngine } }); // Store UI state
    }
  };

  const handleTemplateSelect = (template) => {
    handleChange({ target: { name: 'rdsTemplate', value: template } });
    if (template === 'freetier') {
      handleChange({ target: { name: 'dbInstanceClass', value: 'db.t3.micro' } });
      handleChange({ target: { name: 'multiAz', value: false, type: 'checkbox' } });
      handleChange({ target: { name: 'storageType', value: 'gp2' } });
    } else if (template === 'production') {
      handleChange({ target: { name: 'dbInstanceClass', value: 'db.m5.large' } });
      handleChange({ target: { name: 'multiAz', value: true, type: 'checkbox' } });
      handleChange({ target: { name: 'storageType', value: 'io1' } });
    } else {
      handleChange({ target: { name: 'dbInstanceClass', value: 'db.t3.medium' } });
      handleChange({ target: { name: 'multiAz', value: false, type: 'checkbox' } });
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px', color: 'var(--text-2)' }}>
        <Loader2 className="spinner" size={40} style={{ marginBottom: '16px', color: 'var(--accent)' }} />
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-1)' }}>Initializing AWS Console Experience</h3>
        <p>Fetching available database engines for {region}...</p>
      </div>
    );
  }

  const currentBaseEngine = formData.baseEngine || (engines[0] && engines[0].baseEngine) || 'mysql';

  return (
    <div style={{ background: 'var(--surface-bg)', borderRadius: 'var(--radius-lg)', color: 'var(--text-1)' }}>
      {/* Header */}
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Database size={28} color="var(--accent)" />
          Create database
        </h2>
        <p style={{ color: 'var(--text-2)', marginTop: '8px', fontSize: '0.95rem' }}>
          Configure and provision a fully managed relational database directly matching AWS architecture patterns.
        </p>
      </div>

      <div style={{ padding: '24px' }}>
        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', background: 'rgba(255,160,0,0.1)', color: 'var(--warning)', borderRadius: 'var(--radius-md)', marginBottom: '24px', borderLeft: '4px solid var(--warning)' }}>
            <AlertTriangle size={20} />
            <span style={{ fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Engine Options */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Engine options</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {['mysql', 'postgres', 'mariadb', 'oracle', 'sqlserver'].map(eng => (
              <div 
                key={eng}
                onClick={() => handleEngineSelect(eng)}
                style={{ 
                  padding: '20px', 
                  border: currentBaseEngine === eng ? '2px solid var(--accent)' : '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer',
                  background: currentBaseEngine === eng ? 'rgba(0, 122, 255, 0.05)' : 'var(--input-bg)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {currentBaseEngine === eng && <CheckCircle2 size={18} color="var(--accent)" style={{ position: 'absolute', top: '10px', right: '10px' }} />}
                <Database size={32} color={currentBaseEngine === eng ? "var(--accent)" : "var(--text-2)"} />
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{eng === 'postgres' ? 'PostgreSQL' : eng === 'sqlserver' ? 'SQL Server' : eng}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Templates */}
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>Templates</h3>
          <div style={{ display: 'flex', gap: '16px' }}>
            {[
              { id: 'production', label: 'Production', desc: 'Use defaults for high availability and fast performance.' },
              { id: 'devtest', label: 'Dev/Test', desc: 'Intended for development use outside of a production environment.' },
              { id: 'freetier', label: 'Free tier', desc: 'Use to develop new applications or test existing applications for free.' }
            ].map(tpl => (
              <div 
                key={tpl.id}
                onClick={() => handleTemplateSelect(tpl.id)}
                style={{ 
                  flex: 1,
                  padding: '20px', 
                  border: formData.rdsTemplate === tpl.id ? '2px solid var(--accent)' : '1px solid var(--border)', 
                  borderRadius: 'var(--radius-md)', 
                  cursor: 'pointer',
                  background: formData.rdsTemplate === tpl.id ? 'rgba(0, 122, 255, 0.05)' : 'var(--input-bg)',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {formData.rdsTemplate === tpl.id && <CheckCircle2 size={18} color="var(--accent)" style={{ position: 'absolute', top: '10px', right: '10px' }} />}
                <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '1.05rem' }}>{tpl.label}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', lineHeight: '1.4' }}>{tpl.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div style={{ marginBottom: '32px', background: 'var(--bg)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} /> Settings
          </h3>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>DB instance identifier</label>
            <input type="text" name="dbName" value={formData.dbName || ''} onChange={handleChange} placeholder="database-1" style={{ width: '100%', maxWidth: '400px', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }} />
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <h4 style={{ fontWeight: 600, marginBottom: '16px' }}>Credentials Settings</h4>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Master username</label>
              <input type="text" name="masterUsername" value={formData.masterUsername || ''} onChange={handleChange} placeholder="admin" style={{ width: '100%', maxWidth: '400px', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '4px' }}>Note: 'admin' and 'postgres' are reserved for PostgreSQL and will be auto-remapped to 'dbadmin'.</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="autoGeneratePassword" name="autoGeneratePassword" checked={formData.autoGeneratePassword || false} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="autoGeneratePassword" style={{ fontWeight: 500 }}>Auto generate a password</label>
            </div>

            {!formData.autoGeneratePassword && (
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Master password</label>
                <input type="password" name="masterPassword" value={formData.masterPassword || ''} onChange={handleChange} style={{ width: '100%', maxWidth: '400px', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Instance Configuration */}
        <div style={{ marginBottom: '32px', background: 'var(--bg)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} /> Instance configuration
          </h3>
          
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>DB instance class</label>
          <select name="dbInstanceClass" value={formData.dbInstanceClass || 'db.t3.micro'} onChange={handleChange} style={{ width: '100%', maxWidth: '400px', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }}>
            <optgroup label="Burstable classes (includes t classes)">
              <option value="db.t3.micro">db.t3.micro (2 vCPU, 1 GiB RAM) - Free Tier</option>
              <option value="db.t3.small">db.t3.small (2 vCPU, 2 GiB RAM)</option>
              <option value="db.t3.medium">db.t3.medium (2 vCPU, 4 GiB RAM)</option>
            </optgroup>
            <optgroup label="Standard classes (includes m classes)">
              <option value="db.m5.large">db.m5.large (2 vCPU, 8 GiB RAM)</option>
              <option value="db.m5.xlarge">db.m5.xlarge (4 vCPU, 16 GiB RAM)</option>
            </optgroup>
          </select>
        </div>

        {/* Storage */}
        <div style={{ marginBottom: '32px', background: 'var(--bg)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <HardDrive size={18} /> Storage
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Storage type</label>
              <select name="storageType" value={formData.storageType || 'gp3'} onChange={handleChange} style={{ width: '100%', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }}>
                <option value="gp3">General Purpose SSD (gp3)</option>
                <option value="gp2">General Purpose SSD (gp2)</option>
                <option value="io1">Provisioned IOPS SSD (io1)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Allocated storage (GiB)</label>
              <input type="number" name="allocatedStorage" value={formData.allocatedStorage || 20} onChange={handleChange} min="20" style={{ width: '100%', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }} />
            </div>
          </div>

          <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <input type="checkbox" id="storageAutoscaling" name="storageAutoscaling" checked={formData.storageAutoscaling !== false} onChange={handleChange} style={{ width: '16px', height: '16px' }} />
              <label htmlFor="storageAutoscaling" style={{ fontWeight: 600 }}>Enable storage autoscaling</label>
            </div>
            
            {formData.storageAutoscaling !== false && (
              <div style={{ marginLeft: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-2)' }}>Maximum storage threshold (GiB)</label>
                <input type="number" name="maxAllocatedStorage" value={formData.maxAllocatedStorage || 1000} onChange={handleChange} min={formData.allocatedStorage || 20} style={{ width: '200px', padding: '10px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }} />
              </div>
            )}
          </div>
        </div>

        {/* Connectivity */}
        <div style={{ background: 'var(--bg)', padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} /> Connectivity
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ fontWeight: 600 }}>Public access</label>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '16px', background: formData.publiclyAccessible === true ? 'rgba(0,122,255,0.05)' : 'var(--input-bg)', border: formData.publiclyAccessible === true ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <input type="radio" name="publiclyAccessible" checked={formData.publiclyAccessible === true} onChange={() => handleChange({ target: { name: 'publiclyAccessible', checked: true, type: 'checkbox' } })} style={{ marginTop: '4px' }} />
              <div>
                <div style={{ fontWeight: 600 }}>Yes</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: '4px' }}>Amazon EC2 instances and devices outside the VPC can connect to your database. Choose one or more VPC security groups that specify which EC2 instances and devices can connect.</div>
              </div>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '16px', background: formData.publiclyAccessible !== true ? 'rgba(0,122,255,0.05)' : 'var(--input-bg)', border: formData.publiclyAccessible !== true ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
              <input type="radio" name="publiclyAccessible" checked={formData.publiclyAccessible !== true} onChange={() => handleChange({ target: { name: 'publiclyAccessible', checked: false, type: 'checkbox' } })} style={{ marginTop: '4px' }} />
              <div>
                <div style={{ fontWeight: 600 }}>No</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-2)', marginTop: '4px' }}>Amazon RDS will not assign a public IP address to the database. Only Amazon EC2 instances and devices inside the VPC can connect to your database.</div>
              </div>
            </label>
          </div>
        </div>

      </div>
    </div>
  );
};

export default RdsConfig;
