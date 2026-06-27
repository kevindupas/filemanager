<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Account-to-account share grants: the owner shares a path (file or folder)
 * in their partition with another account, read or read+write.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_grants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('grantee_id')->constrained('users')->cascadeOnDelete();
            $table->string('path');
            $table->string('permission')->default('read'); // read | write
            $table->timestamps();

            $table->unique(['owner_id', 'grantee_id', 'path']);
            $table->index('grantee_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_grants');
    }
};
