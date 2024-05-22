import { AnyAction, createEntityAdapter, createSlice, EntityState, PayloadAction } from "@reduxjs/toolkit";
import undoable, { includeAction } from "redux-undo";
import { AppDispatch, RootState } from '../../../app/store'
import { ContextExtension, cellContext, clearContextMemo } from "./logicContext";
import { deserializeWorkbook, serializeWorkbook } from "./workbookFormat";
import { WritableDraft } from "immer/dist/internal";

export interface CellComment {
  id: number,
  author: string,
  timestamp: number,
  text: string,
}

export const commentsAdapter = createEntityAdapter({
  sortComparer: (a: CellComment, b: CellComment) => a.timestamp - b.timestamp
});

export interface Cell {
  id: number,
  type: string,
  idCounter: number,
  comments: EntityState<CellComment>,
  data: any,
  contextExtension?: ContextExtension,
}

export interface SheetSettings {
  katexMacros?: string
  github?: {
    editBranch: string,
    handinBranch: string,
  }
}

const defaultSettings: SheetSettings = {
  katexMacros: ''
}

export interface SheetFile {
  versionNumber?: number,
  settings?: SheetSettings,
  cells: { [key: number]: Cell },
  cellsOrder: number[],
}

export const emptySheet: SheetFile = {
  versionNumber: 1,
  cells: {},
  cellsOrder: [],
};

export interface LocalState {
  sheetId: string,
  cellIdCounter: number,
  undoRedoCounter: number,
  lastCreatedCellId?: number,
}

export type SheetState = 'not_loaded' | 'loading' | 'loaded' | 'load_error';

export interface SheetSlice {
  state: SheetState,
  errorMessage?: string,
  sheetFile: SheetFile,
  localState: LocalState,
  filename: string
}

const initialState: SheetSlice = {
  state: 'not_loaded',
  sheetFile: emptySheet,
  localState: {
    cellIdCounter: 0,
    undoRedoCounter: 0,
    sheetId: 'initial',
  },
  filename: '',
}

