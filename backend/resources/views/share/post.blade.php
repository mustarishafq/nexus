<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $title }}</title>
    <meta name="description" content="{{ $description }}">

    <meta property="og:site_name" content="{{ $siteName }}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="{{ $title }}">
    <meta property="og:description" content="{{ $description }}">
    <meta property="og:image" content="{{ $image }}">
    <meta property="og:image:type" content="image/jpeg">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:url" content="{{ $url }}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $title }}">
    <meta name="twitter:description" content="{{ $description }}">
    <meta name="twitter:image" content="{{ $image }}">

    <link rel="canonical" href="{{ $url }}">
</head>
<body>
    <p>
        <a id="open-post" href="{{ $redirectUrl }}">Open post in EMZI Nexus Brain</a>
    </p>
    {{-- Delayed redirect only — immediate JS replace can make headless
         WhatsApp Web scrapers follow into the SPA and lose the preview. --}}
    <script>
        setTimeout(function () {
            window.location.replace(@json($redirectUrl));
        }, 2500);
    </script>
</body>
</html>
