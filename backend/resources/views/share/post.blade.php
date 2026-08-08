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
    <meta property="og:url" content="{{ $url }}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{{ $title }}">
    <meta name="twitter:description" content="{{ $description }}">
    <meta name="twitter:image" content="{{ $image }}">

    <meta http-equiv="refresh" content="0;url={{ $redirectUrl }}">
    <link rel="canonical" href="{{ $url }}">
</head>
<body>
    <p>
        <a href="{{ $redirectUrl }}">Open post</a>
    </p>
    <script>
        window.location.replace(@json($redirectUrl));
    </script>
</body>
</html>