export const sheetSlice = createSlice({
  name: 'sheet',
  initialState,
  reducers: {
    setErrorMessage: (state, action: PayloadAction<{ message: string | undefined, newState: SheetState | undefined }>) => {
      const { message, newState } = action.payload;
      state.errorMessage = message;
      if (newState !== undefined) {
        state.state = newState;
      }
    },
    startLoading: (state) => {
      state.state = 'loading';
    },
    initFromJson: (state, action: PayloadAction<{ filename: string, json: string, sheetId: string }>) => {
      const { filename, json, sheetId } = action.payload;

      state.sheetFile = emptySheet;
      state.filename = filename;
      state.localState = {
        ...initialState.localState,
        sheetId
      }

      const res = deserializeWorkbook(json);
      if (res.result === 'success') {
        const { sheetFile } = res;

        const { localState } = state;
        const sf = sheetFile as SheetFile;
        state.sheetFile = sheetFile;

        // initialize cellIdCounter with max cell id + 1
        localState.cellIdCounter = Object.entries(sf.cells).map(e => e[1].id).reduce((prev, cur) => Math.max(prev, cur), 0) + 1

        state.state = 'loaded';
      } else {
        state.state = "load_error";
        state.errorMessage = res.message
      }
    },
    insertCell: (state, action: PayloadAction<{ after: CellLocator, type: string, data: any }>) => {
      const { after, type, data } = action.payload;
      const { index: afterIndex } = after;
      const cellsOrder = getParentCellsOrder(state, after);
      console.log('Inserting cell ', action);
      if (afterIndex >= -2 && afterIndex < cellsOrder.length) {
        const cell: Cell = {
          id: state.localState.cellIdCounter,
          type, data,
          idCounter: 0,
          comments: commentsAdapter.getInitialState(),
        };

        state.sheetFile.cells[cell.id] = cell;
        if (afterIndex === -2) {
          cellsOrder.push(cell.id);
        } else {
          cellsOrder.splice(afterIndex + 1, 0, cell.id);
        }

        state.localState.cellIdCounter += 1;
        state.localState.lastCreatedCellId = cell.id;
        updateHistory(action, `Created new cell of type '${type}'`)
      } else {
        console.log('Invalid afterIndex parameters for insertCell action. ' + action.payload);
      }
    },
    duplicateCell: (state, action: PayloadAction<CellLocator>) => {
      const { id: cellId, index: cellIndex, contextId } = action.payload;
      const cellsOrder = getParentCellsOrder(state, action.payload);

      const duplicateCell = (id: number) => {
        const srcCell = state.sheetFile.cells[id];
        const { type } = srcCell;
        const data = JSON.parse(JSON.stringify(srcCell.data))
        let contextExtension = undefined;
        if (srcCell.contextExtension) {
          contextExtension = JSON.parse(JSON.stringify(srcCell.contextExtension))
        }

        const newCell: Cell = {
          id: state.localState.cellIdCounter,
          type, data,
          idCounter: 0,
          comments: commentsAdapter.getInitialState(),
          contextExtension,
        };
        state.localState.cellIdCounter += 1;
        state.sheetFile.cells[newCell.id] = newCell;
        return newCell.id;
      }

      if (state.sheetFile.cells[cellId] !== undefined) {
        if (state.sheetFile.cells[cellId].type === 'context') {
          const cid = duplicateCell(cellId);
          cellsOrder.splice(cellIndex + 1, 0, cid);
          let newCellsOrder: number[] = []
          for (let id of state.sheetFile.cells[cellId].data as number[]) {
            newCellsOrder.push(duplicateCell(id));
          }
          state.sheetFile.cells[cid].data = newCellsOrder;
          updateHistory(action, `Duplicated context ${cellId}`)
        } else {
          cellsOrder.splice(cellIndex + 1, 0, duplicateCell(cellId));
          updateHistory(action, `Duplicated cell ${cellId}`)
        }
      } else {
        console.log('Invalid cellId parameter for duplicateCell action. ' + action.payload);
      }
    },
    updateCellData: (state, action: PayloadAction<{ cellLoc: CellLocator, data: any }>) => {
      const { cellLoc, data } = action.payload;
      const { id: cellId } = cellLoc;
      if (state.sheetFile.cells[cellId] !== undefined) {
        state.sheetFile.cells[cellId].data = data;
        console.log(`updating cell ${cellId} data`)
        //console.log(data);
        updateHistory(action, `Updated cell ${cellId}`)
      } else {
        console.log('Invalid cellId parameters for updateCellData action. ' + action.payload);
      }
    },
    addCellComment: (state, action: PayloadAction<{ cellLoc: CellLocator, author: string, text: string }>) => {
      const { cellLoc, author, text } = action.payload;
      const { id: cellId } = cellLoc;
      if (state.sheetFile.cells[cellId] !== undefined) {
        const cell = state.sheetFile.cells[cellId];
        const comment: CellComment = {
          author, text, timestamp: new Date().getTime(), id: cell.idCounter++
        }
        commentsAdapter.addOne(cell.comments, comment);
        updateHistory(action, `Added comment to cell ${cellId}`);
      } else {
        console.log('Invalid cellId parameters for addCellComment action. ' + action.payload);
      }
    },
    updateCellComment: (state, action: PayloadAction<{ cellLoc: CellLocator, commentId: number, text: string }>) => {
      const { cellLoc, commentId, text } = action.payload;
      const { id: cellId } = cellLoc;
      if (state.sheetFile.cells[cellId] !== undefined) {
        const cell = state.sheetFile.cells[cellId];

        commentsAdapter.updateOne(cell.comments, { id: commentId, changes: { text, timestamp: new Date().getTime() } })
        updateHistory(action, `Updated comment ${commentId} in cell ${cellId}`);
      } else {
        console.log('Invalid cellId parameters for updateCellComment action. ' + action.payload);
      }
    },
    moveUpCell: (state, action: PayloadAction<CellLocator>) => {
      const { index: cellIndex } = action.payload;
      const cellsOrder = getParentCellsOrder(state, action.payload);
      if (cellIndex >= 1 && cellIndex < cellsOrder.length) {
        const cellId = cellsOrder[cellIndex];
        cellsOrder.splice(cellIndex, 1);
        cellsOrder.splice(cellIndex - 1, 0, cellId);
        updateHistory(action, `Moved up cell ${cellId}`);
      } else {
        console.log('Invalid cellIndex parameters for moveUpCell action. ' + action.payload);
      }
    },
    moveDownCell: (state, action: PayloadAction<CellLocator>) => {
      const { index: cellIndex } = action.payload;
      const cellsOrder = getParentCellsOrder(state, action.payload);
      if (cellIndex >= 0 && cellIndex < cellsOrder.length - 1) {
        const cellId = cellsOrder[cellIndex];
        cellsOrder.splice(cellIndex, 1);
        cellsOrder.splice(cellIndex + 1, 0, cellId)
        updateHistory(action, `Moved down cell ${cellId}`)
      } else {
        console.log('Invalid cellIndex parameters for moveDownCell action. ' + action.payload);
      }
    },
    deleteCell: (state, action: PayloadAction<CellLocator>) => {
      const { id: cellId, index: cellIndex } = action.payload;
      const cellsOrder = getParentCellsOrder(state, action.payload);

      if (cellIndex >= 0 && cellIndex < cellsOrder.length && state.sheetFile.cells[cellId] !== undefined) {
        const deleteContextCells = (cid: number) => {
          if (state.sheetFile.cells[cid].type === 'context') {
            for (let nid of state.sheetFile.cells[cellId].data as number[]) {
              deleteContextCells(nid);
              delete state.sheetFile.cells[nid];
            }
          }
        }
        deleteContextCells(cellId);
        delete state.sheetFile.cells[cellId];
        cellsOrder.splice(cellIndex, 1);
        updateHistory(action, `Removed cell ${cellId}`);
      } else {
        console.log(`Invalid payload values for cell deletion. (payload: ${action.payload})`);
      }
    },
    deleteComment: (state, action: PayloadAction<{ cellLoc: CellLocator, commentId: number }>) => {
      const { cellLoc, commentId } = action.payload;
      const { id: cellId } = cellLoc;
      if (state.sheetFile.cells[cellId] !== undefined) {
        const cell = state.sheetFile.cells[cellId];
        commentsAdapter.removeOne(cell.comments, commentId);
        updateHistory(action, `Removed comment of cell ${cellId}`);
      } else {
        console.log(`Invalid cellId parameter for comment deletion. (payload: ${action.payload})`);
      }
    },
    updateSettings: (state, action: PayloadAction<SheetSettings | undefined>) => {
      state.sheetFile.settings = action.payload
      updateHistory(action, 'Updated sheet settings');
    },
    syncUndoRedoCounter: (state, action: PayloadAction<number>) => {
      state.localState.undoRedoCounter = action.payload;
    },
    extendLogicContext: (state, action: PayloadAction<{ cellLoc: CellLocator, contextExtension: ContextExtension }>) => {
      const { cellLoc, contextExtension } = action.payload;
      if (JSON.stringify(state.sheetFile.cells[cellLoc.id].contextExtension) !== JSON.stringify(contextExtension)) {
        state.sheetFile.cells[cellLoc.id].contextExtension = contextExtension;
        console.log('updating context of ', cellLoc);
      }
    },
  }
});

