import type {RouteObject} from 'react-router-dom';
import Root from './root';
import Login from "./routes/login";
import Register from "./routes/register";
import Home from './routes/home';

const router: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      {path: 'register', element: <Register /> }
    ]
  }
];

export default router;
