import type {RouteObject} from 'react-router-dom';
import Root from './root';
import Login from "./routes/login";
import Register from "./routes/register";
import Home from './routes/home';
import Game from './routes/game';
import UserProfile from './routes/profile';

const router: RouteObject[] = [
  {
    path: '/',
    element: <Root />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      {path: 'register', element: <Register /> },
      {path: 'game', element: <Game />},
      {path: 'profile', element: <UserProfile />}
    ]
  }
];

export default router;
