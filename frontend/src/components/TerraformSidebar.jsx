import { Code, Copy, Loader2, Zap, Terminal, X } from 'lucide-react';

const TerraformSidebar = ({ terraformCode, deploying, onClose }) => (
  <div className={`terraform-panel ${deploying ? 'active animate-glow' : ''}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    {/* Header */}
    <div className="terraform-panel-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {deploying
          ? <Zap size={18} color="var(--accent)" />
          : <Terminal size={18} color="var(--accent)" />}
        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>main.tf</span>
        {deploying && (
          <span style={{ fontSize: '0.65rem', background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: '20px', padding: '2px 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Loader2 size={9} className="animate-spin" /> Live
          </span>
        )}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          className="btn"
          onClick={() => { if (terraformCode) navigator.clipboard.writeText(terraformCode).then(() => alert('Copied!')); }}
          disabled={!terraformCode}
          style={{ padding: '5px 12px', fontSize: '0.72rem', gap: '5px' }}
        >
          <Copy size={11} /> Copy
        </button>
        
        {onClose && (
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-2)', cursor: 'pointer', padding: '5px', display: 'flex', alignItems: 'center' }}
            className="hover-opacity"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </div>

    {/* Code */}
    <div className="code-block" style={{ flexGrow: 1 }}>
      {terraformCode
        ? terraformCode
        : <span className="code-placeholder"># Add resources to your stack{'\n'}# to generate Terraform HCL...</span>}
    </div>
  </div>
);

export default TerraformSidebar;
