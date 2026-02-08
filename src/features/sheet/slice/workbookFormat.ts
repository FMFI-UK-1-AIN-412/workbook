import { ContextExtension } from "./logicContext";
import { Cell, SheetFile, SheetSettings, commentsAdapter } from "./sheetSlice";
import lodash from "lodash"

export function serializeWorkbook(workbook: SheetFile) {
  return JSON.stringify(workbook, null, 2)
}

export function deserializeWorkbook(workbook: string)
  : { result: 'success', sheetFile: SheetFile }
  | { result: 'error', message: string } {
  try {
    var sheetFile = JSON.parse(workbook);
    if (typeof sheetFile !== 'object') {
      return {
        result: 'error',
        message: `Parsed JSON has to be object, it is ${typeof sheetFile}`
      }
    }
  } catch (e) {
    const syntaxErr = e as SyntaxError
    return {
      result: 'error',
      message: `JSON parse failed: ${syntaxErr}`
    }
  }

  if ('versionNumber' in sheetFile && sheetFile.versionNumber === 2) {
    try {
      sheetFile = deserializeWorkbook2(sheetFile);
    } catch (e) {
      return {
        result: 'error',
        message: `Error while deserializing simplified format ${e}`
      }
    }
  }

  const { passed, error } = testSheetIntegrity(sheetFile);
  if (passed) {
    return { result: 'success', sheetFile }
  } else {
    console.error('Sheet integrity test failed:', error, sheetFile);
    return {
      result: 'error',
      message: error!
    }
  }
}

export function testSheetIntegrity(sheet: SheetFile): { passed: boolean, error?: string } {
  let error = undefined;

  /* test keys and types of sheet object */
  const reqKeys: { [key: string]: string } = {
    'cells': 'object',
    'cellsOrder': 'object',
  }
  /* optional keys */
  const optKeys: { [key: string]: string } = {
    /* now unused --> */
    'idCounter': 'number',
    'editedCellId': 'number',
    'firstCellId': 'number',
    'lastCellId': 'number',
    /* <-- */
    'versionNumber': 'number',
    'settings': 'object',
  }

  /* check for presence of required keys */
  for (const [key] of Object.entries(reqKeys)) {
    if (!(key in sheet)) {
      error = `Chýba kľúč '${key}'`;
      break;
    }
  }
  if (error) return { passed: false, error };

  for (const [key, value] of Object.entries(sheet)) {
    const keyType = key in reqKeys ? 'REQUIRED' : (key in optKeys ? 'OPTIONAL' : 'UNKNOWN')
    if (keyType === 'UNKNOWN') {
      error = `Neznámy kľúč '${key}'`;
      break;
    }
    if (keyType === 'OPTIONAL' && value === undefined) {
      continue;
    }
    const expectedType = keyType === 'REQUIRED' ? reqKeys[key] : optKeys[key]
    if (typeof value !== expectedType) {
      error = `Kľúč '${key}' je nesprávneho typu (${typeof value} namiesto očakávaného ${expectedType})`;
      break;
    }
  }
  if (error) return { passed: false, error };

  /* TODO? Cell and CellComment keys test */

  /* cellsOrder has no duplicates */
  if (new Set(sheet.cellsOrder).size !== sheet.cellsOrder.length) {
    error = 'Poradie buniek obsahuje duplicitné hodnoty';
  }
  if (error) return { passed: false, error };

  /* cellsOrder contains only existing cell ids */
  for (const id of sheet.cellsOrder) {
    if (!(id in sheet.cells)) {
      error = 'Poradie buniek obsahuje neexistujúce id';
      break;
    }
  }
  if (error) return { passed: false, error };

  return { passed: true }
}


