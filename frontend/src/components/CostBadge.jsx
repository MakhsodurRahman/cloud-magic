import React, { useState, useEffect } from 'react';
import { DollarSign, Info, ShieldCheck } from 'lucide-react';

const CostBadge = ({ formData, serviceType }) => {
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchEstimate = async () => {
      setLoading(true);
      try {
        const ak = localStorage.getItem('aws_access_key');
        const sk = localStorage.getItem('aws_secret_key');
        const r = localStorage.getItem('aws_region') || 'us-east-1';

        const response = await fetch(`http://localhost:8080/api/aws/estimate-cost?region=${r}`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-AWS-Access-Key': ak || '',
            'X-AWS-Secret-Key': sk || ''
          },
          body: JSON.stringify({ ...formData, serviceType })
        });
        if (response.ok) {
          const data = await response.json();
          setEstimate(data);
        }
      } catch (err) {
        console.error("Cost fetch failed", err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchEstimate, 500); 
    return () => clearTimeout(timer);
  }, [formData, serviceType]);

  const currentTotal = estimate ? estimate.total : '0.00';
  const isFreeTier = estimate ? estimate.isFreeTierEligible : false;
  const breakdown = estimate ? estimate.breakdown : ['Fetching live data...'];

  const getStatusColor = () => {
    if (isFreeTier) return 'var(--success)';
    if (estimate && estimate.total > 50) return 'var(--error)';
    if (estimate && estimate.total > 15) return 'var(--warning)';
    return 'var(--accent)';
  };

  return (
    <div className="cost-badge animate-fade" style={{
      position: 'absolute',
      top: '20px',
      right: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '4px',
      zIndex: 10
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 14px',
        background: 'var(--surface-2)',
        border: `1px solid ${getStatusColor()}44`,
        borderRadius: '30px',
        boxShadow: `0 4px 12px ${getStatusColor()}11`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease'
      }}>
        {isFreeTier ? (
          <ShieldCheck size={14} color="var(--success)" />
        ) : (
          <DollarSign size={14} color={getStatusColor()} />
        )}
        <span style={{ 
          fontSize: '0.9rem', 
          fontWeight: 800, 
          color: getStatusColor(),
          letterSpacing: '-0.2px'
        }}>
          {loading ? '...' : `$${currentTotal}`}
          <span style={{ fontSize: '0.65rem', opacity: 0.6, marginLeft: '4px', fontWeight: 600 }}>/MO</span>
        </span>
      </div>
      
      <div className="cost-breakdown-mini" style={{ display: 'flex', gap: '6px' }}>
        {isFreeTier && (
          <span style={{ fontSize: '0.6rem', color: 'var(--success)', fontWeight: 700, textTransform: 'uppercase' }}>Free Tier</span>
        )}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} title={breakdown.join('\n')}>
          <Info size={11} color="var(--text-2)" style={{ cursor: 'help' }} />
        </div>
      </div>
    </div>
  );
};

export default CostBadge;
