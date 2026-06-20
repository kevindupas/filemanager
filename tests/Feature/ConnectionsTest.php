<?php

namespace Tests\Feature;

use App\Models\Connection;
use App\Models\User;
use App\Services\DiskResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ConnectionsTest extends TestCase
{
    use RefreshDatabase;

    private function makeConnection(User $user, array $overrides = []): Connection
    {
        return Connection::create(array_merge([
            'user_id' => $user->id,
            'name' => 'My server',
            'type' => 'sftp',
            'config' => ['host' => 'example.com', 'username' => 'root', 'port' => 22],
        ], $overrides));
    }

    public function test_user_can_create_a_connection(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->post('/connections', [
            'name' => 'Proxmox',
            'type' => 'sftp',
            'config' => ['host' => 'pve.local', 'username' => 'root', 'password' => 'secret'],
        ])->assertRedirect();

        $this->assertDatabaseHas('connections', ['user_id' => $user->id, 'name' => 'Proxmox', 'type' => 'sftp']);

        // Credentials are encrypted at rest — the raw column must not leak them.
        $raw = DB::table('connections')->value('config');
        $this->assertStringNotContainsString('pve.local', $raw);
        $this->assertStringNotContainsString('secret', $raw);
    }

    public function test_cannot_edit_or_delete_another_users_connection(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $conn = $this->makeConnection($owner);

        $this->actingAs($other)
            ->put("/connections/{$conn->id}", ['name' => 'Hijacked', 'type' => 'sftp', 'config' => ['host' => 'x', 'username' => 'y']])
            ->assertForbidden();

        $this->actingAs($other)->delete("/connections/{$conn->id}")->assertForbidden();

        $this->assertDatabaseHas('connections', ['id' => $conn->id, 'name' => 'My server']);
    }

    public function test_resolver_lists_available_disks(): void
    {
        $user = User::factory()->create();
        $this->makeConnection($user, ['name' => 'Alpha']);

        $disks = app(DiskResolver::class)->available($user);

        $this->assertSame('local', $disks[0]['key']);
        $this->assertContains('Alpha', array_column($disks, 'label'));
    }

    public function test_resolver_rejects_a_foreign_connection(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $conn = $this->makeConnection($owner);

        $this->expectExceptionMessage('Connection not found.');
        app(DiskResolver::class)->resolve($conn->diskKey(), $other);
    }

    public function test_resolver_builds_config_per_type(): void
    {
        $r = app(DiskResolver::class);

        $sftp = $r->config('sftp', ['host' => 'h', 'username' => 'u', 'password' => 'p', 'port' => 2222]);
        $this->assertSame('sftp', $sftp['driver']);
        $this->assertSame(2222, $sftp['port']);

        $s3 = $r->config('s3', ['key' => 'k', 'secret' => 's', 'bucket' => 'b', 'region' => 'eu-west-1']);
        $this->assertSame('s3', $s3['driver']);
        $this->assertSame('b', $s3['bucket']);
    }

    public function test_connections_page_loads(): void
    {
        $this->actingAs(User::factory()->create())->get('/connections')->assertOk();
    }
}
