import React, { useState, useEffect } from 'react';
import { 
  Calculator, Plus, Search, Server, Database, Cloud, 
  Trash2, ChevronRight, DollarSign, ArrowLeft,
  PieChart, Info, ShieldCheck, Box, Zap
} from 'lucide-react';

const AWS_SERVICES = [
  { id: 'EC2', name: 'Amazon EC2', desc: 'Secure and resizable compute capacity', icon: <Server size={24} /> },
  { id: 'S3', name: 'Amazon S3', desc: 'Object storage built to retrieve any amount of data', icon: <Database size={24} /> },
  { id: 'RDS', name: 'Amazon RDS', desc: 'Managed relational database service', icon: <Database size={24} /> },
  { id: 'PIPELINE', name: 'AWS CodePipeline', desc: 'Continuous delivery service', icon: <Zap size={24} /> },
  { id: 'ELASTIC_BEANSTALK', name: 'AWS Elastic Beanstalk', desc: 'Run and manage web apps', icon: <Box size={24} /> },
];

export default function CostCalculator({ region }) {
  const [step, setStep] = useState('search'); // 'search' | 'configure'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  
  const [estimateItems, setEstimateItems] = useState([]);
  
  // Configuration states
  const [config, setConfig] = useState({});
  const [liveCost, setLiveCost] = useState(null);
  const [loadingCost, setLoadingCost] = useState(false);

  useEffect(() => {
    if (step === 'configure' && selectedService) {
      fetchEstimate();
    }
  }, [config, selectedService]);

  const fetchEstimate = async () => {
    setLoadingCost(true);
    try {
      const ak = localStorage.getItem('aws_access_key') || '';
      const sk = localStorage.getItem('aws_secret_key') || '';
      const r = region || 'us-east-1';

      const payload = {
        serviceType: selectedService.id,
        ...config
      };

      const response = await fetch(`http://localhost:8080/api/aws/estimate-cost?region=${r}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-AWS-Access-Key': ak,
          'X-AWS-Secret-Key': sk
        },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const data = await response.json();
        setLiveCost(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCost(false);
    }
  };

  const handleSelectService = (svc) => {
    setSelectedService(svc);
    // Initialize default config based on service
    if (svc.id === 'EC2') {
      setConfig({ instanceType: 't3.micro', ebsVolumeSize: 30 });
    } else if (svc.id === 'S3') {
      setConfig({ storageGB: 100 });
    } else if (svc.id === 'RDS') {
      setConfig({ dbInstanceClass: 'db.t3.micro', allocatedStorage: 20 });
    } else {
      setConfig({});
    }
    setStep('configure');
  };

  const handleAddToEstimate = () => {
    if (!liveCost) return;
    setEstimateItems(prev => [...prev, {
      id: Date.now().toString(),
      service: selectedService,
      config: { ...config },
      cost: liveCost
    }]);
    setStep('search');
    setSelectedService(null);
    setLiveCost(null);
    setConfig({});
  };

  const handleRemoveItem = (id) => {
    setEstimateItems(prev => prev.filter(item => item.id !== id));
  };

  const filteredServices = AWS_SERVICES.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalMonthlyCost = estimateItems.reduce((acc, item) => acc + (item.cost?.total || 0), 0);
  const totalYearlyCost = totalMonthlyCost * 12;

  return (
    <div style={{ display: 'flex', height: '100%', gap: '24px' }}>
      
      {/* LEFT MAIN AREA */}
      <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <Calculator size={28} color="var(--accent)" />
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>AWS Pricing Calculator</h2>
            <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>Estimate the cost for your architecture solution.</p>
          </div>
        </div>

        {step === 'search' && (
          <div className="animate-fade">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', fontWeight: 700 }}>Add service</h3>
            
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '14px', color: 'var(--text-2)' }} />
              <input 
                type="text" 
                placeholder="Find service (e.g. EC2, S3)" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%', padding: '14px 16px 14px 44px',
                  background: 'var(--surface-2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', color: 'var(--text-1)', fontSize: '1rem'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
              {filteredServices.map(svc => (
                <div 
                  key={svc.id}
                  onClick={() => handleSelectService(svc)}
                  style={{
                    background: 'var(--surface-2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', padding: '20px',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'flex-start', gap: '16px'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ color: 'var(--accent)', background: 'var(--surface-bg)', padding: '10px', borderRadius: '12px' }}>
                    {svc.icon}
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{svc.name}</h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: '1.4' }}>{svc.desc}</p>
                    <div style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                      Configure <ChevronRight size={14} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'configure' && selectedService && (
          <div className="animate-fade">
            <button 
              onClick={() => { setStep('search'); setSelectedService(null); setLiveCost(null); }}
              style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '20px', padding: 0 }}
            >
              <ArrowLeft size={16} /> Back to services
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ color: 'var(--accent)', background: 'var(--surface-2)', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                {selectedService.icon}
              </div>
              <h3 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Configure {selectedService.name}</h3>
            </div>

            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '24px', position: 'relative' }}>
              
              {/* Floating Cost Badge */}
              <div style={{ position: 'absolute', top: '24px', right: '24px', textAlign: 'right' }}>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Estimated Cost</div>
                 <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                    {loadingCost ? <span style={{ fontSize: '1.2rem', opacity: 0.5 }}>Calculating...</span> : `$${liveCost?.total || '0.00'}`}
                 </div>
                 <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>USD / Month</div>
              </div>

              {selectedService.id === 'EC2' && (
                <div style={{ maxWidth: '60%' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>EC2 Instance Specifications</h4>
                  
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-2)' }}>Instance Type</label>
                  <select 
                    value={config.instanceType || ''} 
                    onChange={e => setConfig({...config, instanceType: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', marginBottom: '20px' }}
                  >
                    <option value="t2.micro">t2.micro (Free Tier Eligible)</option>
                    <option value="t3.micro">t3.micro (Free Tier Eligible)</option>
                    <option value="t3.small">t3.small</option>
                    <option value="t3.medium">t3.medium</option>
                    <option value="t3.large">t3.large</option>
                    <option value="m5.large">m5.large</option>
                    <option value="c5.large">c5.large</option>
                  </select>

                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-2)' }}>Amazon EBS storage (GB per month)</label>
                  <input 
                    type="number" 
                    value={config.ebsVolumeSize || ''} 
                    onChange={e => setConfig({...config, ebsVolumeSize: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }}
                  />
                </div>
              )}

              {selectedService.id === 'S3' && (
                <div style={{ maxWidth: '60%' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>S3 Standard Storage</h4>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-2)' }}>Data Storage (GB per month)</label>
                  <input 
                    type="number" 
                    value={config.storageGB || ''} 
                    onChange={e => setConfig({...config, storageGB: parseInt(e.target.value) || 0})}
                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }}
                  />
                </div>
              )}

              {selectedService.id === 'RDS' && (
                <div style={{ maxWidth: '60%' }}>
                  <h4 style={{ marginBottom: '16px', fontSize: '1.1rem', fontWeight: 700 }}>RDS Database Specifications</h4>
                  
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-2)' }}>Instance Class</label>
                  <select 
                    value={config.dbInstanceClass || ''} 
                    onChange={e => setConfig({...config, dbInstanceClass: e.target.value})}
                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)', marginBottom: '20px' }}
                  >
                    <option value="db.t3.micro">db.t3.micro (Free Tier eligible)</option>
                    <option value="db.t3.small">db.t3.small</option>
                    <option value="db.t3.medium">db.t3.medium</option>
                    <option value="db.m5.large">db.m5.large</option>
                  </select>

                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-2)' }}>Allocated Storage (GB per month)</label>
                  <input 
                    type="number" 
                    value={config.allocatedStorage || ''} 
                    onChange={e => setConfig({...config, allocatedStorage: parseInt(e.target.value) || 20})}
                    min="20"
                    style={{ width: '100%', padding: '12px', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-1)' }}
                  />
                </div>
              )}

              {['PIPELINE', 'ELASTIC_BEANSTALK'].includes(selectedService.id) && (
                <div style={{ maxWidth: '60%' }}>
                   <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>This service uses a simplified pricing model for estimation.</p>
                </div>
              )}

              {liveCost && liveCost.breakdown && liveCost.breakdown.length > 0 && (
                <div style={{ marginTop: '30px', padding: '16px', background: 'var(--input-bg)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                  <h5 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <PieChart size={14} color="var(--accent)" /> Cost Breakdown
                  </h5>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {liveCost.breakdown.map((item, i) => (
                      <li key={i} style={{ fontSize: '0.85rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '4px', height: '4px', background: 'var(--accent)', borderRadius: '50%' }}></span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>

            <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={handleAddToEstimate}
                disabled={loadingCost || !liveCost}
              >
                Add to my estimate
              </button>
              <button className="btn" onClick={() => { setStep('search'); setSelectedService(null); }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR - MY ESTIMATE */}
      <div style={{ width: '350px', background: 'var(--surface-2)', borderLeft: '1px solid var(--border)', padding: '24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          My Estimate <span style={{ background: 'var(--accent-glow)', color: 'var(--accent)', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px' }}>{estimateItems.length}</span>
        </h3>

        <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '8px' }}>Total Upfront Cost</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-1)' }}>$0.00</div>
          
          <div style={{ width: '100%', height: '1px', background: 'var(--border)', margin: '16px 0' }}></div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '8px' }}>Total Monthly Cost</div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--success)' }}>${totalMonthlyCost.toFixed(2)}</div>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-2)', marginTop: '8px' }}>12 months total: <strong>${totalYearlyCost.toFixed(2)}</strong></div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
          {estimateItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
              <Calculator size={32} style={{ opacity: 0.2, marginBottom: '16px' }} />
              <p style={{ fontSize: '0.9rem' }}>Your estimate is empty.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '8px' }}>Add services to see the total cost.</p>
            </div>
          ) : (
            estimateItems.map(item => (
              <div key={item.id} style={{ background: 'var(--surface-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ color: 'var(--accent)' }}>{item.service.icon}</div>
                  <h5 style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.service.name}</h5>
                  <button 
                    onClick={() => handleRemoveItem(item.id)}
                    style={{ position: 'absolute', right: '12px', top: '16px', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', opacity: 0.7 }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {item.config.instanceType && <span>Type: {item.config.instanceType}</span>}
                    {item.config.ebsVolumeSize !== undefined && <span>EBS: {item.config.ebsVolumeSize} GB</span>}
                    {item.config.storageGB !== undefined && <span>Storage: {item.config.storageGB} GB</span>}
                    {item.config.dbInstanceClass && <span>DB Class: {item.config.dbInstanceClass}</span>}
                    {item.config.allocatedStorage !== undefined && <span>DB Storage: {item.config.allocatedStorage} GB</span>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>${item.cost.total.toFixed(2)}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-2)', textTransform: 'uppercase' }}>/ Month</div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div style={{ marginTop: '24px' }}>
          <button className="btn btn-deploy" disabled={estimateItems.length === 0} style={{ width: '100%' }}>
            Save Estimate
          </button>
        </div>

      </div>

    </div>
  );
}
