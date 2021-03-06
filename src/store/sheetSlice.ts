import { createEntityAdapter, createSlice, EntityState, PayloadAction } from "@reduxjs/toolkit";
import { AppDispatch, RootState } from './store'

interface Comment {
  id: number,
  author: string,
  timestamp: number,
  text: string,
}

const commentsAdapter = createEntityAdapter({
  sortComparer: (a: Comment, b: Comment) => a.timestamp - b.timestamp
});

export interface Cell {
  id: number,
  type: string,
  idCounter: number,
  comments: EntityState<Comment>,
  isEdited: boolean,
  data: any,
}

export interface FileInfo {
  owner: string,
  repo: string,
  branch: string,
  path: string,
  sha: string,
}

export interface Sheet {
  idCounter: number,
  cells: { [key: number]: Cell },
  cellsOrder: Array<number>,
  firstCellId: number,
  lastCellId: number,
  editedCellId?: number,
}

interface CommitInfo {
  id: number,
  message: string,
  json: string,
}

export type SheetState = 'loaded' | 'not_loaded' | 'load_error' | 'save_error' | 'update_detected';

export interface SheetSliceData {
  state: SheetState,
  sheet: Sheet,
  commitIdCounter: number,
  commitQueue: Array<CommitInfo>,
  resumeCommitter? : boolean,
  queueHead?: CommitInfo
  fileInfo?: FileInfo,
  cellToDelete?: {cellId: number, cellIndex: number},
  errorCode?: number,
  error?: string
}

export const emptySheet: Sheet = {
  idCounter: 0,
  cells: {},
  cellsOrder: [],
  firstCellId: -1,
  lastCellId: -1,
};

const initialState: SheetSliceData = {
  state: 'not_loaded',
  commitIdCounter: 0,
  commitQueue: [],
  sheet: emptySheet,
}

