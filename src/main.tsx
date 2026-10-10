import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './mobile/App';
import './mobile/styles.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
