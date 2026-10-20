<?php

namespace App\Support;

use DateTimeImmutable;
use DateTimeZone;
use Throwable;

class MailCalendarInvite
{
    /**
     * @return array{
     *     method: string,
     *     uid: string,
     *     summary: string,
     *     description: string,
     *     location: string,
     *     when_label: string,
     *     start: string|null,
     *     end: string|null,
     *     timezone: string|null,
     *     all_day: bool,
     *     organizer_name: string,
     *     organizer_email: string,
     *     attendees: array<int, array{name: string, email: string, status: string}>,
     *     can_reply: bool
     * }|null
     */
    public static function parse(?string $ics): ?array
    {
        if ($ics === null || trim($ics) === '') {
            return null;
        }

        $ics = self::unfold($ics);
        if (! preg_match('/BEGIN:VEVENT\r?\n(.*)\r?\nEND:VEVENT/s', $ics, $match)) {
            return null;
        }

        $props = self::properties($match[1]);
        $calendarProps = self::properties(preg_replace('/BEGIN:VEVENT.*END:VEVENT/s', '', $ics) ?? $ics);
        $method = strtoupper(self::firstValue($calendarProps, 'METHOD'));

        $summary = self::firstValue($props, 'SUMMARY');
        $description = self::firstValue($props, 'DESCRIPTION');
        $location = self::firstValue($props, 'LOCATION');
        $uid = self::firstValue($props, 'UID');
        $organizer = self::person(self::first($props, 'ORGANIZER'));
        $start = self::moment(self::first($props, 'DTSTART'));
        $end = self::moment(self::first($props, 'DTEND'));

        $attendees = [];
        foreach ($props['ATTENDEE'] ?? [] as $property) {
            $person = self::person($property);
            if ($person['email'] === '' && $person['name'] === '') {
                continue;
            }
            $attendees[] = [
                'name' => $person['name'],
                'email' => $person['email'],
                'status' => strtoupper((string) ($property['params']['PARTSTAT'] ?? '')),
            ];
        }

        if ($summary === '' && $start === null && $uid === '') {
            return null;
        }

        $timezone = $start['timezone'] ?? $end['timezone'] ?? null;

        return [
            'method' => $method,
            'uid' => $uid,
            'summary' => $summary !== '' ? $summary : 'Invitation',
            'description' => $description,
            'location' => $location,
            'when_label' => self::whenLabel($start, $end, $timezone),
            'start' => $start['atom'] ?? null,
            'end' => $end['atom'] ?? null,
            'timezone' => $timezone,
            'all_day' => (bool) ($start['all_day'] ?? false),
            'organizer_name' => $organizer['name'],
            'organizer_email' => $organizer['email'],
            'attendees' => $attendees,
            'can_reply' => $organizer['email'] !== '' && ! in_array($method, ['CANCEL', 'REPLY'], true),
        ];
    }

    public static function buildReply(string $ics, string $attendeeEmail, string $attendeeName, string $partstat): string
    {
        $partstat = strtoupper($partstat);
        if (! in_array($partstat, ['ACCEPTED', 'TENTATIVE', 'DECLINED'], true)) {
            throw new \InvalidArgumentException('Unsupported calendar reply.');
        }

        $unfolded = self::unfold($ics);
        if (! preg_match('/BEGIN:VEVENT\r?\n(.*)\r?\nEND:VEVENT/s', $unfolded, $match)) {
            throw new \InvalidArgumentException('Calendar invitation is missing an event.');
        }

        $props = self::properties($match[1]);
        $uid = self::firstValue($props, 'UID');
        if ($uid === '') {
            throw new \InvalidArgumentException('Calendar invitation is missing an event id.');
        }

        $startLine = self::rawLine($props, 'DTSTART');
        $endLine = self::rawLine($props, 'DTEND');
        $summary = self::escapeText(self::firstValue($props, 'SUMMARY'));
        $organizer = self::first($props, 'ORGANIZER');
        $sequence = self::firstValue($props, 'SEQUENCE');
        $sequence = $sequence !== '' ? $sequence : '0';
        $stamp = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Ymd\THis\Z');
        $cn = self::escapeText($attendeeName !== '' ? $attendeeName : $attendeeEmail);

        $lines = [
            'BEGIN:VCALENDAR',
            'PRODID:-//Nexus//Mail//EN',
            'VERSION:2.0',
            'METHOD:REPLY',
            'BEGIN:VEVENT',
            'UID:'.self::escapeText($uid),
            'DTSTAMP:'.$stamp,
        ];

        if ($startLine !== null) {
            $lines[] = $startLine;
        }
        if ($endLine !== null) {
            $lines[] = $endLine;
        }
        if ($summary !== '') {
            $lines[] = 'SUMMARY:'.$summary;
        }
        if ($organizer !== null) {
            $lines[] = self::rawLine($props, 'ORGANIZER');
        }

        $lines[] = 'ATTENDEE;PARTSTAT='.$partstat.';CN='.$cn.':mailto:'.$attendeeEmail;
        $lines[] = 'SEQUENCE:'.$sequence;
        $lines[] = 'END:VEVENT';
        $lines[] = 'END:VCALENDAR';

        return implode("\r\n", $lines)."\r\n";
    }

    private static function unfold(string $ics): string
    {
        $ics = str_replace(["\r\n", "\r"], "\n", $ics);

        return preg_replace("/\n[ \t]/", '', $ics) ?? $ics;
    }

