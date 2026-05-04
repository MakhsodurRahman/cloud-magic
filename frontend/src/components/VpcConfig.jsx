import React from 'react';

const VpcConfig = ({ formData, handleChange }) => (
  <>
    <div className="field-group">
      <label className="field-label">VPC Name</label>
      <input name="vpcName" value={formData.vpcName} onChange={handleChange} placeholder="e.g. production-vpc" />
    </div>

    <div className="field-group">
      <label className="field-label">VPC CIDR Block</label>
      <input name="cidrBlock" value={formData.cidrBlock} onChange={handleChange} placeholder="10.0.0.0/16" />
    </div>

    <div className="field-group">
      <label className="field-label">Public Subnet CIDR</label>
      <input name="publicSubnetCidr" value={formData.publicSubnetCidr} onChange={handleChange} placeholder="10.0.1.0/24" />
    </div>

    <div className="field-group">
      <label className="field-label">Private Subnet CIDR</label>
      <input name="privateSubnetCidr" value={formData.privateSubnetCidr} onChange={handleChange} placeholder="10.0.2.0/24" />
    </div>

    <div style={{ gridColumn: '1 / -1', marginTop: '12px', padding: '16px', background: 'rgba(52, 199, 89, 0.05)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(52, 199, 89, 0.1)' }}>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
        <strong>Pro Tip:</strong> This configuration will create a custom isolated network with an Internet Gateway and public route tables. Other resources in your stack will automatically detect and use the Default VPC unless manually specified in advanced mode.
      </p>
    </div>
  </>
);

export default VpcConfig;
