/**
 * Icon vocabulary for the app, from the Touchline Phosphor kit.
 *
 * Centralised so a given concept always renders the same glyph, and so the
 * kit's guidance stays in one place rather than scattered across components:
 *
 *   - navigation 24-28px, inline/event icons 18-22px, header/action 20-24px
 *   - regular weight by default, bold for active/emphasis
 *   - no emoji anywhere alongside these
 *
 * Yellow and red cards are deliberately NOT Phosphor icons — the kit calls for
 * solid rectangles, which read far better at 18px than any outline glyph.
 */
import {
    Article,
    ArrowRight,
    ArrowsLeftRight,
    Broadcast,
    CalendarBlank,
    CaretDown,
    CaretRight,
    ChartBar,
    CircleNotch,
    Clock,
    FlagCheckered,
    Info,
    Link as LinkIcon,
    Medal,
    Newspaper,
    NewspaperClipping,
    Shield,
    SoccerBall,
    Table,
    Timer,
    Trophy,
    UserCircle,
    Users,
    UsersThree,
    WarningCircle,
    XCircle
} from '@phosphor-icons/react';

export {
    Article,
    ArrowRight,
    ArrowsLeftRight,
    Broadcast,
    CalendarBlank,
    CaretDown,
    CaretRight,
    ChartBar,
    CircleNotch,
    Clock,
    FlagCheckered,
    Info,
    LinkIcon,
    Medal,
    Newspaper,
    NewspaperClipping,
    Shield,
    SoccerBall,
    Table,
    Timer,
    Trophy,
    UserCircle,
    Users,
    UsersThree,
    WarningCircle,
    XCircle
};

/** Sizes from the kit's styling notes. */
export const ICON = {
    nav: 22,
    inline: 18,
    action: 20,
    empty: 32
} as const;

/**
 * A booking, drawn as a solid card rather than an icon.
 * `second` renders the yellow-then-red pairing for a second bookable offence.
 */
export const CardMark = ({
    colour,
    second = false
}: {
    colour: 'yellow' | 'red';
    second?: boolean;
}) => {
    const base = 'inline-block h-[13px] w-[9px] rounded-[1.5px]';
    const fill = colour === 'yellow' ? 'bg-amber-400' : 'bg-red-600';

    if (!second) {
        return <span className={`${base} ${fill}`} aria-hidden="true" />;
    }

    // Offset pair: yellow behind, red in front.
    return (
        <span className="relative inline-block h-[13px] w-[13px]" aria-hidden="true">
            <span className={`${base} absolute left-0 top-0 bg-amber-400`} />
            <span className={`${base} absolute left-[4px] top-0 bg-red-600 ring-1 ring-background`} />
        </span>
    );
};
