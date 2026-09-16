import React, { useState, useEffect, useRef } from 'react';
import { Lock, ShieldAlert, X, Eye, EyeOff, CheckCircle2, KeyRound } from 'lucide-react';

interface PinConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  correctPin: string | null | undefined;
  title?: string;
  description?: string;
  actionLabel?: string;
}

export function PinConfirmModal({
  isOpen,
  onClose,
  onSuccess,
  correctPin,
  title = "Autenticação por PIN",
  description = "Digite seu PIN de 4 dígitos cadastrado para autorizar esta operação.",
  actionLabel = "Confirmar Autorização"
}: PinConfirmModalProps) {
  const [pin, setPin] = useState<string[]>(['', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setPin(['', '', '', '']);
      setError(null);
      setIsVerifying(false);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (index: number, value: string) => {
    const numeric = value.replace(/\D/g, '');
    if (!numeric && value !== '') return;

    const char = numeric.slice(-1);
    const newPin = [...pin];
    newPin[index] = char;
    setPin(newPin);
    setError(null);

    if (char && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!pin[index] && index > 0) {
        const newPin = [...pin];
        newPin[index - 1] = '';
        setPin(newPin);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newPin = [...pin];
        newPin[index] = '';
        setPin(newPin);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else if (e.key === 'Enter') {
      verifyPin();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (pasted.length > 0) {
      const newPin = ['', '', '', ''];
      for (let i = 0; i < pasted.length; i++) {
        newPin[i] = pasted[i];
      }
      setPin(newPin);
      const targetIndex = Math.min(pasted.length, 3);
      inputRefs.current[targetIndex]?.focus();
    }
  };

  const handleKeypadPress = (num: string) => {
    const emptyIndex = pin.findIndex(val => val === '');
    if (emptyIndex !== -1) {
      handleInputChange(emptyIndex, num);
    }
  };

  const handleKeypadBackspace = () => {
    for (let i = 3; i >= 0; i--) {
      if (pin[i] !== '') {
        const newPin = [...pin];
        newPin[i] = '';
        setPin(newPin);
        inputRefs.current[i]?.focus();
        break;
      }
    }
  };

  const verifyPin = () => {
    const enteredPin = pin.join('');
    if (enteredPin.length < 4) {
      setError('Digite todos os 4 dígitos do PIN.');
      return;
    }

    if (!correctPin) {
      setError('Nenhum PIN de acesso configurado. Cadastre um PIN nas configurações de segurança primeiro.');
      return;
    }

    setIsVerifying(true);
    if (enteredPin === correctPin) {
      setError(null);
      setTimeout(() => {
        setIsVerifying(false);
        onSuccess();
        onClose();
      }, 300);
    } else {
      setIsVerifying(false);
      setError('PIN incorreto. Verifique sua senha de acesso e tente novamente.');
      setPin(['', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const isComplete = pin.every(d => d !== '');

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div 
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-500">Confirmação de Segurança</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center text-center">
          <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-600 mb-3 border border-amber-200">
            <KeyRound className="w-6 h-6" />
          </div>

          <p className="text-xs text-slate-600 mb-5 max-w-[260px]">
            {description}
          </p>

          {/* 4 Digit Boxes */}
          <div className="flex items-center gap-3 mb-3">
            {[0, 1, 2, 3].map((index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                maxLength={1}
                value={pin[index]}
                onChange={e => handleInputChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className={`w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all focus:outline-none ${
                  error 
                    ? 'border-red-400 bg-red-50 text-red-700' 
                    : pin[index] 
                    ? 'border-blue-500 bg-blue-50/50 text-slate-900' 
                    : 'border-slate-200 bg-slate-50 text-slate-900 focus:border-blue-500 focus:bg-white'
                }`}
              />
            ))}
          </div>

          {/* Show/Hide PIN toggle */}
          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 mb-4 cursor-pointer"
          >
            {showPin ? (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Ocultar dígitos</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5" />
                <span>Mostrar dígitos</span>
              </>
            )}
          </button>

          {/* Error Message */}
          {error && (
            <div className="w-full bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs flex items-center gap-2 mb-4 animate-shake text-left">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Numeric Keypad for Mobile & Touch */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-base transition-colors cursor-pointer shadow-2xs"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setPin(['', '', '', '']);
                setError(null);
                inputRefs.current[0]?.focus();
              }}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-500 font-medium rounded-xl text-xs transition-colors cursor-pointer"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 font-bold rounded-xl text-base transition-colors cursor-pointer shadow-2xs"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl text-xs transition-colors flex items-center justify-center cursor-pointer"
            >
              ⌫
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={verifyPin}
              disabled={!isComplete || isVerifying}
              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isVerifying ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{actionLabel}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
