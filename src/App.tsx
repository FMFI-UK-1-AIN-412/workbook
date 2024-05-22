import React, { useCallback, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import "bootstrap/dist/css/bootstrap.min.css";
import Navigation from './pages/Navigation';
import SheetPage from './pages/SheetPage';
import RepoPage from './pages/RepoPage';
import RepoListPage from './pages/RepoListPage';
import { useAppSelector } from './app/hooks';
import { authSelectors, saveAuthState } from './features/auth/authSlice';
import LogoutPage from './pages/LogoutPage';
import { useUsersGetAuthenticatedQuery } from './api/githubApi/endpoints/users';
import Err404Page from './pages/Err404Page';
import LoginPage from './pages/LoginPage';

import config from './config.json';
import ExercisesPage from './pages/ExercisesPage';

function App() {
  const user = useAppSelector(authSelectors.user);
  const accessToken = useAppSelector(authSelectors.accessToken);
  const tokenState = useAppSelector(authSelectors.tokenState);

  // After user info is loaded, token is marked as tested
  useUsersGetAuthenticatedQuery(undefined, { skip: (tokenState === 'noToken' || tokenState === 'tokenTested') });

  useEffect(() => {
    if (user && tokenState === 'tokenTested' && accessToken) {
      saveAuthState(user, accessToken);
    }
  }, [user, tokenState, accessToken])

  const Root = useCallback(() => (
    <>
      <Navigation />
      <Routes>
        <Route path='*' element={<Err404Page />} />
        <Route path="/" element={<Navigate to="/workbooks" />} />
        <Route path="/login/*" element={<LoginPage />} />
        <Route path="/repos" element={<RepoListPage />} />
        <Route path="/repos/:page" element={<RepoListPage />} />
        <Route path="/repo/:owner/:repo/*" element={<RepoPage />} />
        <Route path="/workbooks" element={<ExercisesPage />} />
        <Route path="/sheet/:owner/:repo/*" element={<SheetPage />} />
        <Route path="/logout" element={<LogoutPage />} />
      </Routes>
    </>
  ), []);

  const router = createBrowserRouter([
    { path: "*", element: <Root /> },
  ], {
    basename: config.frontend.basePath
  });

  return <RouterProvider router={router} />;
}

export default App;
