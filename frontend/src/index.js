// Entry point for the React application.
// ReactDOM.createRoot mounts the <App /> component into the #root div defined in public/index.html.
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Global Tailwind CSS styles
import App from './App';
import reportWebVitals from './reportWebVitals';

// Create the React root and attach it to the DOM node with id="root"
const root = ReactDOM.createRoot(document.getElementById('root'));

// StrictMode renders components twice in development to catch side-effect bugs
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
