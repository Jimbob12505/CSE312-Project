import { RouteObject } from 'react-router-dom';
import Root from './root';
import Welcome from './welcome/welcome';
import Home from './routes/home';
import React from 'react';

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Welcome /> },
      { path: 'home', element: <Home /> }
    ]
  }
];

export default routes;
