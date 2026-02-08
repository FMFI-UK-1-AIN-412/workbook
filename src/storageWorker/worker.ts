/* eslint-disable no-restricted-globals */

import { StorageEngine } from "./storageEngine";
import { AutosaveTask, EngineMessage, Task } from "./workerApi";

import { initGithubEngine } from "./githubStorage/engine";
import { initGithubEngine as initGhEngine1 } from "./githubStorage1/adapter";
import { serializeWorkbook2 } from "../features/sheet/slice/workbookFormat";

let storageEngine: StorageEngine
self.onmessage = async (e: MessageEvent<{msg: EngineMessage, requestId: number}>) => {
  const {msg, requestId} = e.data;

  if (msg.type === 'runCommand' && msg.command.type === 'init') {
    switch(msg.command.payload.engineType) {
      case 'github':
        storageEngine = initGithubEngine(msg.command.payload)
        break
      case 'github1':
          storageEngine = initGhEngine1(msg.command.payload)
          break
      default: 
        throw new Error('Unknown engine type')
    }
  }

  if (msg.type === 'runTask' && msg.task.type === 'autosave') {
    // serialize workbook object
    const autosaveTask = msg.task as AutosaveTask
    autosaveTask.payload.serialized = serializeWorkbook2(autosaveTask.payload.contentObj)
  }

  if (msg.type === 'runCommand') {
    const result = await storageEngine.runCommand(msg.command)
    postMessage({requestId, result})
  } else if (msg.type === 'runTask') {
    const result = await storageEngine.runTask(msg.task)
    postMessage({requestId, result})
  }

}
