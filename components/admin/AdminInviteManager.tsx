import React from 'react';
import AdminInviteScreen from './AdminInviteScreen';

interface AdminInviteManagerProps {
  isOpen: boolean;
  onClose: () => void;
  displayMode?: 'overlay' | 'page';
}

const AdminInviteManager: React.FC<AdminInviteManagerProps> = ({ isOpen, onClose, displayMode = 'overlay' }) => {
  return <AdminInviteScreen isOpen={isOpen} onClose={onClose} displayMode={displayMode} />;
};

export default AdminInviteManager;
