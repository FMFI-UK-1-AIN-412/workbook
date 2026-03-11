import { Image, Nav, Navbar } from "react-bootstrap";
import { Link, NavLink } from "react-router-dom";
import { authSelectors, requestRefreshTokens } from "../features/auth/authSlice";
import { useAppSelector } from "../app/hooks";
import { getLoginUrl } from "./LoginPage";
import { PopoverNavLink } from "../components/PopoverMenu";

import config from '../config.json';

function Navigation() {
  const accessToken = useAppSelector(authSelectors.accessToken);
  const user = useAppSelector(authSelectors.user);
  
  return (
    <Navbar expand="sm" bg="dark" variant="dark">
      <Navbar.Brand href={config.frontend.basePath} className="ms-3">Workbook</Navbar.Brand>
      <Navbar.Toggle aria-controls="responsive-navbar-nav" />
      <Navbar.Collapse>
        <Nav>
          <Nav.Link as={NavLink} to="/workbooks">Workbooks</Nav.Link>
          <Nav.Link as={NavLink} to="/repos">Repositories</Nav.Link>
        </Nav>
      </Navbar.Collapse>
      <Nav className="me-3">
        {
          accessToken ?
            (
              <PopoverNavLink title={<><Image roundedCircle src={user?.avatarUrl} className="me-2" style={{ height: '1.5rem' }} />{user?.login}</>}>
                <Link className="d-block px-3 py-2" to="/logout">Odhlásiť sa</Link>
              </PopoverNavLink>
            )
            : <Nav.Link href={getLoginUrl()}>Prihlásiť sa</Nav.Link>
        }
      </Nav>
    </Navbar>
  )
}

export default Navigation