/** The English catalogue: one module per domain, merged under permanent namespaces. */
import account from './account';
import admin from './admin';
import common from './common';
import flow from './flow';
import help from './help';
import overview from './overview';
import receipt from './receipt';
import releases from './releases';
import run from './run';
import schedules from './schedules';
import sections from './sections';
import settings from './settings';
import shell from './shell';
import states from './states';
import theme from './theme';
import tour from './tour';
import walkthrough from './walkthrough';
import whiteLabel from './whiteLabel';

export default { account, admin, common, flow, help, overview, receipt, releases, run, schedules, sections, settings, shell, states, theme, tour, walkthrough, whiteLabel } as const;
