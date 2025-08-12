import React from 'react';
import { useAppContext } from '../../contexts/FirebaseAppContext';
import NewBelieversTableView from './NewBelieversTableView';

const NewBelieversView: React.FC = () => {
  useAppContext();

  return (
    <div className="p-4 space-y-6">
  {/* Intentionally removed page-level title and count; shown within the card */}

      <NewBelieversTableView />
    </div>
  );
};

export default NewBelieversView;
