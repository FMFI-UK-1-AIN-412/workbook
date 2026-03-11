import { useEffect } from "react";
import { Alert, Button, Spinner, Image } from "react-bootstrap"
import { BsGithub } from "react-icons/bs"
import { useLocation, useNavigate, useParams } from "react-router-dom";

import config from '../config.json';
import { authActions, authSelectors } from "../features/auth/authSlice";
import { useAppDispatch, useAppSelector } from "../app/hooks";

export interface LoginPageProps {
  msg?: string,
  readirectTo?: string,
}

export function getLoginUrl(redirect?: string) {
  const { clientId } = config.githubApi;
  const { baseUrl } = config.frontend;
  //const backendUrl = encodeURIComponent(`${config.auth.backendUrl}${redirect ? `?redirect=${redirect}` : ''}`);
  const redirectUri = encodeURIComponent(`${baseUrl}/login${redirect || ''}`);
  // return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo`;
  return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}`;
}

function getQueryArg(path: string, name: string): string | undefined {
  const res = path.match(new RegExp(`[?&]${name}=([^&]*)`));
  if (res && res.length === 2) {
    return res[1];
  }
}

export default function LoginPage(props: LoginPageProps) {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const authState = useAppSelector(authSelectors.authState);
  const user = useAppSelector(authSelectors.user);
  const error = useAppSelector(authSelectors.error);
  const path = window.location.href;

  useEffect(() => {
    if (path) {
      const code = getQueryArg(path, 'code');
      if (code) {
        // code should not leak so we hide it from address bar 
        // however it can be abused only while it was not exchanged for access token by backend 
        window.history.replaceState(null, '', window.location.pathname);
        dispatch(authActions.requestAccessToken(code));
      }
    }
  }, [path, dispatch]);

  useEffect(() => {
    if (authState === 'authenticated' && params['*'] !== undefined) {
      if (params['*'] !== '' || (params['*'] === '' && location.pathname.endsWith('/'))) {
        navigate(`/${params['*']}`);
      }
    }
  })

  const message = (msg: String) => <><p style={{ textAlign: 'center' }}>{msg}</p><hr /></>
  const err = (message: string) => <Alert variant="danger">{message}</Alert>
  const loginButton = <Button className="w-100" variant="dark" href={getLoginUrl(props.readirectTo)}><BsGithub color="white" /> Prihlásiť sa pomocou github</Button>
  const loading = <div style={{ width: '100%', textAlign: 'center' }}><Spinner animation="grow" role="status" /></div>

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - var(--workbook-nav-height))' }}>
      <div style={{ width: '300px', margin: 'auto' }}>
        {(props.msg && !error && authState !== 'authenticated') && message(props.msg)}
        {(error && authState === 'unauthenticated') && err(`Prihlásenie zlyhalo, skúste to znova neskôr (${error})`)}
        {authState === 'authPending' && loading}
        {authState === 'unauthenticated' && loginButton}
        {authState === 'authenticated' && <><Image className="border mb-5" style={{width: '300px'}} roundedCircle src={user?.avatarUrl}/><h1 className="text-muted text-center">{user?.login}</h1></>}
      </div>
    </div>
  )
}