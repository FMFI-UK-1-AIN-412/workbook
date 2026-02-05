import { PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit"
import { AppDispatch, RootState } from "../../app/store"
import { EngineType, InitCommand, Task, Command, TaskResult, swCommand, swTask, LoadResult, CommandResult } from "../../storageWorker/workerApi"
import { sheetActions } from "../sheet/slice/sheetSlice"
import { ActionCreators as UndoActionCreators } from 'redux-undo'

type TaskState = 'waiting' | 'processing' | 'success' | 'error' | 'cancelled'

export interface TaskItem {
  id: number,
  state: TaskState
  result: TaskResult | undefined
  timestamp: number,
  task: Task
}

export interface TaskQueue {
  idCounter: number,
  nextIndex: number,
  items: number[] // task IDs
}

type TaskQueueState = 'idle' | 'task_finished' | 'processing' | 'paused' | 'error' | 'offline_paused'
interface StorageState {
  instanceId: number,
  taskQueueState: TaskQueueState,
  taskError?: string,
  taskQueue: TaskQueue,
  taskById: { [key: number]: TaskItem }
  online: boolean,
  unsyncedChangesCounter: number,
  storageEngine?: {
    type: string,
    custom: any,
  }
}

const initialState: StorageState = {
  instanceId: -1,
  taskQueueState: 'idle',
  taskQueue: {
    idCounter: 0,
    nextIndex: 0,
    items: []
  },
  taskById: {},
  online: false,
  unsyncedChangesCounter: 0,
}

export const storageSlice = createSlice({
  name: 'storage',
  initialState,
  reducers: {
    init: (state, action: PayloadAction<{ engineType: EngineType }>) => {
      // copy initialState
      state.instanceId = Date.now();
      state.taskError = undefined;
      state.taskQueueState = 'idle'
      state.taskQueue = {
        idCounter: 0,
        nextIndex: 0,
        items: []
      }
      state.taskById = {}
      state.unsyncedChangesCounter = 0;
      state.storageEngine = {
        type: action.payload.engineType,
        custom: undefined
      }
    },
    addTask: (state, action: PayloadAction<Task>) => {
      const newTask: TaskItem = {
        id: state.taskQueue.idCounter++,
        state: 'waiting',
        result: undefined,
        timestamp: Math.floor(Date.now() / 1000),
        task: action.payload
      }
      state.taskQueue.items.push(newTask.id)
      state.taskById[newTask.id] = newTask
    },
    processTaskResult: (state, action: PayloadAction<{ id: number, instanceId: number, taskResult: TaskResult }>) => {
      const { id, instanceId, taskResult } = action.payload;
      if (instanceId !== state.instanceId) {
        // this can happen when some task takes too much time (maybe due poor network connection),
        // and by the time it finishes another workbook file was loaded
        console.log('Ignored stray task result')
        return;
      }

      // sanity checks
      if (state.taskQueue.nextIndex >= state.taskQueue.items.length) {
        throw new Error('History queue inconsistent: nextIndex is too big');
      }
      if (state.taskQueue.items[state.taskQueue.nextIndex] !== id) {
        throw new Error('History queue inconsistent: queue item id mismatch');
      }
      if (state.storageEngine === undefined) {
        throw new Error('Storage not initialized');
      }

      const taskItem = state.taskById[id]
      taskItem.result = taskResult

      if (taskResult.result === 'skipped') {
        state.taskQueue.nextIndex++;
        state.taskQueueState = 'task_finished';
      } else {
        if (taskResult.customState !== undefined) {
          state.storageEngine.custom = taskResult.customState;
        }
        if (taskResult.result === "success") {
          taskItem.state = 'success';
          state.taskQueue.nextIndex++;
          state.taskQueueState = 'task_finished';
        } else {
          taskItem.state = 'error';
          if (taskItem.task.skipOnError) {
            state.taskQueue.nextIndex++;
            state.taskQueueState = 'task_finished';
          } else {
            state.taskQueueState = 'error';
            state.taskError = taskResult.errorMessage
          }
        }
      }
      // keep at most 3 processed tasks in queue
      const finished = state.taskQueue.items.filter(
        taskId =>
          state.taskById[taskId].state === 'error'
          || state.taskById[taskId].state === 'success'
          || state.taskById[taskId].state === 'cancelled'
      )
      if (finished.length > 3) {
        const del = finished.length - 3
        state.taskQueue.items.splice(0, del)
        state.taskQueue.nextIndex -= del;
      }
    },
    processCommandResult: (state, action: PayloadAction<{ instanceId: number, commandResult: CommandResult }>) => {
      const { instanceId, commandResult } = action.payload;
      if (instanceId !== state.instanceId) {
        // this can happen when some task takes too much time (maybe due poor network connection),
        // and by the time it finishes another workbook file was loaded
        console.log('Ignored stray command result')
        return;
      }
      if (state.storageEngine === undefined) {
        throw new Error('Storage not initialized');
      }

      if (commandResult.customState !== undefined) {
        state.storageEngine.custom = commandResult.customState;
      }
    },
    setUnsyncedChanges: (state, action: PayloadAction<{ counter: number }>) => {
      state.unsyncedChangesCounter = action.payload.counter;
    },
    setTaskQueueState: (state, action: PayloadAction<TaskQueueState>) => {
      state.taskQueueState = action.payload;
    },
    startTask: (state, action: PayloadAction<{ id: number }>) => {
      const { id } = action.payload
      state.taskById[id].state = 'processing';
      state.taskById[id].result = undefined;
    },
    cancelTask: (state, action: PayloadAction<{ id: number }>) => {
      const taskItem = state.taskById[action.payload.id]
      // if taskItem is undefined, perhaps app should crash, because its a bug
      if (taskItem.state === 'waiting') {
        taskItem.state = 'cancelled';
      }
    },
    resumeQueue: (state) => {
      if (state.storageEngine === undefined) {
        throw new Error('Storage not initialized');
      }
      if (state.taskQueueState === 'error' || state.taskQueueState === 'paused') {
        state.taskQueueState = 'task_finished';
        state.taskError = undefined;
      } else {
        console.error('Cannot resume storage queue');
      }
    }
  },
  extraReducers: {
    'browser/online': (state) => {
      state.online = true;
    },
    'browser/offline': (state) => {
      state.online = false;
    }
  }
});
const privateActions = storageSlice.actions;
export const storageActions = {
  unsyncedChange, enqueueTask, processQueue, resume, syncUnsyncedChanges,
  cancelTask: privateActions.cancelTask
};
export const storageSelectors = {
  isOnline: (state: RootState) => state.storage.online,
  storageEngine: (state: RootState) => state.storage.storageEngine,
  instanceId: (state: RootState) => state.storage.instanceId,
  taskError: (state: RootState) => state.storage.taskError,
  taskQueue: (state: RootState) => state.storage.taskQueue,
  monitorTask: createSelector([
    (state: RootState) => ({ items: state.storage.taskQueue.items, taskById: state.storage.taskById }),
    (state: RootState, type: string) => type
  ], ({ items, taskById }, type) => {
    // @ts-ignore
    const lastProcessed = items.findLast(taskId =>
      taskById[taskId].task.type === type
      && taskById[taskId].state !== 'waiting'
      && taskById[taskId].state !== 'processing'
    )
    const firstUnprocessed = items.find(taskId =>
      taskById[taskId].task.type === type
      && (taskById[taskId].state === 'waiting'
        || taskById[taskId].state === 'processing'
      )
    )
    if (firstUnprocessed !== undefined) {
      return {taskId: firstUnprocessed, task: taskById[firstUnprocessed]}
    }
    if (lastProcessed !== undefined) {
      return {taskId: lastProcessed, task: taskById[lastProcessed]}
    }
    return undefined;
  }),
  lastProcessedTask: createSelector([
    (state: RootState) => ({ items: state.storage.taskQueue.items, taskById: state.storage.taskById }),
    (state: RootState, type: string) => type
  ], ({ items, taskById }, type) => {
    // @ts-ignore
    const taskId = items.findLast(
      (taskId: number) =>
        taskById[taskId].state !== 'waiting'
        && taskById[taskId].state !== 'processing'
        && taskById[taskId].task.type === type
    )
    return taskId === undefined
      ? undefined
      : taskById[taskId]
  }),
  task: (id: number) => (state: RootState) => {
    const task = state.storage.taskById[id];
    return task === undefined ? 'unknown_task' : task
  },
  taskState: (id: number) => (state: RootState) => {
    const task = state.storage.taskById[id];
    return task === undefined ? 'unknown_task' : task.state
  },
  storageSynced: (state: RootState) => {
    const queue = state.storage.taskQueue;
    const unfinishedTasks = queue.items.length - queue.nextIndex;
    return unfinishedTasks === 0
      && state.storage.unsyncedChangesCounter === 0
  },
  storageEngineCustom: (state: RootState) => state.storage.storageEngine?.custom,
  taskQueueState: (state: RootState) => state.storage.taskQueueState,
  unsyncedChanges: (state: RootState) => state.storage.unsyncedChangesCounter,
}

function processQueue() {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const state = getState();
    if (state.storage.taskQueueState === 'idle'
      || state.storage.taskQueueState === 'task_finished'
      || (state.storage.taskQueueState === 'offline_paused' && state.storage.online === true)) {
      // pause history saving when offline
      if (state.storage.online === false) {
        dispatch(privateActions.setTaskQueueState('offline_paused'))
        return;
      }
      // resume history
      if (state.storage.taskQueueState === 'offline_paused' && state.storage.online === true) {
        dispatch(privateActions.setTaskQueueState('task_finished'))
      }

      const queue = state.storage.taskQueue;
      if (state.storage.storageEngine === undefined) {
        // ignoring queue process request before initialization
        return;
      }

      if (queue.nextIndex >= queue.items.length) {
        dispatch(privateActions.setTaskQueueState('idle'))
        return;
      }

      const taskId = queue.items[queue.nextIndex];
      const taskItem = state.storage.taskById[taskId];
      const instanceId = getState().storage.instanceId;

      if (taskItem.state === 'cancelled') {
        // skip canceleld task
        dispatch(privateActions.processTaskResult({
          id: taskId,
          instanceId,
          taskResult: {
            result: 'skipped',
            errorMessage: 'Task was cancelled'
          }
        }))
        return;
      }

      dispatch(privateActions.setTaskQueueState('processing'));
      dispatch(privateActions.startTask({ id: taskId }))

      const taskResult = await swTask(taskItem.task);

      // task can in result sent some custom state, that can be used by UI,
      // so here it is send to be processed by slice reducer
      dispatch(privateActions.processTaskResult({ id: taskId, instanceId, taskResult }))
      if (instanceId !== getState().storage.instanceId) {
        return;
      }
    }
  }
}
function resume() {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(privateActions.resumeQueue());
    dispatch(processQueue());
  }
}

