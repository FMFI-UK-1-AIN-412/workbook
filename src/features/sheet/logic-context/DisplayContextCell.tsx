import { SymbolWithArity } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { useAppSelector } from "../../../app/hooks";
import { CellLocator, sheetSelectors } from "../slice/sheetSlice";
import { NamedFormula, Theorem } from "../slice/logicContext";
import ContextCell from "./ContextCell";

interface DisplayContextCellProps {
  cellLoc: CellLocator,
}

export default function DisplayContextCell({ cellLoc }: DisplayContextCellProps) {
  const context = useAppSelector(sheetSelectors.logicContext(cellLoc))
  const stringifyAritySymbol = (a: SymbolWithArity) => `${a.name}/${a.arity}`;
  const strigifyNamedFormula = (f: NamedFormula | Theorem) => {
    if ('prooved' in f && f.prooved === true) {
      return `${f.name} = ${f.formula} [proved]`;
    } else {
      return `${f.name} = ${f.formula}`;
    }
  }
  return (
    <ContextCell title="Current Logic Context">
      <h5>Language</h5>
      <dl className="clearfix">
        <dt className="float-start fw-medium me-2">Constants:</dt>
        <dd>{context.constants.join(', ')}</dd>
        <dt className="float-start fw-medium me-2">Predicates:</dt>
        <dd>{context.predicates.map(stringifyAritySymbol).join(', ')}</dd>
        <dt className="float-start fw-medium me-2">Functions:</dt>
        <dd>{context.functions.map(stringifyAritySymbol).join(', ')}</dd>
      </dl>
      <details open className="mb-3">
        <summary><h5 className="mb-0 d-inline-block">Axioms</h5></summary>
        <ul>
          {context.axioms.map((ax, index) => <li key={index}>{strigifyNamedFormula(ax)}</li>)}
        </ul>
      </details>
      <details open className="mb-3">
        <summary><h5 className="mb-0 d-inline-block">Theorems</h5></summary>
        <ul>
          {context.theorems.map((thm, index) => <li key={index}>{strigifyNamedFormula(thm)}</li>)}
        </ul>
      </details>
      <details open>
        <summary><h5 className="mb-0 d-inline-block">Other formulas</h5></summary>
        <ul>
          {context.formulas.map((ax, index) => <li key={index}>{strigifyNamedFormula(ax)}</li>)}
        </ul>
      </details>
    </ContextCell>
  )
}