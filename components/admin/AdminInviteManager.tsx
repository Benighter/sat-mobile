import React from 'react';
import AdminInviteScreen from './AdminInviteScreen';

interface AdminInviteManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminInviteManager: React.FC<AdminInviteManagerProps> = ({ isOpen, onClose }) => {
  return <AdminInviteScreen isOpen={isOpen} onClose={onClose} />;
};

export default AdminInviteManager;
