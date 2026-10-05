import React from 'react';
let sesion = null;
export const __setSesion = s => { sesion = s; };
export const useSession = () => sesion;
export const SessionProvider = ({ children }) => children;
