import { parseConstants, parseFunctions, parsePredicates, SyntaxError } from "@fmfi-uk-1-ain-412/js-fol-parser";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Form, FormControl, InputGroup } from "react-bootstrap";
import { useDispatch } from "react-redux";
import { useAppSelector } from "../../../app/hooks";
import ContextCell from "./ContextCell";
import { CellLocator, sheetActions, sheetSelectors } from "../slice/sheetSlice";
import { InlineMath } from "react-katex";
import { parse } from "path";
import { isElement } from "lodash";

interface LanguageCellProps {
  cellLoc: CellLocator,
  isEdited: boolean,
  onDataChanged: (getData: () => any) => void,
}

interface LanguageCellData {
  constants: string,
  predicates: string,
  functions: string,
}

export const initialLanguageCellData: LanguageCellData = {
  constants: '',
  predicates: '',
  functions: '',
}

function parseOrEmpty<T>(value: string, parseFunction: (value: string) => Array<T>): Array<T> {
  try {
    return parseFunction(value);
  } catch (_) {
    return [];
  }
}

function getParseError<T>(value: string, parseFunction: (value: string) => Array<T>): string | undefined {
  try {
    parseFunction(value);
    return undefined;
  } catch (e) {
    return (e as SyntaxError).message;
  }
}

const symsetDefIntro = (symset: string, isExtension: boolean) => (
  `\\mathcal{${symset}}_{\\mathcal{L}} ${isExtension ? `:= \\mathcal{${symset}}_{\\mathcal{L}} \\uplus` : '='}`
);

const symStr = (sym: string) => {
  const [name, arity] = sym.split('/');
  const escapedName = name.trim().replaceAll('_', '\\_');
  if (arity === undefined) {
    return `\\text{\\textsf{${escapedName}}}`;
  }
  return `\\text{\\textsf{${escapedName}}}^{${arity.trim()}}`;
}

const symsetDef = (name: string, symset: string, isExtension: boolean): string =>
  `${symsetDefIntro(name, isExtension)} ${symset.length > 0 ?
    `\\{${symset.split(',').map(symStr).join(', ')}\\}`
  : '\\emptyset'}`;

export default function LanguageCell({ cellLoc, isEdited, onDataChanged }: LanguageCellProps) {
  const context = useAppSelector(sheetSelectors.logicContext(cellLoc))
  const cell = useAppSelector(sheetSelectors.cell(cellLoc));
  const data = { ...(cell.data as LanguageCellData) };

  const [constants, setConstants] = useState(data.constants)
  const [predicates, setPredicates] = useState(data.predicates)
  const [functions, setFunctions] = useState(data.functions)
  const [constantsParseError, setConstantsParseError] = useState<string | undefined>(getParseError(constants, parseConstants));
  const [predicatesParseError, setPredicatesParseError] = useState<string | undefined>(getParseError(predicates, parsePredicates));
  const [functionsParseError, setFunctionsParseError] = useState<string | undefined>(getParseError(functions, parseFunctions));

  const syncedState = useRef({ constants, predicates, functions })
  syncedState.current = { constants, predicates, functions }
  const getData = () => syncedState.current

  const dispatch = useDispatch();

  // extend logic context after exit from edit mode
  useEffect(() => {
    if (!isEdited) {
      dispatch(sheetActions.extendLogicContext({
        cellLoc, contextExtension: {
          constants: parseOrEmpty(constants, parseConstants),
          predicates: parseOrEmpty(predicates, v => parsePredicates(v)),
          functions: parseOrEmpty(functions, v => parseFunctions(v)),
        }
      }))
    }
  }, [isEdited])

  const updateData = (value: string, setFunction: (v: string) => void) => {
    setFunction(value);
    onDataChanged(getData);
  }

  const isExtension = useMemo(() => 
    context.constants.length + context.predicates.length + context.functions.length > 0
  , [context.constants, context.predicates, context.functions])

  const title = isExtension ? 'Language extension' : 'Language definition';

  const symsets = [
    {
      name: 'C',
      value: constants,
      setValue: setConstants,
      parser: parseConstants,
      parseError: constantsParseError,
      setParseError: setConstantsParseError
    },
    {
      name: 'P',
      value: predicates,
      setValue: setPredicates,
      parser: parsePredicates,
      parseError: predicatesParseError,
      setParseError: setPredicatesParseError
    },
    {
      name: 'F',
      value: functions,
      setValue: setFunctions,
      parser: parseFunctions,
      parseError: functionsParseError,
      setParseError: setFunctionsParseError
    }
  ]

  if (isEdited) {
    return (
      <ContextCell title={title}>
        {symsets.map(({ name, value, setValue, parser, parseError, setParseError }) =>
          <LanguageInput
            key={name}
            label={symsetDefIntro(name, isExtension)}
            value={value}
            updateFunction={setValue}
            parser={parser}
            parseError={parseError}
            setParseError={setParseError}
          />
        )}
      </ContextCell>
    )
  } else {
    return (
      <ContextCell title={title}>
        {symsets.map(symset =>
          <div key={symset.name} className="mb-2">
            <div><InlineMath math={symsetDef(symset.name, symset.value, isExtension)} /></div>
            {symset.parseError !== undefined && <div className="text-danger small">{symset.parseError}</div>}
          </div>
        )}
      </ContextCell>
    )
  }
}

interface LanguageInputProps {
  label: string,
  value: string,
  updateFunction: (v: string) => void,
  parser: (v: string) => any[],
  parseError: string | undefined,
  setParseError: React.Dispatch<React.SetStateAction<string | undefined>>,
}

function LanguageInput({ label, value, updateFunction, parser, parseError, setParseError }: LanguageInputProps) {
  const changeHandler = (v: string) => {
    updateFunction(v);
    setParseError(getParseError(v, parser));
  }
  const isInvalid = parseError !== undefined;

  return (
    <InputGroup className="mb-2" hasValidation={isInvalid}>
      <InputGroup.Text><InlineMath>{`${label} \\{`}</InlineMath></InputGroup.Text>
      <Form.Control isInvalid={isInvalid} value={value} onChange={e => changeHandler(e.target.value)} />
      <InputGroup.Text><InlineMath>{"\\}"}</InlineMath></InputGroup.Text>
      { isInvalid && <FormControl.Feedback type="invalid">{parseError}</FormControl.Feedback> }
    </InputGroup>
  )
}
