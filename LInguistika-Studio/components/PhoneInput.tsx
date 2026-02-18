import React from 'react';
import { Input, Select } from './UI';

// Códigos de país más comunes en América Latina y el mundo
const COUNTRY_CODES = [
  { code: '+506', country: '🇨🇷 Costa Rica', flag: '🇨🇷' },
  { code: '+1', country: '🇺🇸 USA/Canadá', flag: '🇺🇸' },
  { code: '+52', country: '🇲🇽 México', flag: '🇲🇽' },
  { code: '+503', country: '🇸🇻 El Salvador', flag: '🇸🇻' },
  { code: '+504', country: '🇭🇳 Honduras', flag: '🇭🇳' },
  { code: '+505', country: '🇳🇮 Nicaragua', flag: '🇳🇮' },
  { code: '+507', country: '🇵🇦 Panamá', flag: '🇵🇦' },
  { code: '+502', country: '🇬🇹 Guatemala', flag: '🇬🇹' },
  { code: '+501', country: '🇧🇿 Belice', flag: '🇧🇿' },
  { code: '+57', country: '🇨🇴 Colombia', flag: '🇨🇴' },
  { code: '+58', country: '🇻🇪 Venezuela', flag: '🇻🇪' },
  { code: '+51', country: '🇵🇪 Perú', flag: '🇵🇪' },
  { code: '+56', country: '🇨🇱 Chile', flag: '🇨🇱' },
  { code: '+54', country: '🇦🇷 Argentina', flag: '🇦🇷' },
  { code: '+55', country: '🇧🇷 Brasil', flag: '🇧🇷' },
  { code: '+593', country: '🇪🇨 Ecuador', flag: '🇪🇨' },
  { code: '+598', country: '🇺🇾 Uruguay', flag: '🇺🇾' },
  { code: '+595', country: '🇵🇾 Paraguay', flag: '🇵🇾' },
  { code: '+591', country: '🇧🇴 Bolivia', flag: '🇧🇴' },
  { code: '+34', country: '🇪🇸 España', flag: '🇪🇸' },
  { code: '+44', country: '🇬🇧 Reino Unido', flag: '🇬🇧' },
  { code: '+33', country: '🇫🇷 Francia', flag: '🇫🇷' },
  { code: '+49', country: '🇩🇪 Alemania', flag: '🇩🇪' },
  { code: '+39', country: '🇮🇹 Italia', flag: '🇮🇹' },
  { code: '+351', country: '🇵🇹 Portugal', flag: '🇵🇹' },
  { code: '+86', country: '🇨🇳 China', flag: '🇨🇳' },
  { code: '+81', country: '🇯🇵 Japón', flag: '🇯🇵' },
  { code: '+82', country: '🇰🇷 Corea del Sur', flag: '🇰🇷' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: string;
}

export const PhoneInput: React.FC<PhoneInputProps> = ({
  value,
  onChange,
  placeholder = "8888-8888",
  className = "",
  disabled = false,
  error
}) => {
  // Extraer código de país y número del valor actual
  const extractPhoneParts = (phone: string): { countryCode: string; number: string } => {
    if (!phone) return { countryCode: '+506', number: '' };
    
    // Buscar si el teléfono empieza con algún código conocido
    const matchedCode = COUNTRY_CODES.find(c => phone.startsWith(c.code));
    
    if (matchedCode) {
      return {
        countryCode: matchedCode.code,
        number: phone.slice(matchedCode.code.length).trim()
      };
    }
    
    // Si empieza con +, asumir que el código es hasta el primer espacio o los primeros 4 dígitos
    if (phone.startsWith('+')) {
      const spaceIndex = phone.indexOf(' ');
      if (spaceIndex > 0) {
        return {
          countryCode: phone.slice(0, spaceIndex),
          number: phone.slice(spaceIndex + 1).trim()
        };
      }
      // Extraer hasta 4 dígitos después del +
      const match = phone.match(/^(\+\d{1,4})(.*)/);
      if (match) {
        return {
          countryCode: match[1],
          number: match[2].trim()
        };
      }
    }
    
    // Por defecto, asumir +506
    return { countryCode: '+506', number: phone };
  };

  const { countryCode, number } = extractPhoneParts(value);

  const handleCountryCodeChange = (newCode: string) => {
    const newValue = number ? `${newCode} ${number}` : newCode;
    onChange(newValue);
  };

  const handleNumberChange = (newNumber: string) => {
    const newValue = newNumber ? `${countryCode} ${newNumber}` : countryCode;
    onChange(newValue);
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Select
          value={countryCode}
          onChange={(e) => handleCountryCodeChange(e.target.value)}
          disabled={disabled}
          className="w-40 flex-shrink-0"
          style={{ fontSize: '0.875rem' }}
        >
          {COUNTRY_CODES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.code}
            </option>
          ))}
        </Select>
        
        <Input
          type="tel"
          value={number}
          onChange={(e) => handleNumberChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`flex-1 ${className}`}
        />
      </div>
      
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
};
