import { ApiStanding } from '@/services/touchlineApi';
import { TeamCrest } from './TeamCrest';
import { cn } from '@/lib/utils';

const FORM_STYLES: Record<string, string> = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-muted-foreground/40 text-foreground',
    L: 'bg-red-500 text-white'
};

export const StandingsTable = ({ standings }: { standings: ApiStanding[] }) => {
    if (!standings.length) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No completed matches yet this season, so the table is empty.
            </p>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
                <thead>
                    <tr className="border-b text-xs uppercase text-muted-foreground">
                        <th className="w-8 px-2 py-2 text-left font-medium">#</th>
                        <th className="px-2 py-2 text-left font-medium">Team</th>
                        <th className="w-10 px-1 py-2 text-center font-medium">P</th>
                        <th className="w-10 px-1 py-2 text-center font-medium">W</th>
                        <th className="w-10 px-1 py-2 text-center font-medium">D</th>
                        <th className="w-10 px-1 py-2 text-center font-medium">L</th>
                        <th className="w-12 px-1 py-2 text-center font-medium">GD</th>
                        <th className="w-10 px-1 py-2 text-center font-medium">Pts</th>
                        <th className="hidden w-28 px-2 py-2 text-left font-medium sm:table-cell">
                            Form
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {standings.map((row) => (
                        <tr key={row.teamId} className="border-b last:border-b-0">
                            <td className="px-2 py-2 tabular-nums text-muted-foreground">
                                {row.position}
                            </td>
                            <td className="px-2 py-2">
                                <span className="flex items-center gap-2">
                                    <TeamCrest crest={row.crest} name={row.team} size={20} />
                                    <span className="truncate">{row.team}</span>
                                </span>
                            </td>
                            <td className="px-1 py-2 text-center tabular-nums">{row.played}</td>
                            <td className="px-1 py-2 text-center tabular-nums">{row.won}</td>
                            <td className="px-1 py-2 text-center tabular-nums">{row.drawn}</td>
                            <td className="px-1 py-2 text-center tabular-nums">{row.lost}</td>
                            <td className="px-1 py-2 text-center tabular-nums">
                                {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                            </td>
                            <td className="px-1 py-2 text-center font-semibold tabular-nums">
                                {row.points}
                            </td>
                            <td className="hidden px-2 py-2 sm:table-cell">
                                <span className="flex gap-1">
                                    {row.form.map((result, index) => (
                                        <span
                                            key={`${row.teamId}-${index}`}
                                            className={cn(
                                                'flex h-4 w-4 items-center justify-center rounded text-[10px] font-bold',
                                                FORM_STYLES[result]
                                            )}
                                        >
                                            {result}
                                        </span>
                                    ))}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
