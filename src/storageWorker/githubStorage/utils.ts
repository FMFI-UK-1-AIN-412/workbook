import sha1 from "sha1";

export function pathURIEncode(path: string) {
  return path.split('/').map(p => encodeURIComponent(p)).reduce((p, c) => `${p}/${c}`);
}

export function getSessionBranchName(fileInfo: { owner: string, repo: string, path: string, ref: string, openAs?: string }) {
  const { path, ref, openAs } = fileInfo;
  const getName = (p: string) => {
    const f = p.split('/').pop()?.split('.');
    let name = f ? (f.length === 1 ? f[0] : f.slice(0, -1).join('.')) : '';
    // make the name comply with branch name specs (https://git-scm.com/docs/git-check-ref-format)
    name = name.replace('..', '');
    name = name.replace('@{', '');
    name = name.replace('~', '');
    name = name.replace('^', '');
    name = name.replace(':', '');
    name = name.replace('?', '');
    name = name.replace('*', '');
    name = name.replace('[', '');
    name = name.replace(' ', '-');
    return name;
  }
  return `${ref}_session_${getName(path)}_${sha1(path)}${openAs ? `_${openAs}` : ''}`;
}

export function isSessionBranchName(name: string) {
  return name.match(/_session_/) !== null && name.match(/_[a-z0-9]+$/) !== null;
}