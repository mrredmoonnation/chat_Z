import React, { useState, useEffect } from 'react';
import { Lock, EyeOff } from 'lucide-react';

export default function DisguiseModal({ isOpen, onClose, secretPin = '1234' }) {
  const [display, setDisplay] = useState('0');
  const [prevValue, setPrevValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [resetNext, setResetNext] = useState(false);
  const [inputSequence, setInputSequence] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        handleNumber(e.key);
      } else if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/') {
        const opMap = { '+': '+', '-': '−', '*': '×', '/': '÷' };
        handleOp(opMap[e.key]);
      } else if (e.key === 'Enter' || e.key === '=') {
        handleEquals();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, display, prevValue, operation, resetNext, inputSequence, secretPin]);

  if (!isOpen) return null;

  const handleNumber = (num) => {
    const nextSeq = inputSequence + num;
    setInputSequence(nextSeq);

    if (display === '0' || resetNext) {
      setDisplay(num);
      setResetNext(false);
    } else {
      setDisplay(display + num);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPrevValue(null);
    setOperation(null);
    setResetNext(false);
    setInputSequence('');
  };

  const handleOp = (op) => {
    setPrevValue(parseFloat(display));
    setOperation(op);
    setResetNext(true);
    setInputSequence('');
  };

  const handleEquals = () => {
    // Check if secret PIN was entered!
    if (inputSequence === secretPin || display === secretPin) {
      handleClear();
      onClose();
      return;
    }

    if (!operation || prevValue === null) return;
    const current = parseFloat(display);
    let result = 0;

    switch (operation) {
      case '+':
        result = prevValue + current;
        break;
      case '−':
        result = prevValue - current;
        break;
      case '×':
        result = prevValue * current;
        break;
      case '÷':
        result = current !== 0 ? prevValue / current : 'Error';
        break;
      default:
        return;
    }

    setDisplay(String(result));
    setPrevValue(null);
    setOperation(null);
    setResetNext(true);
    setInputSequence('');
  };

  return (
    <div className="wa-calc-overlay">
      <div className="wa-calc-window">
        {/* Stealth Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, padding: '0 4px' }}>
          <span style={{ fontSize: '11px', color: '#555555', letterSpacing: 1 }}>CALCULATOR</span>
          <span style={{ fontSize: '11px', color: '#444444' }}>PIN: {secretPin} + [=]</span>
        </div>

        {/* Display */}
        <div className="wa-calc-display" id="calcDisplay">
          {display}
        </div>

        {/* Buttons Grid */}
        <div className="wa-calc-grid">
          <button type="button" className="wa-calc-btn gray" onClick={handleClear}>AC</button>
          <button type="button" className="wa-calc-btn gray" onClick={() => setDisplay(String(-parseFloat(display)))}>±</button>
          <button type="button" className="wa-calc-btn gray" onClick={() => setDisplay(String(parseFloat(display) / 100))}>%</button>
          <button type="button" className="wa-calc-btn orange" onClick={() => handleOp('÷')}>÷</button>

          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('7')}>7</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('8')}>8</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('9')}>9</button>
          <button type="button" className="wa-calc-btn orange" onClick={() => handleOp('×')}>×</button>

          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('4')}>4</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('5')}>5</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('6')}>6</button>
          <button type="button" className="wa-calc-btn orange" onClick={() => handleOp('−')}>−</button>

          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('1')}>1</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('2')}>2</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('3')}>3</button>
          <button type="button" className="wa-calc-btn orange" onClick={() => handleOp('+')}>+</button>

          <button type="button" className="wa-calc-btn dark-gray double" onClick={() => handleNumber('0')}>0</button>
          <button type="button" className="wa-calc-btn dark-gray" onClick={() => handleNumber('.')}>.</button>
          <button type="button" className="wa-calc-btn orange" onClick={handleEquals} id="calcEqualsBtn">=</button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            type="button"
            onClick={onClose}
            style={{ fontSize: '11px', color: '#555555', textDecoration: 'underline', background: 'transparent', border: 'none', cursor: 'pointer', padding: 8 }}
          >
            Emergency Unlock
          </button>
        </div>
      </div>
    </div>
  );
}
