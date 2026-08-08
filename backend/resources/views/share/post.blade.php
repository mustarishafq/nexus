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

    {{-- No instant meta-refresh: WhatsApp follows it and loses the OG preview. --}}
    <link rel="canonical" href="{{ $url }}">
</head>
<body>
    <p>
        <a id="open-post" href="{{ $redirectUrl }}">Open post</a>
    </p>
    <script>
        // Humans get redirected into the SPA; crawlers typically skip JS.
        window.location.replace(@json($redirectUrl));
    </script>
</body>
</html>
