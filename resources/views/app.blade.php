<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" class="dark" data-theme="tron">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        {{-- Apply the saved thegridcn theme before paint to avoid a flash. --}}
        <script>
            (function () {
                try {
                    var t = localStorage.getItem('grid-theme') || 'tron';
                    document.documentElement.setAttribute('data-theme', t);
                    document.documentElement.classList.add('dark');
                } catch (e) {}
            })();
        </script>

        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=jetbrains-mono:400,500,600,700" rel="stylesheet" />

        @routes
        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
