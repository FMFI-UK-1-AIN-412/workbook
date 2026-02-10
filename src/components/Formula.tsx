import React, { useEffect, useMemo, useState } from "react";
import { InlineMath } from "react-katex";
import { CellContext, NamedFormula, isEmptyFormula } from "../features/sheet/slice/logicContext";
import { Button, Form, FormControlProps, InputGroup } from "react-bootstrap";
import { BiCheck, BiCopy, BiEditAlt, BiTrash } from "react-icons/bi";
import { parseClause, parseFormulaWithPrecedence } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { asciiFactory, texFactory, unicodeFactory } from "../utils/formula/stringify";

import styles from "./Formula.module.scss"

export type FormulaProps = 
  Omit<DisplayFormulaProps, 'clause'>
  & Partial<EditFormulaProps>
  & {
    placeholder?: JSX.Element,
    initiallyEditable?: boolean,
    lock?: boolean,
    onUpdated?: (formula: NamedFormula) => void,
    onEditChange?: (isEdited: boolean) => void,
  }

/* show or edit formula */
export function Formula(props: FormulaProps) {
  const { initiallyEditable, formula, onUpdated, lock, placeholder, onEditChange } = props;
  const [isEdited, setIsEdited] = useState(initiallyEditable || false);
  const [formula1, setFormula1] = useState(formula);

  const editChanged = (b: boolean) => onEditChange && onEditChange(b); 

  return (
    isEdited && !(lock === true) ?
      <EditFormula
        {...props}
        formula={formula1}
        onChange={setFormula1}
        onSave={() => { onUpdated && onUpdated(formula1); setIsEdited(false); editChanged(false) }}
        showSave
      />
      :
      (
        isEmptyFormula(formula1) && placeholder !== undefined ?
          placeholder
          :
          <DisplayFormula
            {...props}
            onEditClick={() => { setIsEdited(true); editChanged(true) }}
          />
      )
  )
}

export interface DisplayFormulaProps {
  context: CellContext,
  formula: string | NamedFormula
  nameOnly?: boolean,
  clause?: boolean,
  showCopy?: boolean,
  showEdit?: boolean,
  onEditClick?: () => void,
}

export function DisplayFormula({ formula, context, clause, showCopy, showEdit, onEditClick }: DisplayFormulaProps) {
  const name = (typeof formula === 'string') ? '' : formula.name;
  const origFormula = (typeof formula === 'string') ? formula : formula.formula;
  const parsed = useMemo(() => {
    try {
      if (clause === true) {
        return {
          ascii: parseClause(origFormula, context, asciiFactory(context)),
          unicode: parseClause(origFormula, context, unicodeFactory(context)),
          tex: parseClause(origFormula, context, texFactory(context)),
        }
      } else {
        return {
          ascii: parseFormulaWithPrecedence(origFormula, context, asciiFactory(context)),
          unicode: parseFormulaWithPrecedence(origFormula, context, unicodeFactory(context)),
          tex: parseFormulaWithPrecedence(origFormula, context, texFactory(context)),
        }
      }
    } catch (_) {
      return undefined;
    }
  }, [formula, origFormula, context])

  return (
    <div className={styles.formulaItem}>
      {parsed === undefined ?
        (
          <div className={styles.invalidFormula}>
            {`${name === '' ? '' : `${name} = `}${origFormula}`}
          </div>
        ) : (
          <>
            <InlineMath math={`${name === '' ? '' : `${name} = `}${parsed.tex}`} />
            {showEdit === true &&
              <Button size="sm" title="Edit formula"
                onClick={onEditClick}
              >
                <BiEditAlt />
              </Button>
            }
            {showCopy === true &&
              <Button className={styles.copyButton} size="sm" title="Copy to clipboard" variant="secondary"
                onClick={() => navigator.clipboard.writeText(parsed.unicode)}
              >
                <BiCopy />
              </Button>
            }
          </>
        )
      }
    </div>
  )
}