export const sheetSlice = createSlice({
  name: 'sheet',
  initialState,
  reducers: {
    loadSheet: (state, action: PayloadAction<{ json: string, fileInfo: FileInfo }>) => {
      const { json, fileInfo } = action.payload;
      let sheet = null;
      try {
        sheet = JSON.parse(json);
      } catch (e) {
        const syntaxErr = e as SyntaxError
        state.state = "load_error"
        state.error = `Súbor zošita je poškodený. (${syntaxErr.message})`
      }
      if (sheet) {
        const { passed, error } = testSheetIntegrity(sheet);
        if (!passed) {
          state.state = "load_error"
          state.error = `Súbor zošita je poškodený. (${error})`;
        } else {
          state.fileInfo = fileInfo;
          state.sheet = sheet;
          state.state = 'loaded';
        }
      }
    },
    clearSheet: (state) => {
      state = initialState;
    },
    dequeueCommit: (state, action: PayloadAction<{ id: number, updateSha: string }>) => {
      const { id, updateSha } = action.payload;
      if (state.commitQueue.length !== 0) {
        if (state.commitQueue[0].id === id) {
          state.commitQueue.shift();
          state.fileInfo && (state.fileInfo.sha = updateSha);
          if (state.commitQueue.length !== 0) {
            state.queueHead = state.commitQueue[0];
          } else {
            state.queueHead = undefined;
          }
        } else {
          console.log('dequeueCommit: head contains different commit id');
        }
      } else {
        console.log('Commit queue is empty, cannot call dequeueCommit');
      }
    },
    saveError: (state, action: PayloadAction<{errorCode: number, errorMsg: string}>) => {
      const { errorCode, errorMsg } = action.payload;
      state.state = 'save_error';
      state.errorCode = errorCode;
      state.error = errorMsg;
    },
    resumeCommitter: (state) => {
      state.resumeCommitter = true;
    },
    resumeCommitterAck: (state) => {
      state.state = 'loaded';
      state.resumeCommitter = undefined;
    },
    insertCell: (state, action: PayloadAction<{ afterIndex: number, type: string, data: string }>) => {
      const { afterIndex, type, data } = action.payload;
      const { sheet } = state;
      if (afterIndex >= -2 && afterIndex < sheet.cellsOrder.length) {
        const cell: Cell = {
          id: sheet.idCounter,
          type, data,
          idCounter: 0,
          comments: commentsAdapter.getInitialState(),
          isEdited: false,
        };

        sheet.cells[cell.id] = cell;
        if (action.payload.afterIndex === -2) {
          sheet.cellsOrder.push(cell.id);
        } else {
          sheet.cellsOrder.splice(action.payload.afterIndex + 1, 0, cell.id);
        }
        sheet.idCounter += 1;
        updateFirstLastCellId(sheet);
        enqueUpdate(state, `Created new cell of type '${type}'`)
      } else {
        console.log('Invalid afterIndex parameters for insertCell action. ' + action.payload);
      }
    },
    removeCell: (state) => {
      if (state.cellToDelete !== undefined) {
        const { cellIndex, cellId } = state.cellToDelete;
        const { sheet } = state;
        if (cellIndex >= 0 && cellIndex < sheet.cellsOrder.length && sheet.cells[cellId] !== undefined) {
          delete sheet.cells[cellId];
          sheet.cellsOrder.splice(cellIndex, 1);
          if (sheet.editedCellId === cellId) {
            sheet.editedCellId = undefined;
          }
          state.cellToDelete = undefined;
          enqueUpdate(state, `Removed cell ${cellId}`);
        } else {
          console.log('Invalid arguments for removeCell action. ' + state.cellToDelete);
        }
      } else {
        console.log('Cell to delete is specified with confirmCellDelete action');
      }
    },
    updateCellData: (state, action: PayloadAction<{ cellId: number, data: any }>) => {
      const { cellId, data } = action.payload;
      const { sheet } = state;
      if (sheet.cells[cellId] !== undefined) {
        sheet.cells[cellId].data = data;
        console.log(`updating cell ${cellId} data`)
        //console.log(data);
        enqueUpdate(state, `Updated cell ${cellId}`)
      } else {
        console.log('Invalid cellId parameters for updateCellData action. ' + action.payload);
      }
    },
    addCellComment: (state, action: PayloadAction<{ cellId: number, author: string, text: string }>) => {
      const { cellId, author, text } = action.payload;
      const { sheet } = state;
      if (sheet.cells[cellId] !== undefined) {
        const cell = sheet.cells[cellId];
        const comment: Comment = {
          author, text, timestamp: new Date().getTime(), id: cell.idCounter++
        }
        commentsAdapter.addOne(cell.comments, comment);
        enqueUpdate(state, `Added comment to cell ${cellId}`);
      } else {
        console.log('Invalid cellId parameters for addCellComment action. ' + action.payload);
      }
    },
    removeCellComment: (state, action: PayloadAction<{ cellId: number, commentId: number }>) => {
      const { cellId, commentId } = action.payload;
      const { sheet } = state;
      if (sheet.cells[cellId] !== undefined) {
        const cell = sheet.cells[cellId];
        commentsAdapter.removeOne(cell.comments, commentId);
        enqueUpdate(state, `Removed comment of cell ${cellId}`);
      } else {
        console.log('Invalid cellId parameters for removeCellComment action. ' + action.payload);
      }
    },
    moveUpCell: (state, action: PayloadAction<number>) => {
      const cellIndex = action.payload;
      const { sheet } = state;
      if (cellIndex >= 1 && cellIndex < sheet.cellsOrder.length) {
        const cellId = sheet.cellsOrder[cellIndex];
        sheet.cellsOrder.splice(cellIndex, 1);
        sheet.cellsOrder.splice(cellIndex - 1, 0, cellId)
        updateFirstLastCellId(sheet);
        enqueUpdate(state, `Moved up cell ${cellId}`)
      } else {
        console.log('Invalid cellIndex parameters for moveUpCell action. ' + action.payload);
      }
    },
    moveDownCell: (state, action: PayloadAction<number>) => {
      const cellIndex = action.payload;
      const { sheet } = state;
      if (cellIndex >= 0 && cellIndex < sheet.cellsOrder.length - 1) {
        const cellId = sheet.cellsOrder[cellIndex];
        sheet.cellsOrder.splice(cellIndex, 1);
        sheet.cellsOrder.splice(cellIndex + 1, 0, cellId)
        updateFirstLastCellId(sheet);
        enqueUpdate(state, `Moved down cell ${cellId}`)
      } else {
        console.log('Invalid cellIndex parameters for moveDownCell action. ' + action.payload);
      }
    },
    setCellEdited: (state, action: PayloadAction<{ cellId: number, isEdited: boolean }>) => {
      const { cellId, isEdited } = action.payload;
      if (isEdited && state.sheet.editedCellId !== undefined) {
        state.sheet.cells[state.sheet.editedCellId].isEdited = false
      }
      if (cellId in state.sheet.cells) {
        state.sheet.cells[cellId].isEdited = isEdited
        if (isEdited) {
          state.sheet.editedCellId = cellId;
        }
      }
    },
    confirmCellDelete: (state, action: PayloadAction<{cellId: number, cellIndex: number} | undefined>) => {
      state.cellToDelete = action.payload;
    }
  }
});

