<?php

namespace Tests\Feature;

use App\Models\ApiToken;
use App\Models\User;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class ExternalAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['manage-users', 'upload-files', 'delete-files', 'create-folders', 'share-files'] as $p) {
            Permission::firstOrCreate(['name' => $p]);
        }
        Role::firstOrCreate(['name' => 'admin'])->syncPermissions(Permission::all());
        Role::firstOrCreate(['name' => 'user']);
        Storage::fake('local');
        Storage::fake('trash');
    }

    private function admin(): User
    {
        $u = User::factory()->create();
        $u->assignRole('admin');

        return $u;
    }

    private function disk(User $u): Filesystem
    {
        return Storage::build([
            'driver' => 'local',
            'root' => Storage::disk('local')->path('users/'.$u->id),
            'throw' => false,
        ]);
    }

    private function tokenFor(User $u): string
    {
        [, $plain] = ApiToken::issue($u, 'cli');

        return $plain;
    }

    // --- token management (web) ---

    public function test_a_user_can_create_and_revoke_tokens(): void
    {
        $u = $this->admin();

        $this->actingAs($u)->post('/settings/tokens', ['name' => 'laptop'])
            ->assertRedirect()
            ->assertSessionHas('token');

        $this->assertDatabaseHas('api_tokens', ['user_id' => $u->id, 'name' => 'laptop']);
        $token = ApiToken::first();

        $this->actingAs($u)->delete("/settings/tokens/{$token->id}")->assertRedirect();
        $this->assertDatabaseMissing('api_tokens', ['id' => $token->id]);
    }

    public function test_a_user_cannot_revoke_another_users_token(): void
    {
        $a = $this->admin();
        $b = $this->admin();
        [$token] = ApiToken::issue($a, 'a-token');

        $this->actingAs($b)->delete("/settings/tokens/{$token->id}")->assertForbidden();
        $this->assertDatabaseHas('api_tokens', ['id' => $token->id]);
    }

    // --- REST API (bearer) ---

    public function test_api_requires_a_valid_token(): void
    {
        $this->getJson('/api/v1/user')->assertStatus(401);
        $this->withToken('nope')->getJson('/api/v1/user')->assertStatus(401);
    }

    public function test_api_lists_and_downloads_own_files(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('docs/a.txt', 'alpha');
        $token = $this->tokenFor($u);

        $this->withToken($token)->getJson('/api/v1/files?path=docs')
            ->assertOk()->assertJsonFragment(['name' => 'a.txt']);

        $this->withToken($token)->get('/api/v1/files/download?path=docs/a.txt')
            ->assertOk();
    }

    public function test_api_upload_and_delete(): void
    {
        $u = $this->admin();
        $token = $this->tokenFor($u);

        $this->withToken($token)->post('/api/v1/files', [
            'path' => '',
            'file' => \Illuminate\Http\UploadedFile::fake()->create('up.txt', 1),
        ])->assertCreated();
        $this->disk($u)->assertExists('up.txt');

        $this->withToken($token)->deleteJson('/api/v1/files', ['path' => 'up.txt'])->assertOk();
        $this->disk($u)->assertMissing('up.txt');
    }

    public function test_api_is_scoped_to_the_token_owner(): void
    {
        $alice = $this->admin();
        $bob = $this->admin();
        $this->disk($alice)->put('secret.txt', 'a');
        $bobToken = $this->tokenFor($bob);

        // Bob's token can't reach Alice's file.
        $this->withToken($bobToken)->get('/api/v1/files/download?path=secret.txt')->assertStatus(404);
    }

    // --- WebDAV (basic) ---

    public function test_webdav_requires_auth(): void
    {
        $this->call('PROPFIND', '/api/webdav/')->assertStatus(401);
    }

    public function test_webdav_propfind_lists_the_partition(): void
    {
        $u = $this->admin();
        $this->disk($u)->put('hello.txt', 'hi');
        $token = $this->tokenFor($u);

        $res = $this->call('PROPFIND', '/api/webdav/', [], [], [], ['HTTP_AUTHORIZATION' => 'Basic '.base64_encode('token:'.$token), 'HTTP_DEPTH' => '1']);
        $res->assertStatus(207);
        $this->assertStringContainsString('hello.txt', $res->getContent());
    }

    public function test_webdav_put_get_and_delete(): void
    {
        $u = $this->admin();
        $token = $this->tokenFor($u);

        $this->call('PUT', '/api/webdav/note.txt', [], [], [], ['HTTP_AUTHORIZATION' => 'Basic '.base64_encode('token:'.$token)], 'dav-bytes')
            ->assertStatus(201);
        $this->disk($u)->assertExists('note.txt');

        $get = $this->call('GET', '/api/webdav/note.txt', [], [], [], ['HTTP_AUTHORIZATION' => 'Basic '.base64_encode('token:'.$token)]);
        $get->assertOk();
        $this->assertSame('dav-bytes', $get->getContent());

        $this->call('DELETE', '/api/webdav/note.txt', [], [], [], ['HTTP_AUTHORIZATION' => 'Basic '.base64_encode('token:'.$token)])->assertStatus(204);
        $this->disk($u)->assertMissing('note.txt');
    }
}