interface EditFormulaProps {
  context: CellContext,
  formula: NamedFormula,
  onChange: (item: NamedFormula, correct: boolean) => void
  autogrow?: boolean,
  empty?: boolean,
  showSave?: boolean,
  showDelete?: boolean,
  isNameUsed?: (name: string) => boolean,
  onSave?: () => void
  onDelete?: () => void
}
export function EditFormula({ context, formula: item, autogrow, empty, showSave, showDelete, isNameUsed, onChange, onSave, onDelete }: EditFormulaProps) {
  const getNameError = (name: string) => {
    if (name.trim() === '') {
      return 'Name is empty. '
    } else if (isNameUsed && isNameUsed(name)) {
      return 'Symbol name is already used. '
    }
  }
  const parse = (formula: string): { error?: string, parsed?: string } => {
    try {
      const parsed = parseFormulaWithPrecedence(formula, context, unicodeFactory(context))
      return { parsed };
    } catch (e: unknown) {
      const se = (e as SyntaxError)
      return { error: se.message };
    }
  }
  const [parseError, setParseError] = useState<string | undefined>(() => getNameError(item.name));
  const [nameError, setNameError] = useState<string | undefined>(() => parse(item.formula).error);

  const formulaChanged = (value: string) => {
    const correct = !nameError && !parse(value).error
    onChange({ ...item, formula: value }, correct);
  }
  const nameChanged = (value: string) => {
    const correct = !getNameError(value) && !parseError
    onChange({ ...item, name: value }, correct);
  }

  useEffect(() => {
    if (empty === true) {
      setNameError(undefined);
    } else {
      setNameError(getNameError(item.name));
    }
  }, [context, item.name, empty])
  useEffect(() => {
    if (empty === true) {
      setParseError(undefined);
    } else {
      setParseError(parse(item.formula).error);
    }
  }, [context, item.formula, empty])

  return (
    <>
      <InputGroup className="mb-2" hasValidation>
        <Form.Control
          style={{ flexBasis: "5rem", flexGrow: "0", flexShrink: '0' }}
          isInvalid={nameError !== undefined}
          value={item.name}
          onChange={e => nameChanged(e.target.value)}
        />
        <InputGroup.Text>=</InputGroup.Text>
        <AutogrowInput
          autogrow={autogrow}
          isInvalid={parseError !== undefined}
          value={item.formula}
          onChange={e => formulaChanged(e.target.value)}
        />
        {showDelete === true &&
          <Button variant="danger" tabIndex={-1} onClick={() => onDelete && onDelete()}><BiTrash /></Button>
        }
        {showSave === true &&
          <Button disabled={nameError !== undefined || parseError !== undefined} variant="success" tabIndex={-1} onClick={() => onSave && onSave()}><BiCheck /></Button>
        }
        <Form.Control.Feedback type="invalid">{nameError && nameError} {parseError && parseError}</Form.Control.Feedback>
      </InputGroup>
    </>
  )
}

const AutogrowInput = React.forwardRef<
  "input",
  FormControlProps
  & { autogrow?: boolean }
>(
  (props, ref) => {
    return (
      <Form.Control
        ref={ref}
        style={
          props.autogrow ?
            {
              ...props.style,
              maxWidth: `calc(${calculateInputWidth((props.value || '').toString())}px + 40px ${props.isInvalid ? ' + 10px' : ''})`,
              minWidth: '150px'
            }
            : undefined
        }
        {...props}
      />
    )
  }
);
function calculateInputWidth(text: string) {
  let s = getComputedStyle(document.body)
  let font = `${s.getPropertyValue('--bs-body-font-weight')} ${s.getPropertyValue('--bs-body-font-size')} ${s.getPropertyValue('--bs-body-font-family')}`;
  // @ts-ignore
  let canvas: HTMLCanvasElement = calculateInputWidth.canvas || (calculateInputWidth.canvas = document.createElement("canvas"));
  let context = canvas.getContext("2d")!;
  context.font = font;
  let metrics = context.measureText(text);
  return metrics.width;
};

export interface FormulaListProps {
  formulas: string[] | NamedFormula[],
  context: CellContext,
  clause?: boolean
  showCopy?: boolean,
}
export function FormulaList(props: FormulaListProps) {
  return (
    <div className={styles.formulaList}>
      {props.formulas.map((f, index) =>
        <DisplayFormula {...props} key={index} formula={f} />
      )}
    </div>
  )
}

interface FormulaAdderProps {
  context: CellContext,
  formulas: Array<NamedFormula>,
  onChange: (index: number, item: NamedFormula) => void,
  onAdd: (item: NamedFormula) => void,
  onDelete: (index: number, count: number) => void,
}

export function FormulaAdder({ context, formulas, onChange, onAdd, onDelete }: FormulaAdderProps) {
  const isEmpty = (f: NamedFormula) => f.name === '' && f.formula === ''
  const deleteLast = () => {
    let index = formulas.length - 2;
    while (index >= 0 && isEmpty(formulas[index])) {
      index--;
    }
    onDelete(index + 1, formulas.length - index + 1);
  }

  const nameMap = new Map<string, number>();
  let i = 0;
  for (let f of formulas) {
    if (!nameMap.has(f.name)) {
      nameMap.set(f.name, i);
    }
    i++;
  }

  const isNameUsed = (name: string, index: number) => {
    const t = nameMap.get(name);
    return (t !== undefined && t < index) || context.symbolExits(name);
  }

  const handleChange = (index: number, item: NamedFormula) => {
    if (isEmpty(item) && index === formulas.length - 1) {
      deleteLast()
    } else if (index === formulas.length && !isEmpty(item)) {
      onAdd(item);
    } else {
      onChange(index, item);
    }
  }

  const handleDelete = (index: number) => {
    if (index === formulas.length - 1) {
      deleteLast()
    } else {
      onDelete(index, 1);
    }
  }
  const gen = function* (formulas: Array<NamedFormula>) {
    let last: NamedFormula | null = null;
    for (const f of formulas) {
      yield f;
      last = f;
    }
    if (!last || !isEmpty(last)) {
      yield { name: '', formula: '' } as NamedFormula
    }
  }

  return (
    <>
      {Array.from(gen(formulas)).map((item, index) => {
        return <EditFormula
          context={context}
          key={index}
          isNameUsed={(name) => isNameUsed(name, index)}
          formula={item}
          empty={index === formulas.length}
          showDelete={index !== formulas.length}
          onChange={item => handleChange(index, item)}
          onDelete={() => handleDelete(index)}
        />
      })}
    </>
  )
}