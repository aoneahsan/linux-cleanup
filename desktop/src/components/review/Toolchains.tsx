import { ToggleButton, ToggleButtonGroup } from 'react-aria-components';
import { Btn } from '@/components/ui/primitives';
import { useT, translate } from '@/i18n';
import { formatKb } from '@/i18n/format';
import { toolRole, uninstallCommand, type ToolRole } from '@/data/toolchains';
import { useMarks } from '@/stores/marks';
import { toast } from '@/lib/feedback';
import type { RunItem } from '@/lib/events';

export type ToolItem = RunItem & { tool: string };

/** Section 0's toolchain rows (items carrying `tool`). */
export const toolItems = (items: readonly RunItem[]): ToolItem[] => items.filter((i): i is ToolItem => typeof i.tool === 'string' && i.tool.length > 0);

/** Keep (default) / Remove for one toolchain; Remove shows the tool's own uninstall command as copyable text. */
export function ToolDecision({ item }: { item: ToolItem }) {
  const t = useT();
  const mark = useMarks((s) => s.tools[item.path] ?? 'keep');
  const setMark = useMarks((s) => s.markTool);
  const cmd = uninstallCommand(item.tool, item.path);
  return (
    <div className="stack-v">
      <ToggleButtonGroup className="toggle-pair" aria-label={t('review.tools.decisionFor', { tool: item.tool })} selectionMode="single" disallowEmptySelection
        selectedKeys={[mark]} onSelectionChange={(k) => setMark(item.path, ([...k][0] as 'keep' | 'remove' | undefined) ?? 'keep')}>
        <ToggleButton id="keep">{t('review.tools.keep')}</ToggleButton>
        <ToggleButton id="remove">{t('review.tools.remove')}</ToggleButton>
      </ToggleButtonGroup>
      {mark === 'remove' ? (
        cmd ? (
          <div className="stack-v">
            <p className="help">{t('review.tools.ownCommand')}</p>
            <code className="path">{cmd}</code>
            <div className="row-actions"><Btn onPress={() => void navigator.clipboard.writeText(cmd).then(() => toast(translate('help.errors.copied')))}>{t('review.tools.copy')}</Btn></div>
          </div>
        ) : <p className="help">{t('review.tools.noCommand', { tool: item.tool })}</p>
      ) : null}
    </div>
  );
}

/** Toolchains as a ledger table (Apps → Toolchains tab). */
export function ToolTable({ items }: { items: ToolItem[] }) {
  const t = useT();
  return (
    <table className="ledger">
      <thead><tr><th>{t('review.tools.colTool')}</th><th>{t('review.tools.colVersion')}</th><th className="num">{t('review.colSize')}</th><th className="num">{t('review.colDecision')}</th></tr></thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.path}>
            <td><b>{i.tool}</b><span className="sub path">{i.path}</span></td>
            <td>{i.version ?? '—'}</td>
            <td className="num">{i.kb ? formatKb(i.kb) : '—'}</td>
            <td className="actions"><ToolDecision item={i} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Toolchains grouped by role (Services → Toolchains by role). */
export function ToolRoles({ items }: { items: ToolItem[] }) {
  const t = useT();
  const roles = [...new Set(items.map((i) => toolRole(i.tool)))] as ToolRole[];
  return (
    <div className="plan-cards">
      {roles.map((r) => {
        const list = items.filter((i) => toolRole(i.tool) === r);
        return (
          <article className="plan-card" key={r}>
            <h3>{t(`review.tools.roles.${r}`)}</h3>
            <p className="lede">{list.map((i) => `${i.tool}${i.version ? ` ${i.version}` : ''}`).join(', ')}</p>
            <div className="foot">{list.map((i) => <div key={i.path}><b>{i.tool}</b><ToolDecision item={i} /></div>)}</div>
          </article>
        );
      })}
    </div>
  );
}
