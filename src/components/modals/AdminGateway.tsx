import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AdminGatewayProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function AdminGateway({ onClose, onSuccess }: AdminGatewayProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [showSplash, setShowSplash] = useState(false);
  const { setIsAdmin } = useApp();

  const handleStep1 = () => {
    if (code === 'rwmg25') {
      setStep(2);
      setCode('');
      setError('');
    } else {
      setError('Invalid code.');
      setTimeout(() => setError(''), 2000);
    }
  };

  const handleStep2 = () => {
    if (code === 'GLOKEY') {
      setError('');
      setShowSplash(true);
      setTimeout(() => {
        setIsAdmin(true);
        onSuccess();
      }, 2000);
    } else {
      setError('Invalid code.');
      setTimeout(() => setError(''), 2000);
    }
  };

  if (showSplash) {
    return (
      <div className="modal-backdrop">
        <div className="text-center">
          <img
            src="/assets/images/thisbeatizbananazmainlogo copy.png"
            alt=""
            className="w-40 h-40 object-contain mx-auto animate-logo-burst"
          />
          <div className="font-display text-3xl font-900 text-[#f5c518] glow-gold-text mt-4 tracking-widest uppercase animate-bounce-in">
            Welcome Admin
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); e.target === e.currentTarget && onClose(); }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="modal-box max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/5 text-[#666] hover:text-white transition-colors">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <div className="font-display text-xl font-800 text-white tracking-wider uppercase">
            {step === 1 ? 'Admin Code' : 'Verify Access'}
          </div>
          <div className="w-8 h-[2px] bg-[#f5c518] mx-auto mt-2 rounded-full" />
        </div>

        <div className="space-y-3">
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (step === 1 ? handleStep1() : handleStep2())}
            placeholder={step === 1 ? 'Enter admin code' : 'Enter verify code'}
            className="input-dark w-full px-4 py-3 text-sm tracking-widest"
            autoFocus
            autoComplete="off"
          />
          {error && (
            <div className="text-red-400 text-xs text-center">{error}</div>
          )}
          <button
            onClick={step === 1 ? handleStep1 : handleStep2}
            className="btn-gold w-full py-3 rounded-xl text-sm"
          >
            {step === 1 ? 'Continue' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
}
