<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SSO Campus application slugs
    |--------------------------------------------------------------------------
    |
    | Applications whose slug appears here receive extended primary-email SSO
    | profile claims (full_name, department) in addition to the shared name /
    | profile_picture fields. Other applications keep the base JWT payload.
    |
    | Override with a comma-separated NEXUS_SSO_CAMPUS_SLUGS env value if needed.
    |
    */

    'sso_campus_slugs' => array_values(array_unique(array_filter(array_map(
        static fn (string $slug): string => strtolower(trim($slug)),
        explode(',', (string) env('NEXUS_SSO_CAMPUS_SLUGS', 'emzi-nexus-campus')),
    )))),

];
