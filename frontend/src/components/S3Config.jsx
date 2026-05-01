import React from 'react';

const S3Config = ({ formData, handleChange }) => {
  return (
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
  );
};

export default S3Config;