function enqueUpdate(data: SheetSliceData, message: string) {
  const commit = { id: data.commitIdCounter++, message, json: JSON.stringify(data.sheet, null, 2) };
  data.commitQueue.push(commit);
  if (data.commitQueue.length === 1) {
    data.queueHead = commit;
  }
}

function updateFirstLastCellId(state: Sheet) {
  if (state.cellsOrder.length === 0) {
    state.firstCellId = -1;
    state.lastCellId = -1;
  } else {
    state.firstCellId = state.cellsOrder[0];
    state.lastCellId = state.cellsOrder[state.cellsOrder.length - 1];
  }
}

function testSheetIntegrity(sheet: Sheet): { passed: boolean, error?: string } {
  let error = undefined;

  /* test keys and types of sheet object */
  const reqKeys: { [key: string]: string } = {
    'idCounter': 'number',
    'cells': 'object',
    'cellsOrder': 'object',
    'firstCellId': 'number',
    'lastCellId': 'number',
    'editedCellId': 'number',
  }
  for (const [key, value] of Object.entries(sheet)) {
    if (!(key in sheet)) {
      error = `Chýba kľúč '${key}'`;
      break;
    }
    if (typeof value !== reqKeys[key]) {
      error = `Kľúč '${key}' je nesprávneho typu`;
      break;
    }
  }
  if (error) return { passed: false, error };

  /* idCounter is bigger than max id */
  const ids = Object.keys(sheet.cells).map(str => parseInt(str));
  if (sheet.idCounter <= Math.max(...ids)) {
    error = 'Hodnota idCounter je menšia ako maximálne ID bunky';
  }
  if (error) return { passed: false, error };

  /* cellsOrder has no duplicates */
  if (new Set(sheet.cellsOrder).size !== sheet.cellsOrder.length) {
    error = 'Poradie buniek obsahuje duplicitné hodnoty';
  }
  if (error) return { passed: false, error };


  return { passed: true }
}

const addCellComment = function (payload: { cellId: number, text: string }) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    if (state.auth.user) {
      const author = state.auth.user.login;
      const { cellId, text } = payload;
      dispatch(sheetSlice.actions.addCellComment({ cellId, author, text }));
    }
  }
}

const remmoveCellComment = function (payload: { cellId: number, commentId: number }) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    const { cellId, commentId } = payload;
    const cell = state.sheet.sheet.cells[cellId]
    if (cell !== undefined) {
      if (state.auth.user) {
        const user = state.auth.user.login;
        const comment = commentsAdapter.getSelectors().selectById(cell.comments, commentId);
        if (comment) {
          if (comment.author === user) {
            dispatch(sheetSlice.actions.removeCellComment({cellId, commentId}));
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

/* Actions */
const insertTextCell = (text: string, afterIndex: number) => sheetActions.insertCell({ afterIndex, type: 'text', data: text })
const insertAppCell = (type: string, state: any, afterIndex: number) => sheetActions.insertCell({ afterIndex, type, data: state })
export const sheetActions = { ...sheetSlice.actions, addCellComment, remmoveCellComment, insertTextCell, insertAppCell };
/* Selectors */
export const sheetSelectors = {
  state: (state: RootState) => state.sheet.state,
  error: (state: RootState) => state.sheet.error,
  errorCode: (state: RootState) => state.sheet.errorCode,
  commitQueueHead: (state: RootState) => state.sheet.queueHead,
  commitQueue: (state: RootState) => state.sheet.commitQueue,
  resumeCommitter: (state: RootState) => state.sheet.resumeCommitter,
  fileInfo: (state: RootState) => state.sheet.fileInfo,
  cellsOrder: (state: RootState) => state.sheet.sheet.cellsOrder,
  cells: (state: RootState) => state.sheet.sheet.cells,
  cell: (cellId: number) => { return (state: RootState) => state.sheet.sheet.cells[cellId] },
  firstCellId: (state: RootState) => state.sheet.sheet.firstCellId,
  lastCellId: (state: RootState) => state.sheet.sheet.lastCellId,
  cellComments: (cellId: number) => { return (state: RootState) => commentsAdapter.getSelectors().selectAll(state.sheet.sheet.cells[cellId].comments) },
  cellToDelete: (state: RootState) => state.sheet.cellToDelete,
}

export default sheetSlice.reducer;