export function getParentCellsOrder(state: WritableDraft<SheetSlice>, { contextId }: CellLocator): number[] {
  if (contextId === -1) {
    return state.sheetFile.cellsOrder;
  } else {
    const cellsOrder = state.sheetFile.cells[contextId].data as Array<number>;
    if (cellsOrder === undefined) {
      throw Error('getParentCellsList: unknown context id');
    }
    return cellsOrder;
  }
}

function updateHistory(action: AnyAction, message: string) {
  if ('historyChanged' in action) {
    (action as unknown as { historyChanged: (msg: string) => void }).historyChanged(message);
  } else {
    console.error('Storage middleware not applied');
  }
}

const addCellComment = function (payload: { cellLoc: CellLocator, text: string }) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    if (state.auth.user) {
      const author = state.auth.user.login;
      const { cellLoc, text } = payload;
      dispatch(sheetSlice.actions.addCellComment({ cellLoc, author, text }));
    }
  }
}

const remmoveCellComment = function (payload: { cellLoc: CellLocator, commentId: number }) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const { cellLoc, commentId } = payload;
    const { id: cellId } = cellLoc
    const cell = state.sheet.present.sheetFile.cells[cellId]
    if (cell !== undefined) {
      if (state.auth.user) {
        const user = state.auth.user.login;
        const comment = commentsAdapter.getSelectors().selectById(cell.comments, commentId);
        if (comment) {
          if (comment.author === user) {
            dispatch(sheetSlice.actions.deleteComment({ cellLoc, commentId }));
          } else {
            console.log('You can delete only your own comments. ' + payload);
          }
        } else {
          console.log('Invalid commentId parameter for removeCellComment action. ' + payload);
        }
      } else {
        console.log('Auth state error, can\'t use remmoveCellComment' + payload);
      }
    } else {
      console.log('Invalid cellId parameter for removeCellComment action. ' + payload);
    }
  }
}