    /**
     * @return array<string, array<int, array{name: string, params: array<string, string>, value: string, raw: string}>>
     */
    private static function properties(string $block): array
    {
        $properties = [];

        foreach (preg_split("/\n/", $block) ?: [] as $line) {
            $line = rtrim($line, "\r");
            if ($line === '' || ! str_contains($line, ':')) {
                continue;
            }

            $splitAt = strpos($line, ':');
            $left = substr($line, 0, $splitAt);
            $value = self::unescapeText(substr($line, $splitAt + 1));
            $pieces = explode(';', $left);
            $name = strtoupper(array_shift($pieces) ?: '');
            if ($name === '') {
                continue;
            }

            $params = [];
            foreach ($pieces as $piece) {
                [$key, $paramValue] = array_pad(explode('=', $piece, 2), 2, '');
                $params[strtoupper($key)] = trim($paramValue, "\" \t");
            }

            $properties[$name][] = [
                'name' => $name,
                'params' => $params,
                'value' => $value,
                'raw' => $line,
            ];
        }

        return $properties;
    }

    /**
     * @param  array<string, array<int, array{name: string, params: array<string, string>, value: string, raw: string}>>  $props
     * @return array{name: string, params: array<string, string>, value: string, raw: string}|null
     */
    private static function first(array $props, string $name): ?array
    {
        return $props[$name][0] ?? null;
    }

    /**
     * @param  array<string, array<int, array{value: string}>>  $props
     */
    private static function firstValue(array $props, string $name): string
    {
        return trim((string) ($props[$name][0]['value'] ?? ''));
    }

    /**
     * @param  array<string, array<int, array{raw: string}>>  $props
     */
    private static function rawLine(array $props, string $name): ?string
    {
        $raw = $props[$name][0]['raw'] ?? null;

        return is_string($raw) && $raw !== '' ? $raw : null;
    }

    /**
     * @param  array{params: array<string, string>, value: string}|null  $property
     * @return array{name: string, email: string}
     */
    private static function person(?array $property): array
    {
        if ($property === null) {
            return ['name' => '', 'email' => ''];
        }

        $email = trim($property['value']);
        if (stripos($email, 'mailto:') === 0) {
            $email = substr($email, 7);
        }
        $email = filter_var($email, FILTER_VALIDATE_EMAIL) ? $email : '';

        return [
            'name' => trim((string) ($property['params']['CN'] ?? '')),
            'email' => $email,
        ];
    }

    /**
     * @param  array{params: array<string, string>, value: string}|null  $property
     * @return array{atom: string, timezone: string|null, all_day: bool}|null
     */
    private static function moment(?array $property): ?array
    {
        if ($property === null) {
            return null;
        }

        $value = trim($property['value']);
        if ($value === '') {
            return null;
        }

        $tzName = $property['params']['TZID'] ?? null;
        $allDay = (bool) preg_match('/^\d{8}$/', $value);

        try {
            if (str_ends_with($value, 'Z')) {
                $moment = new DateTimeImmutable($value);

                return [
                    'atom' => $moment->format(DATE_ATOM),
                    'timezone' => 'UTC',
                    'all_day' => false,
                ];
            }

            if ($tzName) {
                $timezone = new DateTimeZone($tzName);
                $moment = $allDay
                    ? DateTimeImmutable::createFromFormat('!Ymd', $value, $timezone)
                    : DateTimeImmutable::createFromFormat('!Ymd\THis', $value, $timezone);
            } else {
                $moment = $allDay
                    ? DateTimeImmutable::createFromFormat('!Ymd', $value)
                    : DateTimeImmutable::createFromFormat('!Ymd\THis', $value);
            }
        } catch (Throwable) {
            return null;
        }

        if (! $moment instanceof DateTimeImmutable) {
            return null;
        }

        return [
            'atom' => $moment->format(DATE_ATOM),
            'timezone' => $tzName,
            'all_day' => $allDay,
        ];
    }

    /**
     * @param  array{atom: string, timezone: string|null, all_day: bool}|null  $start
     * @param  array{atom: string, timezone: string|null, all_day: bool}|null  $end
     */
    private static function whenLabel(?array $start, ?array $end, ?string $timezone): string
    {
        if ($start === null) {
            return '';
        }

        $zone = null;
        if ($timezone) {
            try {
                $zone = new DateTimeZone($timezone);
            } catch (Throwable) {
                $zone = null;
            }
        }

        $startAt = new DateTimeImmutable($start['atom']);
        $endAt = $end !== null ? new DateTimeImmutable($end['atom']) : null;
        if ($zone) {
            $startAt = $startAt->setTimezone($zone);
            $endAt = $endAt?->setTimezone($zone);
        }

        if ($start['all_day']) {
            $label = $startAt->format('l, j F Y');
            if ($endAt && $endAt->format('Ymd') !== $startAt->format('Ymd')) {
                $label .= ' – '.$endAt->format('l, j F Y');
            }

            return $label;
        }

        if ($endAt && $startAt->format('Ymd') === $endAt->format('Ymd')) {
            $label = $startAt->format('l, j F Y').', '.$startAt->format('H:i').' – '.$endAt->format('H:i');
        } elseif ($endAt) {
            $label = $startAt->format('D, j M Y H:i').' – '.$endAt->format('D, j M Y H:i');
        } else {
            $label = $startAt->format('l, j F Y, H:i');
        }

        if ($timezone && $timezone !== 'UTC') {
            $label .= ' ('.$timezone.')';
        }

        return $label;
    }

    private static function unescapeText(string $value): string
    {
        return strtr($value, [
            '\\n' => "\n",
            '\\N' => "\n",
            '\\,' => ',',
            '\\;' => ';',
            '\\\\' => '\\',
        ]);
    }

    private static function escapeText(string $value): string
    {
        return str_replace(
            ["\\", "\n", ',', ';'],
            ['\\\\', '\\n', '\\,', '\\;'],
            $value,
        );
    }
}
