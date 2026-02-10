import { useCallback, useMemo, useReducer } from "react";
import { Accordion, Button, Dropdown } from "react-bootstrap";
import { useAppSelector } from "../../../app/hooks";
import { embeddedApps } from "../../../embeddedApps";
import AppCell from "../AppCell";
import { CellContext, NamedFormula, Theorem } from "../slice/logicContext";
import { CellLocator, sheetActions, sheetSelectors } from "../slice/sheetSlice";
import { InlineMath } from 'react-katex';
import ContextCell from "./ContextCell";
import { ExclamationTriangleFill, InfoCircleFill } from "react-bootstrap-icons";
import { useDispatch } from "react-redux";
import produce from "immer";
import { createFormulaAST, Negation, reconstructASTClause } from "../../../utils/formula/AST";
import { formulaToClauseTheory } from "../../../utils/formula/CNFTransform";
import { unicodeFactory } from "../../../utils/formula/stringify";
import { SymbolWithArity, parseFormulaWithPrecedence } from "@fmfi-uk-1-ain-412/js-fol-parser";
import classNames from 'classnames/dedupe';

import 'katex/dist/katex.min.css';
import { Formula, FormulaList } from "../../../components/Formula";

interface ProoveTheoremCellProps {
  cellLoc: CellLocator,
  isEdited: boolean,
  katexMacros: object,
  data: LocalState,
  onDataChanged: (getData: () => any) => void,
}

interface LocalState {
  newTheorem: NamedFormula
  theoremCorrect: boolean,
  theoremEdited: boolean,
  prooveWith?: string,
  getProoverData?: () => any,
  prooverData: any | null,
  verdict: boolean,
  context?: CellContext,
}
type LocalActions =
  { type: 'update_theorem', payload: { item: NamedFormula, correct: boolean } }
  | { type: 'set_proover', payload: string }
  | { type: 'update_proover_data', payload: () => any }
  | { type: 'update_verdict', payload: boolean }
  | { type: 'theorem_edited', payload: boolean }

interface ProofAssignment {
  axioms: NamedFormula[],
  theorems: Theorem[],
  newTheorem: NamedFormula,
}

export const initialProoveTheoremCellState: LocalState = {
  theoremEdited: true,
  newTheorem: { name: '', formula: '' },
  theoremCorrect: false,
  prooverData: null,
  verdict: false
};

