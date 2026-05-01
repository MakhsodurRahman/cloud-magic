import React from 'react';

const BeanstalkConfig = ({ formData, handleChange }) => {
  return (
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
  );
};

export default BeanstalkConfig;
