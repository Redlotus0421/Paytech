import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { storageService } from '../services/storageService';
import { Lock, AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface SettingsProps {
  user: User;
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ user, onLogout }) => {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [step, setStep] = useState(1); // 1 = Warning, 2 = Password

  if (user.role !== UserRole.ADMIN) {
      return <div className="p-8 text-center text-gray-500">Access Denied</div>;
  }

  const handleResetClick = () => {
      setStep(1);
      setIsAuthModalOpen(true);
  };

  const executeReset = async (e: React.FormEvent) => {
      e.preventDefault();
      
      // FIX: Require the hardcoded seeded admin password for system wipe
      // This prevents accidental wipes by admins who changed their personal password but forgot the master key
      // or protects against compromised individual admin accounts.
      if (authPassword !== '950421') {
          setAuthError('Incorrect Master Admin Password');
          return;
      }

      setIsResetting(true);
      try {
          await storageService.resetSystem(user.id);
          alert("System reset successful. You will be logged out.");
          onLogout();
      } catch (error) {
          console.error(error);
          alert("Failed to reset system.");
          setIsResetting(false);
      }
  };

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Lock className="text-gray-700"/> System Settings
        </h2>

        {/* Danger Zone */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="text-lg font-bold text-red-700 flex items-center gap-2 mb-2">
                <AlertTriangle className="text-red-600"/> Danger Zone
            </h3>
            <p className="text-sm text-red-600 mb-6">
                These actions are destructive and cannot be undone. Please proceed with caution.
            </p>

            <div className="flex justify-between items-center bg-white p-4 rounded border border-red-100">
                <div>
                    <h4 className="font-bold text-gray-900">Reset System Data</h4>
                    <p className="text-xs text-gray-500">
                        Deletes ALL reports, inventory, POS transactions, stores, and users (except your account).
                    </p>
                </div>
                <button 
                    onClick={handleResetClick}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded font-bold text-sm flex items-center gap-2 transition-colors"
                >
                    <Trash2 size={16}/> Reset System
                </button>
            </div>
        </div>

        {/* Reset Confirmation Modal */}
        {isAuthModalOpen && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                    <div className="bg-red-600 text-white p-4 flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <AlertTriangle size={20}/> Confirm System Reset
                        </h3>
                        <button onClick={() => setIsAuthModalOpen(false)}><X/></button>
                    </div>
                    
                    <div className="p-6">
                        {step === 1 ? (
                            <div className="text-center space-y-4">
                                <p className="text-gray-700 font-medium">
                                    Are you absolutely sure?
                                </p>
                                <p className="text-sm text-gray-500">
                                    This action will permanently delete all business data, including sales history, inventory, and all other user accounts. Only your admin account will remain.
                                </p>
                                <div className="flex justify-center gap-3 mt-6">
                                    <button onClick={() => setIsAuthModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700">Cancel</button>
                                    <button onClick={() => setStep(2)} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold">Yes, I understand</button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={executeReset} className="space-y-4">
                                <p className="text-sm text-gray-600">
                                    Enter the <strong>Master Admin Password</strong> to confirm the reset.
                                </p>
                                <input 
                                    type="password"
                                    autoFocus
                                    placeholder="Master Admin Password"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 outline-none"
                                    value={authPassword}
                                    onChange={(e) => setAuthPassword(e.target.value)}
                                />
                                {authError && <p className="text-xs text-red-600 font-bold">{authError}</p>}
                                
                                <div className="flex justify-end gap-3 pt-2">
                                    <button type="button" onClick={() => setIsAuthModalOpen(false)} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-gray-700">Cancel</button>
                                    <button 
                                        type="submit" 
                                        disabled={isResetting}
                                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold flex items-center gap-2"
                                    >
                                        {isResetting && <Loader2 className="animate-spin" size={16}/>}
                                        {isResetting ? 'Resetting...' : 'Confirm Reset'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};