export function downloadSheet() {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const serialized = serializeWorkbook(state.sheet.present.sheetFile)
    const url = window.URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
    const link = document.createElement('a');
    link.setAttribute('download', state.sheet.present.filename);
    link.href = url;
    link.click();
    link.remove();
  }
}

function initSheet(filename: string, json: string, sheetId: string) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    clearContextMemo();
    dispatch(sheetActions.initFromJson({filename, json, sheetId }));
  }
}

/* Actions */
const insertTextCell = (text: string, after: CellLocator) => sheetActions.insertCell({ after, type: 'text', data: text })
const insertAppCell = (type: string, state: any, after: CellLocator) => sheetActions.insertCell({ after, type, data: state })
export const sheetActions = { ...sheetSlice.actions, addCellComment, remmoveCellComment, insertTextCell, insertAppCell, initSheet };

export interface CellLocator {
  id: number,
  index: number,
  contextId: number,
}

/* Selectors */
export const sheetSelectors = {
  filename: (state: RootState) => state.sheet.present.filename,
  state: (state: RootState) => state.sheet.present.state,
  sheetId: (state: RootState) => state.sheet.present.localState.sheetId,
  error: (state: RootState) => state.sheet.present.errorMessage,
  cellsOrder: (state: RootState) => state.sheet.present.sheetFile.cellsOrder,
  cells: (state: RootState) => state.sheet.present.sheetFile.cells,
  cell: (cellLoc: CellLocator) => { return (state: RootState) => state.sheet.present.sheetFile.cells[cellLoc.id] },
  sheetSettings: (state: RootState) => state.sheet.present.sheetFile.settings || defaultSettings,
  firstCellId: (state: RootState) => state.sheet.present.sheetFile.cellsOrder.length === 0 ? -1 : state.sheet.present.sheetFile.cellsOrder[0],
  lastCellId: (state: RootState) => state.sheet.present.sheetFile.cellsOrder.length === 0 ? -1 : state.sheet.present.sheetFile.cellsOrder[state.sheet.present.sheetFile.cellsOrder.length - 1],
  cellComments: (cellLoc: CellLocator) => { return (state: RootState) => commentsAdapter.getSelectors().selectAll(state.sheet.present.sheetFile.cells[cellLoc.id].comments) },
  undoRedoCounter: (state: RootState) => state.sheet.present.localState.undoRedoCounter,
  lastCreatedCellId: (state: RootState) => state.sheet.present.localState.lastCreatedCellId,
  logicContext: (cell: CellLocator) => cellContext(cell),
  contextCellsList: (cellLoc: CellLocator) => { return (state: RootState) => getParentCellsOrder(state.sheet.present, cellLoc) },
}

export default undoable(sheetSlice.reducer, {
  filter: includeAction([
    'sheet/insertCell',
    'sheet/duplicateCell',
    'sheet/updateCellData',
    'sheet/addCellComment',
    'sheet/updateCellComment',
    'sheet/moveUpCell',
    'sheet/moveDownCell',
    'sheet/deleteCell',
    'sheet/deleteComment',
    'sheet/updateSettings',
  ])
});