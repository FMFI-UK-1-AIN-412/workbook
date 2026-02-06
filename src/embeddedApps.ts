import ResolutionEditor from '@fmfi-uk-1-ain-412/resolution-editor';
import StructureExplorer from '@fmfi-uk-1-ain-412/fol-graphexplorer';
import TableauEditor from '@fmfi-uk-1-ain-412/tableaueditor';
import FormalizationCheckerConf from '@fmfi-uk-1-ain-412/formalization-checker';
import NewStructureExplorer from '@fmfi-uk-1-ain-412/structure-explorer';
import config from './config.json';
import { CellContext } from './features/sheet/slice/logicContext';

export interface PrepareResult {
  instance: any;
  getState: (instance: any) => any;
}
type PrepareFunction = (
  initialState: any,
  additionalArgs?: any
) => PrepareResult;

interface AppComponentProps {
  instance: any;
  onStateChange: () => void;
  isEdited: boolean;
  context?: CellContext;
  proof?: any;
  updateProofVerdict?: (verdict: boolean) => void;
}

interface EmeddedApp {
  name: string;
  typeName: string;
  supportsProofs: boolean;
  prepare: PrepareFunction;
  AppComponent: (props: AppComponentProps) => JSX.Element;
}

export const embeddedApps: EmeddedApp[] =
  [
    {
      name: 'Structure explorer',
      typeName: 'structureExplorer',
      supportsProofs: false,
      ...StructureExplorer
    },
    {
      name: 'Tableau editor',
      typeName: 'tableauEditor',
      supportsProofs: true,
      ...TableauEditor
    },
    {
      name: 'Resolution editor',
      supportsProofs: true,
      typeName: 'resolutionEditor',
      ...ResolutionEditor
    },
    {
      name: 'Formalization checker',
      supportsProofs: false,
      typeName: 'formalizationChecker',
      ...FormalizationCheckerConf(config.embeddedApps.formalizationChecker.backendUrl)
    },
    {
      name: 'New Structure explorer',
      typeName: 'newStructureExplorer',
      supportsProofs: false,
      ...NewStructureExplorer
    }
  ];

var appType2AppInfo: { [key: string]: EmeddedApp } = {};

embeddedApps.forEach((app) => {
  appType2AppInfo[app.typeName] = app;
});

export function getAppInfo(typeName: string): EmeddedApp {
  return appType2AppInfo[typeName];
}