function enqueueTask(task: Task) {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(privateActions.addTask(task));
    if (getState().storage.taskQueueState === 'idle') {
      dispatch(processQueue())
    }
    // return task ID
    return getState().storage.taskQueue.idCounter - 1;
  }
}

export function runCommand(cmd: Command) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const instanceId = getState().storage.instanceId;
    const commandResult = await swCommand(cmd);
    // command can set some custom state, that can be used by UI,
    // so here it is send to be processed by slice reducer
    dispatch(privateActions.processCommandResult({ instanceId, commandResult }));
    return commandResult;
  }
}

function initStorageEngine(engineType: EngineType) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    switch (engineType) {
      case "github":
      case "github1":
        const initCmd: InitCommand = {
          type: "init",
          payload: {
            engineType,
            custom: {
              ghToken: getState().auth.accessToken
            }
          }
        }
        const res = await dispatch(runCommand(initCmd))
        return res;
      default:
        throw new Error('Unknown storage engine type')
    }
  }
}

export function loadSheet(engineType: EngineType, payload: any) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    dispatch(privateActions.init({ engineType }));
    const instanceId = getState().storage.instanceId;
    dispatch(sheetActions.startLoading());
    let res = await dispatch(initStorageEngine(engineType))
    if (instanceId !== getState().storage.instanceId) {
      return;
    }
    if (res.result === "error") {
      dispatch(sheetActions.setErrorMessage({ message: res.errorMessage, newState: "load_error" }))
      return;
    }

    res = await dispatch(runCommand({ type: 'load', payload }))
    if (instanceId !== getState().storage.instanceId) {
      return;
    }
    if (res.result === "error") {
      dispatch(sheetActions.setErrorMessage({ message: res.errorMessage, newState: "load_error" }))
      return;
    }

    const { filename, json, sheetId } = res.data as LoadResult
    dispatch(sheetActions.initSheet(filename, json, sheetId));
    dispatch(UndoActionCreators.clearHistory())
  }
}

const unsyncedChanges: { [key: string]: () => void } = {}
export function unsyncedChange(payload: { key: string, unsynced: (() => void) | false }) {
  return async (dispatch: AppDispatch, getState: () => RootState) => {
    const { key, unsynced } = payload;
    if (unsynced === false) {
      delete unsyncedChanges[key];
    } else {
      unsyncedChanges[key] = unsynced;
    }
    dispatch(privateActions.setUnsyncedChanges({
      counter: Object.values(unsyncedChanges).length
    }))
  }
}

function syncUnsyncedChanges() {
  return (dispatch: AppDispatch, getState: () => RootState) => {
    for (let sync of Object.values(unsyncedChanges)) {
      // sync should also call unsyncedChange thunk
      // so counter, and list is updated 
      sync();
    }
  }
}