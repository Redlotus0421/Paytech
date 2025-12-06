
import React from 'react';

interface PaytechLogoProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export const PaytechLogo: React.FC<PaytechLogoProps> = ({ className = "h-12" }) => {
  return (
    <div className="inline-flex items-center justify-center select-none w-full">
      <img 
        src="https://zhumwkqnyzxavylcloga.supabase.co/storage/v1/object/public/logos/paytechlogo.png" 
        alt="Paytech Logo" 
        className={`${className} max-w-full object-contain`} 
      />
    </div>
  );
};
