<?php

namespace App\Support;

use Symfony\Component\Mime\Header\Headers;
use Symfony\Component\Mime\Part\DataPart;

class MailCalendarReplyPart extends DataPart
{
    public function __construct(string $ics)
    {
        parent::__construct($ics, 'invite.ics', 'text/calendar');
        $this->asInline();
    }

    public function getPreparedHeaders(): Headers
    {
        $headers = parent::getPreparedHeaders();
        $headers->setHeaderParameter('Content-Type', 'method', 'REPLY');

        return $headers;
    }
}
