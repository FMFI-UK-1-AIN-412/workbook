import React, { useEffect, useState } from "react";
import { Image } from "react-bootstrap";
import { authSelectors } from "./authSlice"
import { useAppSelector } from "../../app/hooks"
import { RiAliensFill } from "react-icons/ri";

export interface UserAvatarProps {
  className?: string,
  style?: React.CSSProperties,
  username?: string,
}

export default function UserAvatar(props: UserAvatarProps) {
  const user = useAppSelector(authSelectors.user)
  const avatarUrl = props.username ? `https://github.com/${props.username}.png` : user?.avatarUrl;
  const [err, setErr] = useState(false);

  return err
    ? <RiAliensFill className={props.className} style={props.style} />
    : <Image onError={() => setErr(true)} roundedCircle src={avatarUrl} className={props.className} style={props.style} />
}