interface SimplifiedFormat {
  versionNumber: 2,
  cells: Array<{
    id: number,
    type: string,
    comments: Array<{
      id: number,
      author: string,
      timestamp: number,
      text: string
    }>
    data: any,
    contextExtension?: ContextExtension,
  }>,
  settings?: SheetSettings,
}
type ArrayItemType<T> = T extends Array<infer U> ? U : never
type SimplifiedCell = ArrayItemType<SimplifiedFormat['cells']>
type SimplifiedComment = ArrayItemType<ArrayItemType<SimplifiedFormat['cells']>['comments']>


function simplifyContext(cellsOrder: number[], cells: SheetFile['cells']): SimplifiedCell[] {
  const result: SimplifiedCell[] = []
  for (let cellId of cellsOrder) {
    const wcell = cells[cellId]
    const comments: SimplifiedComment[] = commentsAdapter
      .getSelectors()
      .selectAll(wcell.comments)

    const {
      idCounter: _1,
      comments: _2,
      ...simplifiedCell
    } = wcell

    const cell: SimplifiedCell = {
      ...simplifiedCell,
      data: wcell.type === 'context'
        ? simplifyContext(wcell.data, cells)
        : simplifiedCell.data,
      comments
    }
    result.push(cell);

  }
  return result;
}

export function serializeWorkbook2(workbook: SheetFile) {
  const content: SimplifiedFormat = {
    versionNumber: 2,
    cells: simplifyContext(workbook.cellsOrder, workbook.cells),
    settings: workbook.settings
  }
  return JSON.stringify(content, null, 2)
}

function convertContext(simplifiedContext: SimplifiedCell[], cells: SheetFile['cells']): number[] {
  const cellsOrder: number[] = [];
  for (let sCell of simplifiedContext) {
    cellsOrder.push(sCell.id);
    const comments: Cell['comments'] = commentsAdapter.addMany(
      commentsAdapter.getInitialState(), 
      sCell.comments
    )
    const { comments: _, ...cell } = sCell;
    cells[sCell.id] = {
      ...cell,
      data: sCell.type === 'context'
        ? convertContext(sCell.data as SimplifiedCell[], cells)
        : sCell.data,
      idCounter: Math.max(-1, ...sCell.comments.map(c => c.id)) + 1,
      comments
    }
  }
  return cellsOrder
}

export function deserializeWorkbook2(workbook: SimplifiedFormat): SheetFile {
  const cells: SheetFile['cells'] = {}
  const cellsOrder = convertContext(workbook.cells, cells)
  const settings = workbook.settings;

  return {
    versionNumber: 2,
    cells,
    cellsOrder,
    settings
  };
}

export function compareSheetFiles(s1: SheetFile, s2: SheetFile) {
  if (!lodash.isEqual(s1.cellsOrder, s2.cellsOrder)) {
    console.error('Sheet comparison: different cellsOrder')
    return false;
  }
  if (!lodash.isEqual(s1.settings, s2.settings)) {
    console.error('Sheet comparison: different settings')
    return false;
  }
  if (!lodash.isEqual(Object.keys(s1.cells), Object.keys(s2.cells))) {
    console.error('Sheet comparison: keys in cell object')
    return false;
  }
  for (let cell1 of Object.values(s1.cells)) {
    const cell2 = s2.cells[cell1.id];
    const { idCounter: _1, comments: comments1, ...cellCmp1 } = cell1
    const { idCounter: _2, comments: comments2, ...cellCmp2 } = cell2
    const commentsCmp1 = commentsAdapter.getSelectors().selectAll(comments1)
    const commentsCmp2 = commentsAdapter.getSelectors().selectAll(comments2)
    if (cell1.idCounter < 0 || cell2.idCounter < 0) {
      console.error('Sheet comparison: invalid idCounter in cell', cell1.id)
      return false;
    }
    if (!lodash.isEqual(cellCmp1, cellCmp2)) {
      console.error('Sheet comparison: different cells with id', cell1.id)
      return false;
    }
    if (!lodash.isEqual(commentsCmp1, commentsCmp2)) {
      console.error('Sheet comparison: different comments in cell with id', cell1.id)
      return false;
    }
  }
  return true;
}
