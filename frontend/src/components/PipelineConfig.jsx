import React from 'react';

const PipelineConfig = ({ formData, handleChange, runningInstances, region }) => {
  return (
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
        <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Only running instances in {region} are shown.
        </p>
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
  );
};

export default PipelineConfig;
