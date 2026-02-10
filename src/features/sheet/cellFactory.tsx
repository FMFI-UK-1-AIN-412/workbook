import React from "react";
import { BsExclamationTriangleFill } from "react-icons/bs";
import { useAppDispatch } from "../../app/hooks";
import AppCell from "./AppCell";
import AddFormulasCell, { initialAddFormulasCellData } from "./logic-context/AddFormulasCell";
import DisplayContextCell from "./logic-context/DisplayContextCell";
import LanguageCell, { initialLanguageCellData } from "./logic-context/LanguageCell";
import ProoveTheoremCell, { initialProoveTheoremCellState } from "./logic-context/ProoveTheoremCell";
import { emptyContext } from "./slice/logicContext";
import { CellLocator, sheetActions } from "./slice/sheetSlice";
import TextCell from "./TextCell";
import ContextCell from "./ContextContainer";


export type CellUpdateFunction = (getData: () => any) => void
export interface RenderPayload {
  cellLoc: CellLocator,
  typeName: string,
  data: any,
  key: React.Key,
  isEdited: boolean,
  katexMacros: object,
  fullscreenCell: CellLocator | undefined,
  requestEditMode: (isEdited: boolean) => void,
  onDataChanged: CellUpdateFunction,
  onFullscreenToggleClick: (isFullscreen: boolean, cellLoc: CellLocator) => void,
}

interface AddPayload {
  dispatch: ReturnType<typeof useAppDispatch>,
  after: CellLocator,
  typeName: string
}

interface CellFactory {
  name: string,
  typeName: string,
  renderComponent: (payload: RenderPayload) => JSX.Element,
  addCell: (payload: AddPayload) => void,
}

const cells: Array<CellFactory> = [
  {
    name: 'Text',
    typeName: 'text',
    renderComponent: (props) => (
      <TextCell {...props} />
    ),
    addCell: ({ dispatch, after }) => dispatch(sheetActions.insertTextCell('', after)),
  },
  {
    name: 'App',
    typeName: 'app',
    renderComponent: (props) => (
      <AppCell {...props} />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertAppCell(typeName.slice(4) /* ??? */, null, after)),
  },
  {
    name: 'Language definition/extension',
    typeName: 'context/language',
    renderComponent: (payload) => (
      <LanguageCell {...payload} />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: initialLanguageCellData }))
  },
  {
    name: 'Axioms',
    typeName: 'context/addAxioms',
    renderComponent: (payload) => (
      <AddFormulasCell
        title="Axioms"
        variant="primary"
        makeContextExtension={formulas => ({ ...emptyContext, axioms: formulas })}
        {...payload}
      />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: initialAddFormulasCellData }))
  },
  {
    name: 'Formulas',
    typeName: 'context/addFormulas',
    renderComponent: (payload) => (
      <AddFormulasCell
        title="Formulas"
        makeContextExtension={formulas => ({ ...emptyContext, formulas: formulas })}
        {...payload}
      />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: initialAddFormulasCellData }))
  },
  {
    name: 'Theorem',
    typeName: 'context/theorem',
    renderComponent: (payload) => (
      <ProoveTheoremCell {...payload} />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: initialProoveTheoremCellState }))
  },
  {
    name: 'Sub-context',
    typeName: 'context',
    renderComponent: (props) => (
      <ContextCell {...{ ...props, cellLoc: { ...props.cellLoc, contextId: props.cellLoc.id } }} />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: [] })),
  },
  {
    name: 'Current context summary',
    typeName: 'context/display',
    renderComponent: (payload) => (
      <DisplayContextCell {...payload} />
    ),
    addCell: ({ dispatch, after, typeName }) => dispatch(sheetActions.insertCell({ after, type: typeName, data: initialLanguageCellData }))
  },
]

const typeName2factory: { [key: string]: CellFactory } = {}
cells.forEach(f => {
  typeName2factory[f.typeName] = f
});

export function renderCellComponent(payload: RenderPayload): JSX.Element {
  if (typeName2factory[payload.typeName] === undefined) {
    return typeName2factory['app'].renderComponent(payload)
  }
  return typeName2factory[payload.typeName]!.renderComponent(payload);
}

export function getCellComponentFunction(typeName: string) {
  if (typeName2factory[typeName] === undefined) {
    return typeName2factory['app'].renderComponent;
  }
  return typeName2factory[typeName]!.renderComponent;
}

export function addCell(payload: AddPayload): void {
  if (payload.typeName.startsWith('app')) {
    return typeName2factory['app'].addCell(payload);
  }
  return typeName2factory[payload.typeName].addCell(payload);
}

export const contextCells = cells.filter(f => f.typeName.startsWith('context'));