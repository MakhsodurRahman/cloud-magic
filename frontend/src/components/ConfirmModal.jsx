import React from 'react';
import { Trash2, AlertTriangle, Info } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Are you sure?", 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  type = "danger" // 'danger', 'warning', 'info'
}) => {
  if (!isOpen) return null;

  const colors = {
    danger: { bg: 'var(--error)15', text: 'var(--error)', btn: 'var(--error)' },
    warning: { bg: 'var(--warning)15', text: 'var(--warning)', btn: 'var(--warning)' },
    info: { bg: 'var(--accent)15', text: 'var(--accent)', btn: 'var(--accent)' }
  };

  const activeColor = colors[type] || colors.danger;

  return (
    <div style={{ 
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', 
      display: 'flex', alignItems: 'center', justifyContent: 'center', 
      zIndex: 10000, padding: '20px' 
    }}>
      <div className="animate-in" style={{ 
        background: 'var(--surface)', border: '1px solid var(--border)', 
        borderRadius: 'var(--radius-xl)', padding: '32px', 
        width: '100%', maxWidth: '400px', boxShadow: 'var(--shadow-lg)', 
        textAlign: 'center' 
      }}>
        <div style={{ 
          width: '64px', height: '64px', 
          background: activeColor.bg, color: activeColor.text, 
          borderRadius: '50%', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', margin: '0 auto 20px auto' 
        }}>
          {type === 'danger' && <Trash2 size={32} />}
          {type === 'warning' && <AlertTriangle size={32} />}
          {type === 'info' && <Info size={32} />}
        </div>
        
        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '12px', color: 'var(--text)' }}>
          {title}
        </h3>
        
        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem', marginBottom: '32px', lineHeight: 1.6 }}>
          {message}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <button 
            onClick={onClose}
            style={{ 
              background: 'var(--border)', border: 'none', color: 'var(--text)', 
              padding: '14px', borderRadius: 'var(--radius-md)', 
              fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' 
            }}
            onMouseOver={e => e.currentTarget.style.opacity = 0.8}
            onMouseOut={e => e.currentTarget.style.opacity = 1}
          >
            {cancelText}
          </button>
          <button 
            onClick={onConfirm}
            style={{ 
              background: activeColor.btn, border: 'none', color: '#fff', 
              padding: '14px', borderRadius: 'var(--radius-md)', 
              fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.2s' 
            }}
            onMouseOver={e => e.currentTarget.style.opacity = 0.8}
            onMouseOut={e => e.currentTarget.style.opacity = 1}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
