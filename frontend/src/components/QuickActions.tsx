import React from 'react';

interface QuickActionsProps {
  actions: string[];
  flightNumber?: string;
  onActionClick: (action: string) => void;
  disabled?: boolean;
}

export default function QuickActions({ actions, flightNumber, onActionClick, disabled }: QuickActionsProps) {
  const handleActionClick = (action: string) => {
    let message = action;
    if (flightNumber) {
      message = `${action} for flight ${flightNumber}`;
    }
    onActionClick(message);
  };

  // Only allow these specific actions
  const allowedActions = ['Passenger Rights', 'Alternative Flights', 'Airport Services', 'Flight Status'];
  const filteredActions = actions.filter(action => allowedActions.includes(action));

  // Don't render anything if actions is empty, undefined, or null
  if (!actions || actions.length === 0 || filteredActions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {filteredActions.map((action, index) => (
        <button
          key={index}
          onClick={() => handleActionClick(action)}
          disabled={disabled}
          className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {action}
        </button>
      ))}
    </div>
  );
}
