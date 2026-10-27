import React from 'react';
import {renderToString} from 'react-dom/server';
import SignalsApp from './SignalsApp.jsx';
export const renderSignals=props=>renderToString(<SignalsApp {...props}/>);
