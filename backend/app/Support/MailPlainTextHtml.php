<?php

namespace App\Support;

class MailPlainTextHtml
{
    private const URL_PATTERN = '~((?:https?://|www\.)[^\s<]+)~i';

    private const EMAIL_PATTERN = '/(?<![\w.+-])([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})(?![\w.-])/i';

    private const MARKDOWN_LINK_PATTERN = '/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/i';

    public static function toHtml(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $body = self::replaceMarkdownLinks($text);

        return '<!DOCTYPE html><html><body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;font-size:14px;line-height:1.5;color:#111827">'
            .$body
            .'</body></html>';
    }

    private static function replaceMarkdownLinks(string $text): string
    {
        $parts = preg_split(self::MARKDOWN_LINK_PATTERN, $text, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            return self::linkifyUrls($text);
        }

        $html = '';
        $count = count($parts);
        for ($i = 0; $i < $count; $i++) {
            if (($i % 3) === 1 && isset($parts[$i + 1])) {
                $html .= self::anchor($parts[$i + 1], $parts[$i]);
                $i++;

                continue;
            }

            $html .= self::linkifyUrls($parts[$i]);
        }

        return $html;
    }

    private static function linkifyUrls(string $text): string
    {
        $parts = preg_split(self::URL_PATTERN, $text, -1, PREG_SPLIT_DELIM_CAPTURE);
        if ($parts === false) {
            return self::formatText($text);
        }

        $html = '';
        foreach ($parts as $index => $part) {
            if ($index % 2 === 0) {
                $html .= self::formatText($part);

                continue;
            }

            [$url, $suffix] = self::splitTrailingPunctuation($part);
            if (! self::isLinkableUrl($url)) {
                $html .= self::formatText($part);

                continue;
            }

            $html .= self::anchor($url, $url).self::formatText($suffix);
        }

        return $html;
    }

    private static function formatText(string $text): string
    {
        $escaped = htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
        $linked = preg_replace_callback(
            self::EMAIL_PATTERN,
            static fn (array $match): string => self::anchor('mailto:'.$match[1], $match[1], alreadyEscapedLabel: true),
            $escaped,
        ) ?? $escaped;

        return str_replace("\n", "<br>\n", $linked);
    }

    private static function anchor(string $href, string $label, bool $alreadyEscapedLabel = false): string
    {
        $href = self::normalizeHref($href);
        $visible = $alreadyEscapedLabel
            ? $label
            : htmlspecialchars($label, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

        return '<a href="'.htmlspecialchars($href, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8').'" style="color:#2563eb;text-decoration:underline">'.$visible.'</a>';
    }

    private static function normalizeHref(string $url): string
    {
        if (str_starts_with(strtolower($url), 'mailto:')) {
            return $url;
        }

        if (preg_match('/^www\./i', $url)) {
            return 'https://'.$url;
        }

        return $url;
    }

    private static function isLinkableUrl(string $url): bool
    {
        return (bool) preg_match('~^(https?://|www\.)[^\s]+\.[^\s]+$~i', $url);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private static function splitTrailingPunctuation(string $url): array
    {
        $suffix = '';

        while ($url !== '') {
            $last = substr($url, -1);

            if (in_array($last, ['.', ',', ';', ':', '!', '?', '\'', '"'], true)) {
                $suffix = $last.$suffix;
                $url = substr($url, 0, -1);

                continue;
            }

            if ($last === ')' && substr_count($url, '(') < substr_count($url, ')')) {
                $suffix = ')'.$suffix;
                $url = substr($url, 0, -1);

                continue;
            }

            if ($last === ']' && substr_count($url, '[') < substr_count($url, ']')) {
                $suffix = ']'.$suffix;
                $url = substr($url, 0, -1);

                continue;
            }

            if ($last === '>') {
                $suffix = '>'.$suffix;
                $url = substr($url, 0, -1);

                continue;
            }

            break;
        }

        return [$url, $suffix];
    }
}
