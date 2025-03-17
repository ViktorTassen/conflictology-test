import React from 'react';
import ReactDOM from 'react-dom/client';
import { SidePanel } from '@/components/SidePanel/SidePanel';
import '@/components/SidePanel/style.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SidePanel />
  </React.StrictMode>
);