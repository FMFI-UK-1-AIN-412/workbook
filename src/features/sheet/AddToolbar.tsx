import { Button, ButtonGroup, ButtonToolbar, Dropdown, DropdownButton } from "react-bootstrap";
import { PlusLg } from "react-bootstrap-icons";

import { embeddedApps } from "../../embeddedApps";
import { useAppDispatch } from "../../app/hooks";
import { CellLocator } from "./slice/sheetSlice";
import { addCell, contextCells } from "./cellFactory";


export interface AddToolbarProps {
  className?: string,
  style?: React.CSSProperties,
  cellLoc: CellLocator,
  onDropdownToggled?: (isOpen: boolean) => void,
}

export default function AddToolbar({ cellLoc, className, style, onDropdownToggled }: AddToolbarProps) {
  const dispatch = useAppDispatch();

  const addCellHandler = (typeName: string) => {
    addCell({ dispatch, typeName, after: cellLoc })
  }

  const onMenuToggled = (isOpen: boolean) => {
    onDropdownToggled?.call(null, isOpen)
  }

  return (
    <ButtonToolbar className={className} style={style}>
      <ButtonGroup className="me-2" size="sm">
        <Button variant="success" onClick={() => addCellHandler('text')}><PlusLg /> Text</Button>
        <DropdownButton onToggle={onMenuToggled} size="sm" variant="success" as={ButtonGroup} title={<><PlusLg /> App</>}>
          {embeddedApps.map(app => <Dropdown.Item key={app.typeName} onClick={() => addCellHandler(`app/${app.typeName}`)} size="sm">{app.name}</Dropdown.Item>)}
        </DropdownButton>
        {
          cellLoc.contextId === -1 ?
            <Button variant="success" onClick={() => addCellHandler('context')}><PlusLg /> Context</Button>
            : (
              <DropdownButton onToggle={onMenuToggled} size="sm" variant="success" as={ButtonGroup} title={<><PlusLg /> Context item</>}>
                {contextCells.map(({ name, typeName }) => <Dropdown.Item key={typeName} onClick={() => addCellHandler(typeName)} size="sm">{name}</Dropdown.Item>)}
              </DropdownButton>
            )
        }
      </ButtonGroup>
    </ButtonToolbar>
  )
}
