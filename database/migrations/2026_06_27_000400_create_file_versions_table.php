<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Previous versions of a file, snapshotted on overwrite. The bytes live under
 * the owner's hidden .versions/ area (keyed by storage_key).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('path');
            $table->string('storage_key');
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();

            $table->index(['owner_id', 'path']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_versions');
    }
};
