<?php

namespace Tests;

use App\Models\Setting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Treat the app as already installed so the EnsureInstalled middleware
        // doesn't redirect every request to the wizard. InstallTest opts out.
        if (Schema::hasTable('settings')) {
            Setting::put('installed_at', now()->toIso8601String());
        }
    }
}
