import React from 'react';
import { useAirport } from '../../context/AirportContext';
import SuperAdminMessages from './SuperAdminMessages';
import AirportAdminMessages from './AirportAdminMessages';

export default function AdminMessages() {
  const { role } = useAirport();
  
  if (role === 'super_admin') {
    return <SuperAdminMessages />;
  }
  
  return <AirportAdminMessages />;
}