export default function ProoveTheoremCell({ cellLoc, isEdited, data, onDataChanged }: ProoveTheoremCellProps) {
  const context = useAppSelector(sheetSelectors.logicContext(cellLoc));
  const dispatch = useDispatch();

  const [localState, localDispatch] = useReducer((state: LocalState, action: LocalActions) => {
    const newState = produce(state, draft => {
      switch (action.type) {
        case 'update_theorem':
          draft.newTheorem = action.payload.item;
          draft.theoremCorrect = action.payload.correct;
          break;
        case 'set_proover':
          draft.prooveWith = action.payload;
          break;
        case 'update_proover_data':
          draft.getProoverData = action.payload;
          break;
        case 'update_verdict':
          draft.verdict = action.payload;
          break;
      }
    })

    onDataChanged(() => ({
      ...newState,
      prooverData: newState.getProoverData === undefined ? null : newState.getProoverData(),
      getProoverData: undefined
    }));
    return newState;
  }, data);

  const { proof: preprocessedProof, ConversionDisplay } = useMemo(() => {
    let asciiFormula;
    try {
      asciiFormula = parseFormulaWithPrecedence(localState.newTheorem.formula, context, unicodeFactory(context))
    } catch (_) {
      return { proof: undefined, ConversionDisplay: undefined }
    }
    if (localState.prooveWith !== undefined && localState.theoremCorrect) {
      const proof: ProofAssignment = {
        axioms: context.axioms,
        theorems: context.theorems,
        newTheorem: {
          ...localState.newTheorem,
          formula: asciiFormula,
        }
      }
      return prepareProofAssingment(proof, context, localState.prooveWith)
    } else {
      return { proof: undefined, ConversionDisplay: undefined }
    }
  }, [localState.prooveWith, localState.newTheorem, context])

  const prooveWithSelectHandler = (typeName: string) => {
    localDispatch({ type: 'set_proover', payload: typeName });
  }

  const changedTheoremHandler = (theorem: NamedFormula) => {
    let asciiFormula;
    try {
      asciiFormula = parseFormulaWithPrecedence(theorem.formula, context, unicodeFactory(context))
    } catch (_) {
      asciiFormula = undefined;
    }
    localDispatch({ type: 'update_theorem', payload: { item: theorem, correct: asciiFormula !== undefined } })
    if (asciiFormula !== undefined) {
      dispatch(sheetActions.extendLogicContext({
        cellLoc,
        contextExtension: { theorems: [{ ...localState.newTheorem, formula: asciiFormula, prooved: false }] }
      }));
    }
  }

  const proofVerdictHandler = useCallback((verdict: boolean) => {
    let asciiFormula;
    try {
      asciiFormula = parseFormulaWithPrecedence(localState.newTheorem.formula, context, unicodeFactory(context))
    } catch (_) {
      asciiFormula = undefined;
    }
    if (localState.verdict !== verdict) {
      localDispatch({ type: 'update_verdict', payload: verdict });
      dispatch(sheetActions.extendLogicContext({
        cellLoc,
        contextExtension: { theorems: [{ ...localState.newTheorem, formula: asciiFormula!, prooved: verdict }] }
      }));
    }
  }, [localState.verdict, localState.newTheorem, localDispatch, dispatch]);

  return (
    <ContextCell title="Theorem" variant={localState.verdict ? 'success' : 'danger'} unpadded>
      <div className="m-3">
        <Formula
          context={context}
          formula={localState.newTheorem}
          onUpdated={changedTheoremHandler}
          lock={!isEdited}
          isNameUsed={name => context.symbolExits(name)}
          placeholder={<i>define new theorem</i>}
          showEdit={isEdited}
          onEditChange={b => localDispatch({ type: 'theorem_edited', payload: b })}
          initiallyEditable={localState.theoremEdited}
          autogrow showCopy
        />
      </div>
      {(preprocessedProof === undefined || localState.prooveWith === undefined) ? (
        // TODO possible proover data loss when changing 
        <Dropdown className="m-3">
          <Dropdown.Toggle disabled={!localState.theoremCorrect} variant="success">
            Prove with
          </Dropdown.Toggle>
          <Dropdown.Menu>
            {embeddedApps.filter(app => app.supportsProofs).map(app => (
              <Dropdown.Item key={app.typeName} onClick={() => prooveWithSelectHandler(app.typeName)}>{app.name}</Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      ) : (
        <>
          <h6 className={classNames('mx-3', { 'text-danger': !localState.verdict })}>
            {localState.verdict ? <>Proof</> : <><ExclamationTriangleFill className="me-2 fs-5" />Unfinished proof</>}
          </h6>
          {ConversionDisplay && <ConversionDisplay isEdited={isEdited} />}
          <AppCell
            cellLoc={cellLoc}
            data={localState.prooverData}
            isEdited={isEdited}
            typeName={localState.prooveWith}
            proof={preprocessedProof}
            onDataChanged={getData => localDispatch({ type: 'update_proover_data', payload: getData })}
            updateProofVerdict={proofVerdictHandler}
          />
        </>
      )}
    </ContextCell>
  )
}

function prepareProofAssingment(proof: ProofAssignment, context: CellContext, appType: string): { proof: any, ConversionDisplay?: (props: { isEdited: boolean }) => JSX.Element } {
  if (appType === 'resolutionEditor') {
    let extendedContext = context;
    const convertFormula = (f: NamedFormula, negate: boolean = false) => {
      let newSymbols: (string | SymbolWithArity)[] = [];
      let formulaAst = createFormulaAST(f.formula, extendedContext)
      let astClauses = formulaToClauseTheory(negate ? new Negation(formulaAst) : formulaAst, extendedContext, s => newSymbols.push(s));

      const symbols = extendedContext.logicContext();
      extendedContext = new CellContext({
        ...symbols,
        constants: symbols.constants.concat(newSymbols.filter(s => typeof s === 'string') as string[]),
        functions: symbols.functions.concat(newSymbols.filter(s => typeof s !== 'string') as SymbolWithArity[]),
      });

      return {
        [f.name]: astClauses.map(c => reconstructASTClause(c, unicodeFactory(extendedContext))) as string[]
      }
    }

    const convertFormulas = (fs: NamedFormula[] | Theorem[]) => {
      let result: {
        [key: string]: string[]
        | { proved: boolean, clauses: string[] }
      } = {}
      for (let f of fs) {
        const convMap = convertFormula(f);
        if ('prooved' in f) {
          result[f.name] = { proved: f.prooved, clauses: convMap[f.name] };
        } else {
          result[f.name] = convMap[f.name];
        }
      }
      return result;
    }

    const axiomsConv = convertFormulas(proof.axioms);
    const theoremsConv = convertFormulas(proof.theorems);
    const newTheoremConv = convertFormula(proof.newTheorem, true);

    return {
      proof: { extendedContext, axiomsConv, theoremsConv, newTheoremConv },
      ConversionDisplay: (_props) => ResolvenceConversion({
        conversions: [
          { desc: 'Axioms conversion: ', negate: false, conv: axiomsConv },
          { desc: 'Already proved theorems conversion: ', negate: false, conv: theoremsConv },
          { desc: 'Current theorem negation conversion: ', negate: true, conv: newTheoremConv }
        ],
        context: extendedContext
      })
    }
  } else {
    return {
      proof, ConversionDisplay: ({isEdited}) => isEdited ? AxiomsList({context}) : <></>
    }
  }
}

interface CNFConversionProps {
  conversions: {
    desc: string,
    negate: boolean,
    // map from formula name to array of tex formated clauses
    conv: { [name: string]: string[] | { proved: boolean, clauses: string[] } }
  }[],
  context: CellContext,
}
function ResolvenceConversion({ conversions, context }: CNFConversionProps) {
  return (
    <div className="px-3 mb-3">
      <p>Formulas used in resolution editor must be converted to equisatisfiable clausal theories.</p>
      {conversions
        .map(c => ({
          ...c,
          conv: Object.fromEntries(
            Object.entries(c.conv)
              .filter(([_, v]) => 'proved' in v ? v.proved : true)
          )
        }))
        .filter(c => Object.keys(c.conv).length > 0).map(c => (
          <div key={c.desc} className="mb-2">
            <p className="mb-2">{c.desc}</p>
            <table className="ms-4">
              <tbody>
                {Object.entries(c.conv)
                  .filter(([_, conv]) => 'proved' in conv ? conv.proved : true)
                  .map(([name, conv]) => 'clauses' in conv ? [name, conv.clauses] : [name, conv])
                  .map(([name, clauses]) => (
                    <tr key={name.toString()}>
                      <td className="pe-4 pt-1 align-top"><InlineMath math={`${c.negate ? '\\neg' : ''} ${name as string}`} />:</td>
                      <td className="align-top">
                        <FormulaList context={context} formulas={clauses as string[]} clause showCopy />
                      </td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>)
        )}
    </div >
  )
}

function AxiomsList({ context }: { context: CellContext }) {

  const formulas = useMemo(() => {
    let fs: NamedFormula[] = [];
    fs.push(...context.axioms);
    fs.push(...(context.theorems.filter(t => t.prooved)));
    return fs;
  }, [context.axioms, context.theorems])

  return (
    <Accordion className="border-top" flush>
      <Accordion.Item eventKey="0">
        <Accordion.Header as="h6">
          <InfoCircleFill className="me-2 text-secondary"/>
          <span className="small text-uppercase text-secondary">Axioms and proved theorems</span>
        </Accordion.Header>
        <Accordion.Body className="small py-2">
          <FormulaList
            context={context}
            formulas={formulas}
            showCopy
          />
        </Accordion.Body>
      </Accordion.Item>
    </Accordion>
  )
}