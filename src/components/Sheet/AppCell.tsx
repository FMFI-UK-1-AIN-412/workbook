// TODO put interface into separate package
import { PrepareResult } from '@fmfi-uk-1-ain-412/fol-graphexplorer';
import { useEffect, useRef } from 'react';
import { getAppInfo } from '../../embeddedApps';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { sheetActions, sheetSelectors } from '../../store/sheetSlice';

export interface AppCellProps {
  cellId: number
}

function AppCell(props: AppCellProps) {
  const dispatch = useAppDispatch();
  const { cellId } = props;

  const cell = useAppSelector(sheetSelectors.cell(cellId));
  const { type, isEdited, data } = cell;

  const { prepare, AppComponent } = getAppInfo(type)

  const lastState = useRef<any | null>(data);
  const prepareResult = useRef<PrepareResult | null>(null);
  if (prepareResult.current === null) {
    prepareResult.current = prepare(data)
  }

  const { instance, getState } = prepareResult.current;
  const stateChanged = useRef(false)

  var onAppStateChanged = () => {
    stateChanged.current = true
  }

  /* check for state change periodically */
  useEffect(() => {
    const interval = setInterval(() => {
      if (stateChanged.current) {
        const newState = getState(instance);
        if (lastState.current == null || (lastState.current !== null && JSON.stringify(newState) !== JSON.stringify(lastState.current))) {
          lastState.current = newState;
          console.log('saving state of ' + type + ' in cell ' + cellId);
          dispatch(sheetActions.updateCellData({ cellId: cellId, data: newState }));
        }
        stateChanged.current = false
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{ position: 'relative' }}
      onDoubleClick={(e) => isEdited && e.stopPropagation()}
    >
      {!isEdited && <div style={{ position: 'absolute', width: '100%', height: '100%', zIndex: 999 }}></div>}
      <AppComponent isEdited={isEdited} instance={instance} onStateChange={onAppStateChanged} />
    </div>
  )
}

export default AppCell;