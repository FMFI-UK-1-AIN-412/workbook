import { useEffect, useReducer } from "react";
import { useAppSelector } from "../../../app/hooks";
import { ContextExtension, NamedFormula } from "../slice/logicContext";
import { CellLocator, sheetActions, sheetSelectors } from "../slice/sheetSlice";
import { parseFormulaWithPrecedence } from "@fmfi-uk-1-ain-412/js-fol-parser"
import { useDispatch } from "react-redux";
import { unicodeFactory } from "../../../utils/formula/stringify";
import ContextCell from "./ContextCell";
import { FormulaAdder, FormulaList } from "../../../components/Formula";

interface AddAxiomsCellProps {
  cellLoc: CellLocator,
  isEdited: boolean,
  katexMacros: object,
  title: string,
  variant?: string,
  makeContextExtension: (formulas: NamedFormula[]) => ContextExtension
  onDataChanged: (getData: () => any) => void,
}

type LocalState = NamedFormula[];
/*
type LocalState = {
  formulas: NamedFormula[],
  parsed: Array<string | undefined>,
}*/
type LocalActions =
  { type: 'add', payload: NamedFormula }
  | { type: 'change', payload: { index: number, item: NamedFormula } }
  | { type: 'delete', payload: { index: number, count: number } };
export const initialAddFormulasCellData: LocalState = [];

export default function AddFormulasCell({ cellLoc, isEdited, title, variant, makeContextExtension, onDataChanged }: AddAxiomsCellProps) {
  const data = useAppSelector(sheetSelectors.cell(cellLoc)).data as LocalState;
  const context = useAppSelector(sheetSelectors.logicContext(cellLoc));
  const dispatch = useDispatch();

  const parse = (formula: string) => {
    try {
      return parseFormulaWithPrecedence(formula, context, unicodeFactory(context));
    } catch (_) {
      return undefined;
    }
  }

  const [localState, localDispatch] = useReducer((state: LocalState, action: LocalActions) => {
    const newState = [...state];
    switch (action.type) {
      case 'add':
        newState.push(action.payload);
        break;
      case 'change':
        newState[action.payload.index] = action.payload.item;
        break;
      case 'delete':
        const { index, count } = action.payload;
        newState.splice(index, count);
        break;
    }
    onDataChanged(() => [...newState]);
    return newState;
  }, [...data])

  // extend logic context after exit from edit mode
  useEffect(() => {
    if (!isEdited) {
      const contextExtension = makeContextExtension(
        localState
          .map(f => ({ ...f, parsed: parse(f.formula) }))
          .filter(f => f.parsed !== undefined)
          .map(f => ({
            name: f.name,
            formula: f.parsed!,
          }))
      )
      dispatch(sheetActions.extendLogicContext({ cellLoc, contextExtension }));
    }
  }, [isEdited, context])



  return (
    <ContextCell title={title} variant={variant}>
      {isEdited ?
        <FormulaAdder
          context={context}
          formulas={localState}
          onChange={(index, item) => localDispatch({ type: 'change', payload: { index, item } })}
          onAdd={item => localDispatch({ type: 'add', payload: item })}
          onDelete={(index, count) => localDispatch({ type: 'delete', payload: { index, count } })}
        />
        :
        <FormulaList context={context} formulas={localState} showCopy />
      }
    </ContextCell>
  )
}